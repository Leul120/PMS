package com.procurement.notificationservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Async executor for email sending.
 *
 * With Java 21 virtual threads enabled (spring.threads.virtual.enabled=true),
 * Tomcat and Spring MVC already use virtual threads for request handling.
 * The email executor uses a virtual-thread-per-task executor so SMTP I/O
 * never pins a platform thread — each email send gets its own cheap virtual thread.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "emailExecutor")
    public Executor emailExecutor() {
        // Virtual-thread-per-task: zero queue, zero pool overhead.
        // Each sendEmailAsync() call gets its own virtual thread.
        return Executors.newVirtualThreadPerTaskExecutor();
    }
}
