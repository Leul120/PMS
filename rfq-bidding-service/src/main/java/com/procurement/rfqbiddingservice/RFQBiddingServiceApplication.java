package com.procurement.rfqbiddingservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RFQBiddingServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(RFQBiddingServiceApplication.class, args);
    }
}
