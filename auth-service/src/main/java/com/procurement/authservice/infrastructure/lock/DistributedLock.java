package com.procurement.authservice.infrastructure.lock;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.concurrent.TimeUnit;

/**
 * Distributed locking annotation - Auth Service specific.
 *
 * <p><b>Lock-ordering discipline.</b> This annotation is intentionally NOT
 * {@code @Repeatable}: a method may hold at most ONE distributed lock. That
 * structurally rules out the A&rarr;B / B&rarr;A circular wait that causes
 * deadlocks. If a workflow must guard several resources, acquire a single
 * coarser-grained lock rather than nesting locks. The same rule applies to
 * database row locks (e.g. {@code SELECT ... FOR UPDATE}): take at most one
 * per transaction, or — if several are unavoidable — always in ascending
 * primary-key order.
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
