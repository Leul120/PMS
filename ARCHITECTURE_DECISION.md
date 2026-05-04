# Architecture Decision: Shared Module vs. Independence

## Context
The Procurement Management System initially implemented a shared module for cross-cutting concerns (caching, rate limiting, distributed locking).

## The Problem
Shared libraries in microservices violate independence principles:
- Tight coupling across services
- Forced coordinated deployments
- Version conflicts
- Cascade failures

## Decision Options

### Option 1: Keep Shared Module (Current)
**Pros:**
- DRY principle - no code duplication
- Consistent implementation
- Easier maintenance for small teams

**Cons:**
- Tight coupling (violates microservice principles)
- Deployment coordination required
- Version lock-in

**Best for:** Small teams, internal systems, rapid prototyping

### Option 2: Copy Infrastructure to Each Service (Recommended for Production)
**Pros:**
- True service independence
- No deployment coupling
- Teams own their code
- Technology freedom per service

**Cons:**
- Code duplication
- Risk of implementation drift
- More maintenance overhead

**Best for:** Multiple teams, enterprise systems, long-term projects

### Option 3: Platform/Sidecar Pattern
**Pros:**
- Shared functionality as separate service
- Language agnostic
- Independent scaling

**Cons:**
- Operational complexity
- Network overhead
- Single point of failure

**Best for:** Large-scale systems, polyglot microservices

## Recommendation

For this project:

**Phase 1 (Current)**: Keep shared module for rapid development

**Phase 2 (Production)**: 
1. Copy essential infrastructure classes to each service
2. Remove shared module dependency
3. Each service manages its own caching/locking independently
4. Document the contract, not the implementation

## Implementation Guidelines

### If Keeping Shared Module (Current)
- Keep it ultra-stable (no frequent changes)
- Only infrastructure concerns, no business logic
- Semantic versioning (major.minor.patch)
- Compile-time dependency only

### If Removing Shared Module
Each service should have its own:
```
src/main/java/com/procurement/Xservice/
  infrastructure/
    cache/
      CacheConfig.java
      CacheNames.java
    lock/
      DistributedLock.java
      DistributedLockAspect.java
    ratelimit/
      RateLimiter.java
      RateLimitAspect.java
```

Copy the ~10 core classes to each service and own them independently.

## Decision

**Recommended**: Migrate to Option 2 (copy to each service) before production.

**Rationale**: Microservices are about organizational independence, not just technical separation. Each team should own their caching strategy, TTL decisions, and rate limiting policies.
