package com.procurement.authservice.infrastructure.lock;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.concurrent.TimeUnit;

/**
 * Distributed locking annotation - Auth Service specific.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface DistributedLock {

    String key();
    long waitTime() default 10;
    long leaseTime() default 30;
    TimeUnit timeUnit() default TimeUnit.SECONDS;
    boolean autoUnlock() default true;
    boolean throwOnFailure() default true;
    String prefix() default "auth-service:lock:";
    String errorMessage() default "Could not acquire lock for resource";
}
