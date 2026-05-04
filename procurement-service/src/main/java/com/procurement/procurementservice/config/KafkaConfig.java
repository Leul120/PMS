package com.procurement.procurementservice.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {
    
    @Bean
    public NewTopic poApprovedTopic() {
        return TopicBuilder.name("po.approved")
            .partitions(3)
            .replicas(1)
            .build();
    }
}
