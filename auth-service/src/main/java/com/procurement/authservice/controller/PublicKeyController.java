package com.procurement.authservice.controller;

import com.procurement.authservice.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * Public Key Controller - Exposes JWT public key to other microservices.
 * 
 * In a microservices architecture using asymmetric encryption (RS256),
 * the auth-service signs tokens with a private key, and other services
 * verify tokens using this public key.
 * 
 * This endpoint allows services to fetch the public key dynamically.
 * For production, consider caching and using HTTPS with mTLS.
 */
@RestController
@RequestMapping("/.well-known")
@RequiredArgsConstructor
@Slf4j
public class PublicKeyController {

    private final JwtTokenProvider jwtTokenProvider;
    
    /**
     * Expose the JWT public key in JWKS (JSON Web Key Set) format.
     * This follows the standard OpenID Connect discovery format.
     */
    @GetMapping("/jwks.json")
    public ResponseEntity<Map<String, Object>> getJwks() {
        // Using HS256 symmetric keys — JWKS not applicable
        Map<String, Object> response = new HashMap<>();
        response.put("keys", new Object[]{});
        return ResponseEntity.ok(response);
    }

    @GetMapping("/public-key")
    public ResponseEntity<Map<String, String>> getPublicKey() {
        Map<String, String> response = new HashMap<>();
        response.put("algorithm", "HS256");
        response.put("note", "Symmetric key — not publicly shareable");
        return ResponseEntity.ok(response);
    }
    
    /**
     * OpenID Connect discovery endpoint.
     */
    @GetMapping("/openid-configuration")
    public ResponseEntity<Map<String, Object>> getOpenIdConfiguration() {
        Map<String, Object> config = new HashMap<>();
        config.put("issuer", "procurement-auth-service");
        config.put("jwks_uri", "http://localhost:8081/.well-known/jwks.json");
        config.put("response_types_supported", new String[]{"token"});
        config.put("token_endpoint_auth_methods_supported", new String[]{"client_secret_basic"});
        config.put("id_token_signing_alg_values_supported", new String[]{"RS256"});
        
        return ResponseEntity.ok(config);
    }
}
