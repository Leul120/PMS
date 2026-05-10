package com.procurement.authservice.service;

import com.procurement.authservice.entity.PasswordResetToken;
import com.procurement.authservice.entity.User;
import com.procurement.authservice.repository.PasswordResetTokenRepository;
import com.procurement.authservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final JavaMailSender mailSender;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${app.password-reset.token-expiry-minutes:60}")
    private int tokenExpiryMinutes;

    /**
     * Initiates the forgot-password flow.
     * Always returns success to avoid user enumeration attacks.
     */
    @Transactional
    public void forgotPassword(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            // Invalidate any existing tokens for this user
            tokenRepository.deleteExpiredAndUsedTokens(LocalDateTime.now());

            String token = UUID.randomUUID().toString();
            PasswordResetToken resetToken = new PasswordResetToken();
            resetToken.setToken(token);
            resetToken.setUser(user);
            resetToken.setExpiresAt(LocalDateTime.now().plusMinutes(tokenExpiryMinutes));
            resetToken.setUsed(false);
            tokenRepository.save(resetToken);

            sendResetEmail(user, token);

            auditLogService.logAction("FORGOT_PASSWORD", "User", user.getUserId().toString(),
                    "Password reset requested for: " + email, user.getUserId());
        });

        // Always log the attempt regardless of whether the email exists
        log.info("Password reset requested for email: {}", email);
    }

    /**
     * Completes the password reset using the token.
     */
    @Transactional
    public void resetPassword(String token, String newPassword) {
        PasswordResetToken resetToken = tokenRepository.findByToken(token)
                .orElseThrow(() -> new RuntimeException("Invalid or expired password reset token"));

        if (resetToken.isUsed()) {
            throw new RuntimeException("Password reset token has already been used");
        }

        if (resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Password reset token has expired");
        }

        User user = resetToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setFailedLoginAttempts(0);
        user.setAccountLocked(false);
        user.setLockTime(null);
        userRepository.save(user);

        resetToken.setUsed(true);
        tokenRepository.save(resetToken);

        auditLogService.logAction("RESET_PASSWORD", "User", user.getUserId().toString(),
                "Password reset via token for: " + user.getEmail(), user.getUserId());

        log.info("Password successfully reset for user: {}", user.getEmail());
    }

    private void sendResetEmail(User user, String token) {
        try {
            String resetLink = frontendUrl + "/reset-password?token=" + token;
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(user.getEmail());
            message.setSubject("Password Reset Request - ProcurePro");
            message.setText(
                "Hello " + user.getFullName() + ",\n\n" +
                "We received a request to reset your password.\n\n" +
                "Click the link below to reset your password (valid for " + tokenExpiryMinutes + " minutes):\n" +
                resetLink + "\n\n" +
                "If you did not request a password reset, please ignore this email.\n\n" +
                "Best regards,\nProcurePro Team"
            );
            mailSender.send(message);
            log.info("Password reset email sent to: {}", user.getEmail());
        } catch (Exception e) {
            log.error("Failed to send password reset email to {}: {}", user.getEmail(), e.getMessage());
            // Don't rethrow — the token is already saved; user can retry
        }
    }
}
