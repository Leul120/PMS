# Infrastructure and Deployment

> **Who should read this:** Anyone setting up the project locally, configuring a new environment, or planning a production deployment. Also explains why each infrastructure component exists.

---

## Local Development Setup

```bash
# From the project root
docker compose up -d

# All 20+ containers start in order:
# 1. Infrastructure (Zookeeper, Kafka, Redis instances, PostgreSQL instances)
# 2. Backend services (wait for their DB and Kafka to be healthy)
# 3. Frontend (waits for api-gateway)
```

The system is fully containerised. No local Java, Node, or database installation required — Docker handles everything.

After startup:
- Frontend: http://localhost:3000
- API Gateway: http://localhost:8080
- Individual services: ports 8081–8089 (exposed for debugging)
- Databases: ports 5432–5439 (exposed for psql/DBeaver access)

---

## Infrastructure Components

### Apache Kafka + Zookeeper

```yaml
# docker-compose.yml
zookeeper:
  image: confluentinc/cp-zookeeper:7.4.0
  environment:
    ZOOKEEPER_CLIENT_PORT: 2181

kafka:
  image: confluentinc/cp-kafka:7.4.0
  depends_on: [zookeeper]
  environment:
    KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
    KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
    KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
    KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1  # 1 broker = RF of 1 is fine for dev
  healthcheck:
    test: kafka-topics.sh --bootstrap-server localhost:9092 --list
    interval: 10s
    retries: 3
```

**Why Zookeeper?** Kafka (versions < 3.x KRaft mode) requires Zookeeper for cluster coordination — leader election, configuration management, metadata storage. In production you'd run 3+ Zookeeper nodes and 3+ Kafka brokers for HA. For development, 1 each is sufficient.

**`KAFKA_AUTO_CREATE_TOPICS_ENABLE: true`** means topics (`vendor.verified`, `rfq.published`, etc.) are created automatically on first publish. In production, topics should be created explicitly with correct partitioning and replication factors.

### PostgreSQL Instances

Nine dedicated PostgreSQL instances, one per service:

```yaml
postgres-auth:
  image: postgres:15-alpine
  environment:
    POSTGRES_DB: authdb
    POSTGRES_USER: ${DB_USERNAME:-postgres}
    POSTGRES_PASSWORD: ${DB_PASSWORD:-password}
  ports:
    - "5432:5432"
  volumes:
    - postgres-auth-data:/var/lib/postgresql/data
  healthcheck:
    test: pg_isready -U postgres
    interval: 10s
    timeout: 5s
    retries: 5

# ... postgres-vendor (5433), postgres-rfq (5434), ... postgres-notification (5439)
```

**Named volumes** (`postgres-auth-data:/var/lib/postgresql/data`) persist database files across container restarts. Without this, every `docker compose down` and `up` would recreate empty databases.

**Healthchecks** with `depends_on: condition: service_healthy` ensure services only start after their database is ready. Without this, services start before PostgreSQL is accepting connections and fail immediately.

### Redis Instances

```yaml
redis-vendor:
  image: redis:7-alpine
  command: redis-server --maxmemory 67108864 --maxmemory-policy allkeys-lru
  ports:
    - "6381:6379"

# redis-main (6379) for api-gateway rate limiting
# redis-auth (6380), redis-vendor (6381), redis-rfq (6382), ...
```

`allkeys-lru` (Least Recently Used) eviction policy: when Redis hits the 64MB limit, it evicts the least recently used keys. This ensures the cache stays within its memory budget without throwing errors.

### File Storage Volume

```yaml
vendor-service:
  volumes:
    - vendor-uploads:/app/uploads/vendors

volumes:
  vendor-uploads:    # named volume — persists across restarts
```

Vendor documents are stored in this Docker volume. Without the named volume, uploaded documents would be lost every time the vendor-service container restarts.

---

## Environment Variables

All sensitive configuration is injected via environment variables — never hardcoded in source files.

### Critical Variables (must be changed for production)

