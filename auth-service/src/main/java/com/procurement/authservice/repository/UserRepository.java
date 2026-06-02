package com.procurement.authservice.repository;

import com.procurement.authservice.entity.Tenant;
import com.procurement.authservice.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    Optional<User> findByEmail(String email);

    List<User> findAllByEmail(String email);

    boolean existsByEmail(String email);

    Optional<User> findByEmailAndTenant(String email, Tenant tenant);

    boolean existsByEmailAndTenant(String email, Tenant tenant);

    List<User> findByTenant(Tenant tenant);

    @Query("SELECT COUNT(u) FROM User u WHERE u.tenant = :tenant")
    long countByTenant(@Param("tenant") Tenant tenant);

    @Query("SELECT COUNT(u) FROM User u WHERE u.accountLocked = true")
    long countLocked();

    @Query("SELECT COUNT(u) FROM User u WHERE u.accountLocked = false OR u.accountLocked IS NULL")
    long countActive();

    @Query("SELECT COUNT(DISTINCT u.tenant.tenantId) FROM User u")
    long countDistinctTenants();
}
