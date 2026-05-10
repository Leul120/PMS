package com.procurement.rfqbiddingservice.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {
    
    @Bean
    public NewTopic rfqPublishedTopic() {
        return TopicBuilder.name("rfq.published")
            .partitions(3)
            .replicas(1)
            .build();
    }
    
    @Bean
    public NewTopic bidSubmittedTopic() {
        return TopicBuilder.name("bid.submitted")
            .partitions(3)
            .replicas(1)
            .build();
    }

    @Bean
    public NewTopic bidDeadlineApproachingTopic() {
        return TopicBuilder.name("bid.deadline.approaching")
            .partitions(3)
            .replicas(1)
            .build();
    }
}