| Variable | Service | Default | What It Does |
|---|---|---|---|
| `JWT_SECRET` | All services | `dev-secret-key-change-in-prod` | Signs all JWTs — **must be 32+ chars, random, kept secret** |
| `DB_PASSWORD` | All services | `password` | PostgreSQL password |
| `SMTP_USERNAME` | notification-service | `""` (empty) | Gmail address for sending emails |
| `SMTP_PASSWORD` | notification-service | `""` (empty) | Gmail App Password (not account password) |
| `FRONTEND_URL` | api-gateway, auth-service | `http://localhost:3000` | Allowed CORS origin; used in password reset email links |

### Service Configuration Variables

| Variable | Service | Description |
|---|---|---|
| `DB_URL` | Each service | JDBC URL for its database (e.g., `jdbc:postgresql://postgres-auth:5432/authdb`) |
| `DB_USERNAME` | Each service | Database user |
| `REDIS_HOST`, `REDIS_PORT` | Each service | Redis connection |
| `KAFKA_BOOTSTRAP_SERVERS` | All Kafka services | `kafka:9092` in Docker |
| `VENDOR_SERVICE_URL` | rfq-bidding, analytics | `http://vendor-service:8082` |
| `PROCUREMENT_SERVICE_URL` | delivery-invoice, analytics | `http://procurement-service:8084` |
| `SCORING_SERVICE_URL` | rfq-bidding | `http://scoring-service:8086` |
| `FILE_UPLOAD_DIR` | vendor-service | `/app/uploads/vendors` |
| `SPRING_PROFILES_ACTIVE` | All services | `docker` (loads `application-docker.yml`) |

### How Environment Variables Are Loaded in Spring Boot

Spring Boot has a strict property precedence order:
1. Environment variables (highest priority — overrides everything)
2. `application-{profile}.yml` (loaded when `SPRING_PROFILES_ACTIVE=docker`)
3. `application.yml` (base config with localhost defaults)

```yaml
# application.yml (base — for local IDE development)
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/authdb   # localhost for local IDE
    username: ${DB_USERNAME:postgres}              # env var with fallback
    password: ${DB_PASSWORD:password}

# application-docker.yml (overrides for Docker)
spring:
  datasource:
    url: jdbc:postgresql://postgres-auth:5432/authdb  # container DNS name
```

This dual-profile setup means developers can run services in their IDE (connecting to locally-exposed Docker DB ports) without changing config files.

---

## Service Dependencies and Startup Order

`docker-compose.yml` uses `depends_on` with health conditions:

```yaml
auth-service:
  depends_on:
    postgres-auth:
      condition: service_healthy   # wait for DB ready
    kafka:
      condition: service_healthy   # wait for Kafka ready
    redis-auth:
      condition: service_started   # Redis starts fast, just check it's running
```

**Startup sequence:**
```
1. Zookeeper starts
2. Kafka starts (waits for Zookeeper)
3. PostgreSQL instances start (9 in parallel)
4. Redis instances start (9 in parallel)
5. auth-service starts (waits for postgres-auth, kafka, redis-auth)
6. vendor-service starts (waits for postgres-vendor, kafka, redis-vendor)
7. [other services start similarly]
8. api-gateway starts (waits for all services)
9. frontend starts (waits for api-gateway)
```

---

## Kubernetes Manifests (k8s/)

The project includes Kubernetes manifests in the `k8s/` directory for production-style deployment. Key differences from Docker Compose:

| Feature | Docker Compose | Kubernetes |
|---|---|---|
| Service discovery | Container DNS names | Kubernetes Service DNS |
| Scaling | Manual (`--scale`) | `replicas: 3` in Deployment |
| Health management | Restart policies | Liveness + Readiness probes |
| Config/Secrets | Environment in compose file | ConfigMap + Secret resources |
| Storage | Named volumes | PersistentVolumeClaim |
| Networking | Single bridge network | ClusterIP Services |

Spring Boot Actuator is enabled (`/actuator/health`) in all services for Kubernetes liveness/readiness probes:
```yaml
livenessProbe:
  httpGet:
    path: /actuator/health/liveness
    port: 8081
readinessProbe:
  httpGet:
    path: /actuator/health/readiness
    port: 8081
```

