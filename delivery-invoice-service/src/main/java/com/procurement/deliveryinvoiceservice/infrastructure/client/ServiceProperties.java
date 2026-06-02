package com.procurement.deliveryinvoiceservice.infrastructure.client;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "services")
public class ServiceProperties {
    private ServiceConfig auth;
    private ServiceConfig procurement;
    private ServiceConfig vendor;

    @Data
    public static class ServiceConfig {
        private String url;
    }
}
