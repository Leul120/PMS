package com.procurement.scoringservice;

import com.procurement.scoringservice.infrastructure.client.ServiceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.retry.annotation.EnableRetry;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableAspectJAutoProxy
@EnableConfigurationProperties(ServiceProperties.class)
@EnableRetry
@EnableJpaRepositories(basePackages = "com.procurement.scoringservice.repository")
public class ScoringServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(ScoringServiceApplication.class, args);
    }
}
