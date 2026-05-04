package com.procurement.authservice.util;

import java.io.File;
import java.io.FileWriter;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/**
 * RSA Key Pair Generator for JWT Asymmetric Encryption.
 * 
 * This utility generates a 2048-bit RSA key pair for RS256 JWT signing.
 * The private key is used by auth-service to sign tokens.
 * The public key can be distributed to other microservices for token verification.
 * 
 * Run this as a standalone Java application to generate keys.
 */
public class RsaKeyGenerator {
    
    private static final int KEY_SIZE = 2048;
    private static final String ALGORITHM = "RSA";
    
    public static void main(String[] args) {
        try {
            System.out.println("Generating RSA key pair for JWT RS256...");
            
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance(ALGORITHM);
            keyGen.initialize(KEY_SIZE);
            KeyPair keyPair = keyGen.generateKeyPair();
            
            // Encode keys to Base64
            String privateKeyBase64 = Base64.getEncoder().encodeToString(keyPair.getPrivate().getEncoded());
            String publicKeyBase64 = Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
            
            // Create keys directory
            String keysDir = "src/main/resources/keys";
            File directory = new File(keysDir);
            if (!directory.exists()) {
                directory.mkdirs();
            }
            
            // Save private key (PKCS8 format)
            try (FileWriter writer = new FileWriter(keysDir + "/jwt-private.key")) {
                writer.write("-----BEGIN PRIVATE KEY-----\n");
                writer.write(privateKeyBase64);
                writer.write("\n-----END PRIVATE KEY-----\n");
            }
            
            // Save public key (X.509 format)
            try (FileWriter writer = new FileWriter(keysDir + "/jwt-public.key")) {
                writer.write("-----BEGIN PUBLIC KEY-----\n");
                writer.write(publicKeyBase64);
                writer.write("\n-----END PUBLIC KEY-----\n");
            }
            
            System.out.println("✓ RSA key pair generated successfully!");
            System.out.println("  Private key: " + keysDir + "/jwt-private.key");
            System.out.println("  Public key:  " + keysDir + "/jwt-public.key");
            System.out.println("\nSecurity Notes:");
            System.out.println("- Keep private key SECRET and never commit to version control");
            System.out.println("- Public key can be shared with other services for token verification");
            System.out.println("- Use environment variables or Kubernetes secrets in production");
            
        } catch (NoSuchAlgorithmException e) {
            System.err.println("RSA algorithm not available: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("Error generating keys: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
