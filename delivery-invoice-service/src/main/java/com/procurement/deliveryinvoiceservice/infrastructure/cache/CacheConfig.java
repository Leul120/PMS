package com.procurement.deliveryinvoiceservice.infrastructure.cache;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.procurement.deliveryinvoiceservice.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

@Configuration
@EnableCaching
public class CacheConfig {
    @Value("${spring.data.redis.host:localhost}") private String host;
    @Value("${spring.data.redis.port:6379}") private int port;
    @Value("${spring.data.redis.timeout:2000}") private int timeout;

    @Bean
    public LettuceConnectionFactory redisConnectionFactory() {
        return new LettuceConnectionFactory(new RedisStandaloneConfiguration(host, port),
            LettuceClientConfiguration.builder().commandTimeout(Duration.ofMillis(timeout)).build());
    }

    @Bean @Primary
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory cf) {
        RedisTemplate<String, Object> t = new RedisTemplate<>();
        t.setConnectionFactory(cf);
        ObjectMapper om = new ObjectMapper();
        om.activateDefaultTyping(LaissezFaireSubTypeValidator.instance, ObjectMapper.DefaultTyping.NON_FINAL, JsonTypeInfo.As.PROPERTY);
        om.findAndRegisterModules();
        GenericJackson2JsonRedisSerializer ser = new GenericJackson2JsonRedisSerializer(om);
        t.setKeySerializer(new StringRedisSerializer());
        t.setHashKeySerializer(new StringRedisSerializer());
        t.setValueSerializer(ser);
        t.setHashValueSerializer(ser);
        return t;
    }

    @Bean @Primary
    public CacheManager cacheManager(RedisConnectionFactory cf) {
        ObjectMapper om = new ObjectMapper();
        om.activateDefaultTyping(LaissezFaireSubTypeValidator.instance, ObjectMapper.DefaultTyping.NON_FINAL, JsonTypeInfo.As.PROPERTY);
        om.findAndRegisterModules();
        GenericJackson2JsonRedisSerializer ser = new GenericJackson2JsonRedisSerializer(om);
        RedisCacheConfiguration cfg = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(30))
            .computePrefixWith(cacheName -> {
                Long tenantId = TenantContext.getCurrentTenant();
                return tenantId != null ? "tenant:" + tenantId + ":" + cacheName + "::" : cacheName + "::";
            })
            .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(ser))
            .disableCachingNullValues();
        return RedisCacheManager.builder(cf).cacheDefaults(cfg)
            .withCacheConfiguration("deliveries", cfg.entryTtl(Duration.ofMinutes(30)))
            .withCacheConfiguration("invoices", cfg.entryTtl(Duration.ofMinutes(45)))
            .withCacheConfiguration("receipts", cfg.entryTtl(Duration.ofMinutes(20)))
            .transactionAware().build();
    }
}
