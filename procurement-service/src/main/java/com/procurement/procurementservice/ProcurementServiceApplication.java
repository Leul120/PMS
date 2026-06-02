package com.procurement.procurementservice;

import com.procurement.procurementservice.infrastructure.client.ServiceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableAspectJAutoProxy
@EnableConfigurationProperties(ServiceProperties.class)
@EnableJpaRepositories(basePackages = "com.procurement.procurementservice.repository")
public class ProcurementServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(ProcurementServiceApplication.class, args);
    }
}
