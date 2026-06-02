package com.procurement.rfqbiddingservice;

import com.procurement.rfqbiddingservice.infrastructure.client.ServiceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableAspectJAutoProxy
@EnableScheduling
@EnableRetry
@EnableConfigurationProperties(ServiceProperties.class)
@EnableJpaRepositories(basePackages = "com.procurement.rfqbiddingservice.repository")
public class RFQBiddingServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(RFQBiddingServiceApplication.class, args);
    }
}
