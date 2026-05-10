package com.procurement.scoringservice;

import com.procurement.scoringservice.infrastructure.client.ServiceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.retry.annotation.EnableRetry;

@SpringBootApplication
@EnableConfigurationProperties(ServiceProperties.class)
@EnableRetry
public class ScoringServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(ScoringServiceApplication.class, args);
    }
}
