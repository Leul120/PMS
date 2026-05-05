package com.procurement.deliveryinvoiceservice;

import com.procurement.deliveryinvoiceservice.infrastructure.client.ServiceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(ServiceProperties.class)
public class DeliveryInvoiceServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(DeliveryInvoiceServiceApplication.class, args);
    }
}
