package com.procurement.scoringservice;

import com.procurement.scoringservice.infrastructure.client.ServiceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(ServiceProperties.class)
public class ScoringServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(ScoringServiceApplication.class, args);
    }
}
