package com.procurement.authservice.tenant;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class TenantContextTest {

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void setAndGet_returnsCurrentTenant() {
        TenantContext.setCurrentTenant(7L);
        assertThat(TenantContext.getCurrentTenant()).isEqualTo(7L);
    }

    @Test
    void clear_removesCurrentTenant() {
        TenantContext.setCurrentTenant(7L);
        TenantContext.clear();
        assertThat(TenantContext.getCurrentTenant()).isNull();
    }

    @Test
    void defaultValue_isNull() {
        assertThat(TenantContext.getCurrentTenant()).isNull();
    }

    @Test
    void overwrite_returnsNewValue() {
        TenantContext.setCurrentTenant(1L);
        TenantContext.setCurrentTenant(2L);
        assertThat(TenantContext.getCurrentTenant()).isEqualTo(2L);
    }

    @Test
    void threadIsolation_spawnedThreadHasNullTenant() throws InterruptedException {
        TenantContext.setCurrentTenant(1L);

        Long[] threadTenantId = new Long[1];
        Thread t = new Thread(() -> threadTenantId[0] = TenantContext.getCurrentTenant());
        t.start();
        t.join();

        assertThat(threadTenantId[0]).isNull();
        assertThat(TenantContext.getCurrentTenant()).isEqualTo(1L);
    }
}
