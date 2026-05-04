package com.procurement.analyticsservice.infrastructure.lock;

import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RedissonConfig {
    @Value("${spring.data.redis.host:localhost}") private String host;
    @Value("${spring.data.redis.port:6379}") private int port;

    @Bean(destroyMethod = "shutdown")
    public RedissonClient redissonClient() {
        Config cfg = new Config();
        cfg.useSingleServer().setAddress(String.format("redis://%s:%d", host, port))
           .setConnectionMinimumIdleSize(5).setConnectionPoolSize(10);
        return Redisson.create(cfg);
    }
}
