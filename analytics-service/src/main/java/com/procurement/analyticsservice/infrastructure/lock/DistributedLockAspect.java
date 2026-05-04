package com.procurement.analyticsservice.infrastructure.lock;

import lombok.RequiredArgsConstructor;
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
public class DistributedLockAspect {
    private final RedissonClient redissonClient;
    private final SpelExpressionParser parser = new SpelExpressionParser();
    private final DefaultParameterNameDiscoverer discoverer = new DefaultParameterNameDiscoverer();

    @Around("@annotation(lock)")
    public Object around(ProceedingJoinPoint point, DistributedLock lock) throws Throwable {
        String key = lock.prefix() + parseKey(point, lock.key());
        RLock rlock = redissonClient.getLock(key);
        if (!rlock.tryLock(lock.waitTime(), lock.leaseTime(), lock.timeUnit()))
            throw new RuntimeException("Lock failed: " + key);
        try { return point.proceed(); } finally { if (lock.autoUnlock()) rlock.unlock(); }
    }

    private String parseKey(ProceedingJoinPoint p, String key) {
        if (!key.contains("#{")) return key;
        StandardEvaluationContext ctx = new StandardEvaluationContext();
        MethodSignature sig = (MethodSignature) p.getSignature();
        String[] names = discoverer.getParameterNames(sig.getMethod());
        if (names != null) for (int i = 0; i < names.length; i++) ctx.setVariable(names[i], p.getArgs()[i]);
        return parser.parseExpression(key).getValue(ctx, String.class);
    }
}
