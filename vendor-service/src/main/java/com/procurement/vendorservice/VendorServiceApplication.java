package com.procurement.vendorservice;

import com.procurement.vendorservice.infrastructure.client.ServiceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.retry.annotation.EnableRetry;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableAspectJAutoProxy
@EnableRetry
@EnableConfigurationProperties(ServiceProperties.class)
@EnableJpaRepositories(basePackages = "com.procurement.vendorservice.repository")
public class VendorServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(VendorServiceApplication.class, args);
    }
}
