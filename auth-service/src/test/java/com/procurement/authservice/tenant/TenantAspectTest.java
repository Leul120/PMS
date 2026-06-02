package com.procurement.authservice.tenant;

import jakarta.persistence.EntityManager;
import org.aspectj.lang.ProceedingJoinPoint;
import org.hibernate.Filter;
import org.hibernate.Session;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantAspectTest {

    @Mock private EntityManager entityManager;
    @Mock private Session session;
    @Mock private Filter filter;
    @Mock private ProceedingJoinPoint pjp;

    private TenantAspect aspect;

    @BeforeEach
    void setUp() {
        aspect = new TenantAspect();
        ReflectionTestUtils.setField(aspect, "entityManager", entityManager);
        TenantContext.clear();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void withTenantContext_enablesFilterProceedsAndDisables() throws Throwable {
        TenantContext.setCurrentTenant(42L);
        when(entityManager.unwrap(Session.class)).thenReturn(session);
        when(session.enableFilter("tenantFilter")).thenReturn(filter);
        when(pjp.proceed()).thenReturn("result");

        Object result = aspect.applyTenantFilter(pjp);

        assertThat(result).isEqualTo("result");
        verify(session).enableFilter("tenantFilter");
        verify(filter).setParameter("tenantId", 42L);
        verify(session).disableFilter("tenantFilter");
    }

    @Test
    void withoutTenantContext_doesNotEnableFilter() throws Throwable {
        when(pjp.proceed()).thenReturn("result");

        aspect.applyTenantFilter(pjp);

        verify(entityManager, never()).unwrap(any());
        verify(pjp).proceed();
    }

    @Test
    void filterDisabledEvenWhenProceedThrows() throws Throwable {
        TenantContext.setCurrentTenant(1L);
        when(entityManager.unwrap(Session.class)).thenReturn(session);
        when(session.enableFilter("tenantFilter")).thenReturn(filter);
        when(pjp.proceed()).thenThrow(new RuntimeException("service error"));

        assertThatThrownBy(() -> aspect.applyTenantFilter(pjp))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("service error");

        verify(session).disableFilter("tenantFilter");
    }

    @Test
    void differentTenantIds_correctIdPassedToFilter() throws Throwable {
        TenantContext.setCurrentTenant(99L);
        when(entityManager.unwrap(Session.class)).thenReturn(session);
        when(session.enableFilter("tenantFilter")).thenReturn(filter);
        when(pjp.proceed()).thenReturn(null);

        aspect.applyTenantFilter(pjp);

        verify(filter).setParameter("tenantId", 99L);
    }
}