---

## Security Hardening for Production

The current setup is configured for development convenience. Production requires:

### 1. Change the JWT Secret
```bash
# Generate a secure random secret
openssl rand -base64 64
# Set in all services: JWT_SECRET=<generated value>
```
All services share the same JWT secret. They all need the identical value to validate tokens signed by auth-service.

### 2. Change Database Passwords
```bash
DB_PASSWORD=$(openssl rand -base64 32)
# Set in docker-compose.yml or Kubernetes Secrets
```

### 3. Configure Real SMTP Credentials
For Gmail: enable 2FA → generate an App Password → use it as `SMTP_PASSWORD`.
For production: use a proper email service (SendGrid, AWS SES, Mailgun) instead of personal Gmail.

### 4. Set FRONTEND_URL
```bash
FRONTEND_URL=https://procurement.yourcompany.com
```
This affects:
- CORS allowed origins (only your domain can call the API)
- Password reset email links (link points to your domain)

### 5. Migrate to Flyway
Replace `ddl-auto: update` with Flyway:
```xml
<!-- pom.xml -->
<dependency>
  <groupId>org.flywaydb</groupId>
  <artifactId>flyway-core</artifactId>
</dependency>
```
```yaml
spring.flyway.enabled: true
spring.jpa.hibernate.ddl-auto: validate  # just validate, don't modify
```
Create versioned migration scripts in `src/main/resources/db/migration/V1__init.sql`.

### 6. TLS/HTTPS
In production, the api-gateway should be behind an nginx or cloud load balancer that terminates TLS. The internal Docker network remains HTTP (services don't need TLS between themselves since they're on a private network).

---

## Monitoring and Observability

### Spring Boot Actuator (Built-in)
All services expose `/actuator/health` and `/actuator/info`. The health endpoint checks:
- Database connectivity
- Redis connectivity
- Kafka connectivity

### Application Logs
Services log to stdout (Docker captures it via `docker logs <container>`). In production:
- Use a log aggregator (ELK Stack, Grafana Loki, AWS CloudWatch)
- Structured JSON logging for searchability

### Kafka Message Tracing
Failed Kafka events go to Dead Letter Topics (`<topic>-dlt`). Check them with:
```bash
docker exec -it <kafka-container> kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic po.approved-dlt \
  --from-beginning
```

### Redis Monitoring
```bash
docker exec -it redis-vendor redis-cli info stats
# Shows hits, misses, evictions, memory usage
```

---

## Database Access for Development

Each PostgreSQL database is exposed on the host for debugging:

```bash
# Connect to auth database (uses psql or DBeaver)
psql -h localhost -p 5432 -U postgres -d authdb

# Connect to vendor database
psql -h localhost -p 5433 -U postgres -d vendordb

# View all tenants
psql -h localhost -p 5432 -U postgres -d authdb -c "SELECT * FROM tenants;"

# View all users with their roles
psql -h localhost -p 5432 -U postgres -d authdb \
  -c "SELECT u.email, r.role_name, u.tenant_id FROM users u JOIN roles r ON u.role_id = r.role_id;"
```

### DataInitializer

On first startup, `auth-service/DataInitializer.java` seeds the database:

```java
// Creates default tenant
Tenant defaultTenant = Tenant.builder()
    .name("Default Organisation")
    .domain("default")
    .status(TenantStatus.ACTIVE)
    .subscriptionPlan(SubscriptionPlan.PRO)
    .build();

// Creates SUPER_ADMIN user
User superAdmin = User.builder()
    .email("admin@procurepro.com")
    .passwordHash(passwordEncoder.encode("Admin@123"))
    .fullName("System Administrator")
    .role(superAdminRole)
    .tenantId(defaultTenant.getTenantId())
    .accountLocked(false)
    .build();
```

**Default login credentials (development only):**
- Email: `admin@procurepro.com`
- Password: `Admin@123`

Change these immediately in any non-local environment.
