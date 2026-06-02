package com.procurement.deliveryinvoiceservice;

import com.procurement.deliveryinvoiceservice.infrastructure.client.ServiceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableAspectJAutoProxy
@EnableConfigurationProperties(ServiceProperties.class)
@EnableJpaRepositories(basePackages = "com.procurement.deliveryinvoiceservice.repository")
public class DeliveryInvoiceServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(DeliveryInvoiceServiceApplication.class, args);
    }
}
