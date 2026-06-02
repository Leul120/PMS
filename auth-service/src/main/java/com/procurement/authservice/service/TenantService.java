package com.procurement.authservice.service;

import com.procurement.authservice.dto.TenantRequest;
import com.procurement.authservice.dto.TenantResponse;
import com.procurement.authservice.dto.PagedResponse;
import com.procurement.authservice.dto.TenantStatsResponse;
import com.procurement.authservice.dto.TenantStatsResponse;
import com.procurement.authservice.dto.PagedResponse;
import com.procurement.authservice.entity.Tenant;
import com.procurement.authservice.entity.User;
import com.procurement.authservice.event.TenantSuspendedEvent;
import com.procurement.authservice.repository.TenantRepository;
import com.procurement.authservice.repository.TenantSpecifications;
import com.procurement.authservice.repository.UserRepository;
import com.procurement.authservice.tenant.TenantAccessException;

import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TenantService {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Transactional
    public TenantResponse createTenant(TenantRequest request) {
        if (tenantRepository.existsByDomain(request.getDomain())) {
            throw new RuntimeException("Tenant with domain '" + request.getDomain() + "' already exists");
        }

        Tenant tenant = Tenant.builder()
            .name(request.getName())
            .domain(request.getDomain())
            .status(request.getStatus())
            .subscriptionPlan(request.getSubscriptionPlan())
            .settings(request.getSettings())
            .build();

        Tenant saved = tenantRepository.save(tenant);
        log.info("Tenant created: {} (domain: {})", saved.getName(), saved.getDomain());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public TenantResponse getTenant(Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new RuntimeException("Tenant not found: " + tenantId));
        return toResponse(tenant);
    }

    @Transactional(readOnly = true)
    public TenantResponse getTenantByDomain(String domain) {
        Tenant tenant = tenantRepository.findByDomain(domain)
            .orElseThrow(() -> new RuntimeException("Tenant not found for domain: " + domain));
        return toResponse(tenant);
    }

    @Transactional(readOnly = true)
    public PagedResponse<TenantResponse> getTenants(
            int page,
            int size,
            String search,
            String status,
            String sort) {
        Specification<Tenant> spec = TenantSpecifications.combine(search, status);
        Page<Tenant> tenantPage = tenantRepository.findAll(
            spec, PageRequest.of(page, size, resolveTenantSort(sort)));
        List<TenantResponse> content = tenantPage.getContent().stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
        return PagedResponse.<TenantResponse>builder()
            .content(content)
            .page(tenantPage.getNumber())
            .size(tenantPage.getSize())
            .totalElements(tenantPage.getTotalElements())
            .totalPages(tenantPage.getTotalPages())
            .last(tenantPage.isLast())
            .build();
    }

    @Transactional(readOnly = true)
    public TenantStatsResponse getTenantStats() {
        return TenantStatsResponse.builder()
            .totalTenants(tenantRepository.count())
            .activeTenants(tenantRepository.countByStatus(Tenant.TenantStatus.ACTIVE))
            .suspendedTenants(tenantRepository.countByStatus(Tenant.TenantStatus.SUSPENDED))
            .totalUsers(userRepository.count())
            .build();
    }

    private Sort resolveTenantSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.ASC, "name");
        }
        return switch (sort) {
            case "name-desc" -> Sort.by(Sort.Direction.DESC, "name");
            case "date-desc" -> Sort.by(Sort.Direction.DESC, "createdAt");
            case "date-asc" -> Sort.by(Sort.Direction.ASC, "createdAt");
            default -> Sort.by(Sort.Direction.ASC, "name");
        };
    }

    @Transactional(readOnly = true)
    public List<TenantResponse> getAllTenants() {
        return getTenants(0, 500, null, null, "name-asc").getContent();
    }

    @Transactional
    public TenantResponse updateTenant(Long tenantId, TenantRequest request) {
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new RuntimeException("Tenant not found: " + tenantId));

        if (!tenant.getDomain().equals(request.getDomain()) &&
            tenantRepository.existsByDomain(request.getDomain())) {
            throw new RuntimeException("Domain already in use: " + request.getDomain());
        }

        tenant.setName(request.getName());
        tenant.setDomain(request.getDomain());
        tenant.setStatus(request.getStatus());
        tenant.setSubscriptionPlan(request.getSubscriptionPlan());
        if (request.getSettings() != null) {
            tenant.setSettings(request.getSettings());
        }

        Tenant updated = tenantRepository.save(tenant);
        log.info("Tenant updated: {} (id: {})", updated.getName(), updated.getTenantId());
        return toResponse(updated);
    }

    @Transactional
    public TenantResponse suspendTenant(Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new RuntimeException("Tenant not found: " + tenantId));

        if ("default".equals(tenant.getDomain()) || "system".equals(tenant.getDomain())) {
            throw new TenantAccessException("Cannot suspend a reserved tenant");
        }

        tenant.setStatus(Tenant.TenantStatus.SUSPENDED);
        Tenant updated = tenantRepository.save(tenant);

        // Lock all users in the suspended tenant so active sessions cannot be refreshed
        List<User> tenantUsers = userRepository.findByTenant(tenant);
        tenantUsers.forEach(u -> {
            u.setAccountLocked(true);
            u.setLockTime(LocalDateTime.now());
        });
        userRepository.saveAll(tenantUsers);

        log.warn("Tenant suspended: {} (id: {}), {} users locked", updated.getName(), updated.getTenantId(), tenantUsers.size());

        TenantSuspendedEvent event = TenantSuspendedEvent.builder()
            .tenantId(updated.getTenantId())
            .tenantDomain(updated.getDomain())
            .tenantName(updated.getName())
            .suspendedAt(LocalDateTime.now())
            .build();
        kafkaTemplate.send("tenant.suspended", event)
            .whenComplete((r, ex) -> {
                if (ex != null) log.error("Failed to publish tenant.suspended event: {}", ex.getMessage());
            });

        return toResponse(updated);
    }

    @Transactional
    public TenantResponse activateTenant(Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new RuntimeException("Tenant not found: " + tenantId));
        tenant.setStatus(Tenant.TenantStatus.ACTIVE);
        Tenant updated = tenantRepository.save(tenant);

        // Unlock all users; approve any that are still PENDING_APPROVAL
        List<User> tenantUsers = userRepository.findByTenant(tenant);
        tenantUsers.forEach(u -> {
            if (Boolean.TRUE.equals(u.getAccountLocked())) {
                u.setAccountLocked(false);
                u.setLockTime(null);
                u.setFailedLoginAttempts(0);
            }
            if ("PENDING_APPROVAL".equals(u.getApprovalStatus())) {
                u.setApprovalStatus("APPROVED");
            }
        });
        userRepository.saveAll(tenantUsers);

        log.info("Tenant activated: {} (id: {}), {} users unlocked", updated.getName(), tenantId, tenantUsers.size());
        return toResponse(updated);
    }

    @Transactional
    public void deleteTenant(Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new RuntimeException("Tenant not found: " + tenantId));

        if ("default".equals(tenant.getDomain()) || "system".equals(tenant.getDomain())) {
            throw new TenantAccessException("Cannot delete a reserved tenant");
        }

        long userCount = userRepository.countByTenant(tenant);
        if (userCount > 0) {
            throw new RuntimeException("Cannot delete tenant with " + userCount + " active users. Suspend it instead.");
        }

        tenantRepository.delete(tenant);
        log.warn("Tenant deleted: {} (id: {})", tenant.getName(), tenantId);
    }

    @Transactional
    public TenantResponse updateTenantName(Long tenantId, String newName) {
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new RuntimeException("Tenant not found: " + tenantId));
        if (newName != null && !newName.isBlank()) {
            tenant.setName(newName.trim());
        }
        return toResponse(tenantRepository.save(tenant));
    }

    private TenantResponse toResponse(Tenant tenant) {
        long userCount = userRepository.countByTenant(tenant);
        return TenantResponse.builder()
            .tenantId(tenant.getTenantId())
            .name(tenant.getName())
            .domain(tenant.getDomain())
            .status(tenant.getStatus())
            .subscriptionPlan(tenant.getSubscriptionPlan())
            .settings(tenant.getSettings())
            .createdAt(tenant.getCreatedAt())
            .updatedAt(tenant.getUpdatedAt())
            .userCount(userCount)
            .build();
    }
}
