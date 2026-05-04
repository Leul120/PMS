package com.procurement.rfqbiddingservice.infrastructure.lock;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;
import java.lang.reflect.Method;

@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class DistributedLockAspect {
    private final RedissonClient redissonClient;
    private final SpelExpressionParser parser = new SpelExpressionParser();
    private final DefaultParameterNameDiscoverer discoverer = new DefaultParameterNameDiscoverer();

    @Around("@annotation(distributedLock)")
    public Object around(ProceedingJoinPoint point, DistributedLock distributedLock) throws Throwable {
        String lockKey = distributedLock.prefix() + parseKey(point, distributedLock.key());
        RLock lock = redissonClient.getLock(lockKey);
        boolean acquired = lock.tryLock(distributedLock.waitTime(), distributedLock.leaseTime(), distributedLock.timeUnit());
        if (!acquired) throw new RuntimeException("Could not acquire lock: " + lockKey);
        try { return point.proceed(); } finally { if (distributedLock.autoUnlock()) lock.unlock(); }
    }

    private String parseKey(ProceedingJoinPoint point, String key) {
        if (!key.contains("#{")) return key;
        StandardEvaluationContext context = new StandardEvaluationContext();
        MethodSignature sig = (MethodSignature) point.getSignature();
        Method method = sig.getMethod();
        String[] params = discoverer.getParameterNames(method);
        Object[] args = point.getArgs();
        if (params != null) for (int i = 0; i < params.length; i++) context.setVariable(params[i], args[i]);
        return parser.parseExpression(key).getValue(context, String.class);
    }
}
