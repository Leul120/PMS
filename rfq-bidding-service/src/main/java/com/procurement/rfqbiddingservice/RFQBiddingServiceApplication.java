package com.procurement.rfqbiddingservice;

import com.procurement.rfqbiddingservice.infrastructure.client.ServiceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(ServiceProperties.class)
public class RFQBiddingServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(RFQBiddingServiceApplication.class, args);
    }
}
