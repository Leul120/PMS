package com.procurement.vendorservice.infrastructure.lock;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.concurrent.TimeUnit;

/**
 * Distributed lock aspect - Vendor Service specific.
 */
@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class DistributedLockAspect {

    private final RedissonClient redissonClient;
    private final SpelExpressionParser parser = new SpelExpressionParser();
    private final ParameterNameDiscoverer discoverer = new DefaultParameterNameDiscoverer();

    @Around("@annotation(distributedLock)")
    public Object around(ProceedingJoinPoint point, DistributedLock distributedLock) throws Throwable {
        String lockKey = buildLockKey(point, distributedLock);
        RLock lock = redissonClient.getLock(lockKey);

        boolean acquired = false;
        try {
            log.debug("Attempting to acquire lock: {}", lockKey);

            if (distributedLock.leaseTime() > 0) {
                acquired = lock.tryLock(
                        distributedLock.waitTime(),
                        distributedLock.leaseTime(),
                        distributedLock.timeUnit()
                );
            } else {
                acquired = lock.tryLock(distributedLock.waitTime(), distributedLock.timeUnit());
            }

            if (!acquired) {
                log.warn("Failed to acquire lock: {}", lockKey);
                throw new LockAcquisitionException(distributedLock.errorMessage() + ": " + lockKey);
            }

            log.debug("Lock acquired: {}", lockKey);
            return point.proceed();

        } finally {
            if (acquired && distributedLock.autoUnlock()) {
                unlock(lock, lockKey);
            }
        }
    }

    private String buildLockKey(ProceedingJoinPoint point, DistributedLock distributedLock) {
        String keyExpression = distributedLock.key();
        String prefix = distributedLock.prefix();

        if (!keyExpression.contains("#{")) {
            return prefix + keyExpression;
        }

        EvaluationContext context = createEvaluationContext(point);
        Expression expression = parser.parseExpression(keyExpression);
        String evaluatedKey = expression.getValue(context, String.class);

        return prefix + evaluatedKey;
    }

    private EvaluationContext createEvaluationContext(ProceedingJoinPoint point) {
        StandardEvaluationContext context = new StandardEvaluationContext();
        MethodSignature signature = (MethodSignature) point.getSignature();
        Method method = signature.getMethod();
        Object[] args = point.getArgs();
        String[] paramNames = discoverer.getParameterNames(method);

        if (paramNames != null) {
            for (int i = 0; i < paramNames.length; i++) {
                context.setVariable(paramNames[i], args[i]);
            }
        }
        context.setVariable("args", args);
        return context;
    }

    private void unlock(RLock lock, String lockKey) {
        try {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
                log.debug("Lock released: {}", lockKey);
            }
        } catch (Exception e) {
            log.error("Error releasing lock: {}", lockKey, e);
        }
    }
}
