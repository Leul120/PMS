package com.procurement.deliveryinvoiceservice.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {
    
    @Bean
    public NewTopic deliveryCompletedTopic() {
        return TopicBuilder.name("delivery.completed")
            .partitions(3)
            .replicas(1)
            .build();
    }
    
    @Bean
    public NewTopic invoiceDiscrepancyTopic() {
        return TopicBuilder.name("invoice.discrepancy")
            .partitions(3)
            .replicas(1)
            .build();
    }
}
