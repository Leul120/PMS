package com.procurement.notificationservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Kafka listener infrastructure for the notification aggregator.
 * A single multiplexed listener consumes all domain topics; this config
 * provides a adequately sized task executor for container threads.
 */
@Configuration
public class KafkaListenerConfig {

    @Bean(name = "kafkaListenerTaskExecutor")
    public ThreadPoolTaskExecutor kafkaListenerTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("kafka-notif-");
        executor.initialize();
        return executor;
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory(
            ConsumerFactory<String, Object> consumerFactory,
            ThreadPoolTaskExecutor kafkaListenerTaskExecutor) {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.getContainerProperties().setListenerTaskExecutor(kafkaListenerTaskExecutor);
        return factory;
    }
}
