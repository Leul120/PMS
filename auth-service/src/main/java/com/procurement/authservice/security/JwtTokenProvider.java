package com.procurement.authservice.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Date;
import java.util.stream.Collectors;

@Component
@Slf4j
public class JwtTokenProvider {
    
    @Value("${jwt.expiration:86400000}")
    private long jwtExpiration;
    
    @Value("${jwt.private-key-path:classpath:keys/jwt-private.key}")
    private Resource privateKeyResource;
    
    @Value("${jwt.public-key-path:classpath:keys/jwt-public.key}")
    private Resource publicKeyResource;
    
    private PrivateKey privateKey;
    private PublicKey publicKey;
    
    @jakarta.annotation.PostConstruct
    public void init() {
        try {
            this.privateKey = loadPrivateKey();
            this.publicKey = loadPublicKey();
            log.info("RSA keys loaded successfully. Using RS256 asymmetric encryption.");
        } catch (Exception e) {
            log.warn("Failed to load RSA keys from files: {}. Generating new key pair...", e.getMessage());
            generateAndSaveKeyPair();
        }
    }
    
    private void generateAndSaveKeyPair() {
        try {
            java.security.KeyPairGenerator keyGen = java.security.KeyPairGenerator.getInstance("RSA");
            keyGen.initialize(2048);
            java.security.KeyPair keyPair = keyGen.generateKeyPair();
            this.privateKey = keyPair.getPrivate();
            this.publicKey = keyPair.getPublic();
            log.info("Generated new 2048-bit RSA key pair for JWT signing");
            
            // Optionally save keys to files for future use
            saveKeysToFiles(keyPair);
        } catch (Exception e) {
            log.error("Failed to generate RSA key pair: {}", e.getMessage());
            throw new RuntimeException("Could not initialize JWT provider", e);
        }
    }
    
    private void saveKeysToFiles(java.security.KeyPair keyPair) {
        try {
            String privateKeyBase64 = Base64.getEncoder().encodeToString(keyPair.getPrivate().getEncoded());
            String publicKeyBase64 = Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
            
            // Get the directory from the private key resource path
            String privateKeyPath = privateKeyResource.getURI().toString();
            if (privateKeyPath.startsWith("file:")) {
                java.io.File keyFile = new java.io.File(privateKeyResource.getURI());
                java.io.File keyDir = keyFile.getParentFile();
                if (keyDir != null && !keyDir.exists()) {
                    keyDir.mkdirs();
                    log.info("Created keys directory: {}", keyDir.getAbsolutePath());
                }
                
                // Save private key
                try (java.io.FileWriter writer = new java.io.FileWriter(keyFile)) {
                    writer.write("-----BEGIN PRIVATE KEY-----\n");
                    writer.write(privateKeyBase64);
                    writer.write("\n-----END PRIVATE KEY-----\n");
                }
                
                // Save public key
                String publicKeyPath = publicKeyResource.getURI().toString();
                if (publicKeyPath.startsWith("file:")) {
                    java.io.File pubFile = new java.io.File(publicKeyResource.getURI());
                    try (java.io.FileWriter writer = new java.io.FileWriter(pubFile)) {
                        writer.write("-----BEGIN PUBLIC KEY-----\n");
                        writer.write(publicKeyBase64);
                        writer.write("\n-----END PUBLIC KEY-----\n");
                    }
                }
                log.info("Saved RSA keys to files for future use");
            }
        } catch (Exception e) {
            log.warn("Could not save keys to files: {}. Using in-memory keys only.", e.getMessage());
        }
    }
    
    private PrivateKey loadPrivateKey() throws Exception {
        String keyContent = readKeyContent(privateKeyResource);
        byte[] decoded = Base64.getDecoder().decode(keyContent);
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(decoded);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
        return keyFactory.generatePrivate(keySpec);
    }
    
    private PublicKey loadPublicKey() throws Exception {
        String keyContent = readKeyContent(publicKeyResource);
        byte[] decoded = Base64.getDecoder().decode(keyContent);
        X509EncodedKeySpec keySpec = new X509EncodedKeySpec(decoded);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
        return keyFactory.generatePublic(keySpec);
    }
    
    private String readKeyContent(Resource resource) throws Exception {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            return reader.lines()
                .filter(line -> !line.startsWith("----"))
                .collect(Collectors.joining());
        }
    }
    
    public String generateToken(Long userId, String email, String roleName, String permissions) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpiration);
        
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("email", email)
                .claim("role", roleName)
                .claim("permissions", permissions)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(privateKey, Jwts.SIG.RS256)
                .compact();
    }
    
    public Long getUserIdFromToken(String token) {
        Claims claims = parseToken(token);
        return Long.parseLong(claims.getSubject());
    }
    
    public String getEmailFromToken(String token) {
        Claims claims = parseToken(token);
        return claims.get("email", String.class);
    }
    
    public String getRoleFromToken(String token) {
        Claims claims = parseToken(token);
        return claims.get("role", String.class);
    }
    
    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (SecurityException | MalformedJwtException | ExpiredJwtException | 
                 UnsupportedJwtException | IllegalArgumentException e) {
            log.error("Invalid JWT token: {}", e.getMessage());
            return false;
        }
    }
    
    private Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(publicKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
    
    public PublicKey getPublicKey() {
        return publicKey;
    }
}
