package com.procurement.authservice.repository;

import com.procurement.authservice.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, Long>, JpaSpecificationExecutor<Tenant> {

    Optional<Tenant> findByDomain(String domain);

    boolean existsByDomain(String domain);

    java.util.List<Tenant> findByStatus(Tenant.TenantStatus status);

    long countByStatus(Tenant.TenantStatus status);
}
