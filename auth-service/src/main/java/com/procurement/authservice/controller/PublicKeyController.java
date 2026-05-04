package com.procurement.authservice.controller;

import com.procurement.authservice.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.PublicKey;
import java.util.Base64;
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
        PublicKey publicKey = jwtTokenProvider.getPublicKey();
        String publicKeyBase64 = Base64.getEncoder().encodeToString(publicKey.getEncoded());
        
        Map<String, Object> key = new HashMap<>();
        key.put("kty", "RSA");
        key.put("use", "sig");
        key.put("alg", "RS256");
        key.put("kid", "procurement-key-1");
        key.put("n", publicKeyBase64);
        key.put("e", "AQAB"); // Standard RSA exponent
        
        Map<String, Object> response = new HashMap<>();
        response.put("keys", new Object[]{key});
        
        log.debug("Public key requested by another service");
        return ResponseEntity.ok(response);
    }
    
    /**
     * Simple endpoint to get raw public key PEM format.
     * Useful for services that want to configure the key directly.
     */
    @GetMapping("/public-key")
    public ResponseEntity<Map<String, String>> getPublicKey() {
        PublicKey publicKey = jwtTokenProvider.getPublicKey();
        String publicKeyBase64 = Base64.getEncoder().encodeToString(publicKey.getEncoded());
        
        Map<String, String> response = new HashMap<>();
        response.put("algorithm", "RS256");
        response.put("format", "X.509");
        response.put("key", publicKeyBase64);
        response.put("type", "RSA");
        
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
