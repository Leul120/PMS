package com.procurement.authservice.service;

import com.procurement.authservice.dto.LoginRequest;
import com.procurement.authservice.dto.LoginResponse;
import com.procurement.authservice.dto.RegisterRequest;
import com.procurement.authservice.entity.Role;
import com.procurement.authservice.entity.Tenant;
import com.procurement.authservice.entity.User;
import com.procurement.authservice.repository.RoleRepository;
import com.procurement.authservice.repository.SystemSettingsRepository;
import com.procurement.authservice.repository.TenantRepository;
import com.procurement.authservice.repository.UserRepository;
import com.procurement.authservice.security.JwtTokenProvider;
import com.procurement.authservice.tenant.TenantAccessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private TenantRepository tenantRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @Mock private AuditLogService auditLogService;
    @Mock private SystemSettingsRepository settingsRepository;

    @InjectMocks private AuthService authService;

    private Tenant activeTenant;
    private Role vendorRole;
    private User activeUser;

    @BeforeEach
    void setUp() {
        activeTenant = Tenant.builder()
                .tenantId(1L)
                .name("Acme Corp")
                .domain("acme.com")
                .status(Tenant.TenantStatus.ACTIVE)
                .subscriptionPlan(Tenant.SubscriptionPlan.PRO)
                .build();

        vendorRole = new Role(1L, "VENDOR", "READ");

        activeUser = new User();
        activeUser.setUserId(10L);
        activeUser.setEmail("vendor@acme.com");
        activeUser.setPasswordHash("$2a$encoded");
        activeUser.setTenant(activeTenant);
        activeUser.setRole(vendorRole);
        activeUser.setAccountLocked(false);
        activeUser.setFailedLoginAttempts(0);
    }

    // ─── login ───────────────────────────────────────────────────────────────────

    @Test
    void login_success_returnsTokenAndTenantId() {
        LoginRequest req = loginRequest("vendor@acme.com", "secret", "acme.com");
        when(tenantRepository.findByDomain("acme.com")).thenReturn(Optional.of(activeTenant));
        when(userRepository.findByEmailAndTenant("vendor@acme.com", activeTenant)).thenReturn(Optional.of(activeUser));
        when(passwordEncoder.matches("secret", "$2a$encoded")).thenReturn(true);
        when(jwtTokenProvider.generateToken(anyLong(), anyString(), anyString(), anyString(), anyLong()))
                .thenReturn("jwt-token");

        LoginResponse response = authService.login(req);

        assertThat(response.getAccessToken()).isEqualTo("jwt-token");
        assertThat(response.getTenantId()).isEqualTo(1L);
        assertThat(response.getTenantDomain()).isEqualTo("acme.com");
        verify(jwtTokenProvider).generateToken(10L, "vendor@acme.com", "VENDOR", "READ", 1L);
    }

    @Test
    void login_wrongPassword_incrementsFailedAttempts() {
        LoginRequest req = loginRequest("vendor@acme.com", "wrong", "acme.com");
        when(tenantRepository.findByDomain("acme.com")).thenReturn(Optional.of(activeTenant));
        when(userRepository.findByEmailAndTenant("vendor@acme.com", activeTenant)).thenReturn(Optional.of(activeUser));
        when(passwordEncoder.matches("wrong", "$2a$encoded")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Invalid email or password");

        assertThat(activeUser.getFailedLoginAttempts()).isEqualTo(1);
        verify(userRepository).save(activeUser);
    }

    @Test
    void login_fiveFailedAttempts_locksAccount() {
        activeUser.setFailedLoginAttempts(4);
        LoginRequest req = loginRequest("vendor@acme.com", "wrong", "acme.com");
        when(tenantRepository.findByDomain("acme.com")).thenReturn(Optional.of(activeTenant));
        when(userRepository.findByEmailAndTenant("vendor@acme.com", activeTenant)).thenReturn(Optional.of(activeUser));
        when(passwordEncoder.matches("wrong", "$2a$encoded")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(req)).isInstanceOf(RuntimeException.class);

        assertThat(activeUser.getAccountLocked()).isTrue();
        assertThat(activeUser.getFailedLoginAttempts()).isEqualTo(5);
    }

    @Test
    void login_lockedAccount_rejectsWithoutCheckingPassword() {
        activeUser.setAccountLocked(true);
        LoginRequest req = loginRequest("vendor@acme.com", "secret", "acme.com");
        when(tenantRepository.findByDomain("acme.com")).thenReturn(Optional.of(activeTenant));
        when(userRepository.findByEmailAndTenant("vendor@acme.com", activeTenant)).thenReturn(Optional.of(activeUser));

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("locked");

        verify(passwordEncoder, never()).matches(anyString(), anyString());
    }

    @Test
    void login_suspendedTenant_throwsTenantAccessException() {
        activeTenant.setStatus(Tenant.TenantStatus.SUSPENDED);
        LoginRequest req = loginRequest("vendor@acme.com", "secret", "acme.com");
        when(tenantRepository.findByDomain("acme.com")).thenReturn(Optional.of(activeTenant));

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(TenantAccessException.class);
    }

    @Test
    void login_successAfterPriorFailures_resetsFailedAttempts() {
        activeUser.setFailedLoginAttempts(3);
        LoginRequest req = loginRequest("vendor@acme.com", "secret", "acme.com");
        when(tenantRepository.findByDomain("acme.com")).thenReturn(Optional.of(activeTenant));
        when(userRepository.findByEmailAndTenant("vendor@acme.com", activeTenant)).thenReturn(Optional.of(activeUser));
        when(passwordEncoder.matches("secret", "$2a$encoded")).thenReturn(true);
        when(jwtTokenProvider.generateToken(anyLong(), anyString(), anyString(), anyString(), anyLong()))
                .thenReturn("jwt-token");

        authService.login(req);

        assertThat(activeUser.getFailedLoginAttempts()).isEqualTo(0);
    }

    @Test
    void login_tenantDerivedFromEmailDomain_whenNoDomainProvided() {
        LoginRequest req = loginRequest("vendor@acme.com", "secret", null);
        when(tenantRepository.findByDomain("acme.com")).thenReturn(Optional.of(activeTenant));
        when(userRepository.findByEmailAndTenant("vendor@acme.com", activeTenant)).thenReturn(Optional.of(activeUser));
        when(passwordEncoder.matches("secret", "$2a$encoded")).thenReturn(true);
        when(jwtTokenProvider.generateToken(anyLong(), anyString(), anyString(), anyString(), anyLong()))
                .thenReturn("jwt-token");

        LoginResponse response = authService.login(req);

        assertThat(response.getTenantId()).isEqualTo(1L);
    }

    // ─── register ────────────────────────────────────────────────────────────────

    @Test
    void register_setsUserTenantAndRole() {
        RegisterRequest req = registerRequest("new@acme.com", "pass123", "New User", "acme.com");
        when(tenantRepository.findByDomain("acme.com")).thenReturn(Optional.of(activeTenant));
        when(userRepository.existsByEmailAndTenant("new@acme.com", activeTenant)).thenReturn(false);
        when(roleRepository.findByRoleName("VENDOR")).thenReturn(Optional.of(vendorRole));
        when(passwordEncoder.encode("pass123")).thenReturn("$2a$hashed");
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        when(userRepository.save(captor.capture())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setUserId(99L);
            return u;
        });

        authService.register(req);

        User saved = captor.getValue();
        assertThat(saved.getTenant()).isEqualTo(activeTenant);
        assertThat(saved.getRole()).isEqualTo(vendorRole);
        assertThat(saved.getAccountLocked()).isFalse();
        assertThat(saved.getFailedLoginAttempts()).isEqualTo(0);
    }

    @Test
    void register_duplicateEmailInSameTenant_throws() {
        RegisterRequest req = registerRequest("vendor@acme.com", "pass", "Dup", "acme.com");
        when(tenantRepository.findByDomain("acme.com")).thenReturn(Optional.of(activeTenant));
        when(userRepository.existsByEmailAndTenant("vendor@acme.com", activeTenant)).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("already registered");
    }

    @Test
    void register_sameEmailInDifferentTenant_succeeds() {
        Tenant otherTenant = Tenant.builder()
                .tenantId(2L).name("Other").domain("other.com")
                .status(Tenant.TenantStatus.ACTIVE)
                .subscriptionPlan(Tenant.SubscriptionPlan.BASIC)
                .build();
        RegisterRequest req = registerRequest("shared@email.com", "pass", "Shared User", "other.com");
        when(tenantRepository.findByDomain("other.com")).thenReturn(Optional.of(otherTenant));
        when(userRepository.existsByEmailAndTenant("shared@email.com", otherTenant)).thenReturn(false);
        when(roleRepository.findByRoleName("VENDOR")).thenReturn(Optional.of(vendorRole));
        when(passwordEncoder.encode("pass")).thenReturn("$2a$hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setUserId(100L);
            return u;
        });

        assertThatCode(() -> authService.register(req)).doesNotThrowAnyException();
    }

    @Test
    void register_suspendedTenant_throwsTenantAccessException() {
        activeTenant.setStatus(Tenant.TenantStatus.SUSPENDED);
        RegisterRequest req = registerRequest("new@acme.com", "pass", "New", "acme.com");
        when(tenantRepository.findByDomain("acme.com")).thenReturn(Optional.of(activeTenant));

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(TenantAccessException.class);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────────

    private LoginRequest loginRequest(String email, String password, String tenantDomain) {
        LoginRequest r = new LoginRequest();
        r.setEmail(email);
        r.setPassword(password);
        r.setTenantDomain(tenantDomain);
        return r;
    }

    private RegisterRequest registerRequest(String email, String password, String fullName, String tenantDomain) {
        RegisterRequest r = new RegisterRequest();
        r.setEmail(email);
        r.setPassword(password);
        r.setFullName(fullName);
        r.setTenantDomain(tenantDomain);
        return r;
    }
}
