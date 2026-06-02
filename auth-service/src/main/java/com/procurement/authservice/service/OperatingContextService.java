package com.procurement.authservice.service;

import com.procurement.authservice.domain.OperatingContext;
import com.procurement.authservice.domain.OrganizationType;
import com.procurement.authservice.entity.Role;
import com.procurement.authservice.entity.Tenant;
import com.procurement.authservice.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class OperatingContextService {

    public static final Set<String> VENDOR_ROLE_NAMES = Set.of(
        "VENDOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "VENDOR_LOGISTICS"
    );

    public static final Set<String> BUYER_ROLE_NAMES = Set.of(
        "ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "REQUESTER", "SUPER_ADMIN"
    );

    public boolean isVendorRole(String roleName) {
        return roleName != null && VENDOR_ROLE_NAMES.contains(roleName.toUpperCase());
    }

    public boolean isBuyerRole(String roleName) {
        return roleName != null && BUYER_ROLE_NAMES.contains(roleName.toUpperCase());
    }

    public OrganizationType resolveOrganizationType(Tenant tenant) {
        if (tenant.getOrganizationType() != null) {
            return tenant.getOrganizationType();
        }
        return OrganizationType.BUYER;
    }

    public boolean canUseProcurement(User user, Tenant tenant) {
        OrganizationType org = resolveOrganizationType(tenant);
        if (org == OrganizationType.SUPPLIER) {
            return false;
        }
        String primary = user.getRole().getRoleName();
        return isBuyerRole(primary);
    }

    public boolean canUseSales(User user, Tenant tenant) {
        OrganizationType org = resolveOrganizationType(tenant);
        String primary = user.getRole().getRoleName();
        if (isVendorRole(primary)) {
            return true;
        }
        if (user.getSupplierRole() != null) {
            return org == OrganizationType.BOTH || org == OrganizationType.SUPPLIER;
        }
        return org == OrganizationType.SUPPLIER;
    }

    public List<String> availableContexts(User user, Tenant tenant) {
        List<String> contexts = new ArrayList<>();
        if (canUseProcurement(user, tenant)) {
            contexts.add(OperatingContext.PROCUREMENT.name());
        }
        if (canUseSales(user, tenant)) {
            contexts.add(OperatingContext.SALES.name());
        }
        return contexts;
    }

    public String defaultContext(User user, Tenant tenant) {
        List<String> available = availableContexts(user, tenant);
        if (available.isEmpty()) {
            throw new IllegalStateException("User has no operating context for this organisation");
        }
        if (available.contains(OperatingContext.PROCUREMENT.name())
            && isBuyerRole(user.getRole().getRoleName())) {
            return OperatingContext.PROCUREMENT.name();
        }
        return available.get(0);
    }

    public void validateContext(User user, Tenant tenant, String contextRaw) {
        OperatingContext context;
        try {
            context = OperatingContext.valueOf(contextRaw.toUpperCase());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid context: " + contextRaw);
        }
        List<String> available = availableContexts(user, tenant);
        if (!available.contains(context.name())) {
            throw new IllegalArgumentException(
                "Context " + context + " is not available for this user in organisation " + tenant.getDomain());
        }
    }

    public Role resolveEffectiveRole(User user, String contextRaw) {
        OperatingContext context = OperatingContext.valueOf(contextRaw.toUpperCase());
        if (context == OperatingContext.SALES) {
            if (user.getSupplierRole() != null) {
                return user.getSupplierRole();
            }
            if (isVendorRole(user.getRole().getRoleName())) {
                return user.getRole();
            }
            throw new IllegalStateException("No supplier role assigned for Sales context");
        }
        if (isBuyerRole(user.getRole().getRoleName())) {
            return user.getRole();
        }
        throw new IllegalStateException("No procurement role for Procurement context");
    }
}
