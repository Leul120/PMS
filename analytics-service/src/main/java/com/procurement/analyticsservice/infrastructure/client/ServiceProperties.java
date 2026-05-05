package com.procurement.analyticsservice.infrastructure.client;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "services")
public class ServiceProperties {
    private ServiceConfig vendor;
    private ServiceConfig procurement;
    private ServiceConfig rfq;

    @Data
    public static class ServiceConfig {
        private String url;
    }
}
