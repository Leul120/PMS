# Kubernetes Deployment Guide

## Overview

This directory contains complete Kubernetes manifests for deploying the Procurement Management System with **RS256 asymmetric JWT encryption**.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Ingress (Nginx)                       │
│              Routes traffic to API Gateway                   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│              Central entry point (Port 8080)                 │
└─────────────────────────────────────────────────────────────┘
                              │
    ┌──────────┬──────────┬──────────┬──────────┐
    │          │          │          │          │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│ Auth  │ │Vendor │ │ RFQ   │ │ Proc  │ │Scoring│
│ 8081  │ │ 8082  │ │ 8083  │ │ 8084  │ │ 8086  │
└───┬───┘ └───────┘ └───────┘ └───────┘ └───────┘
    │
    │ Signs JWT with RSA Private Key
    │ (Only auth-service has private key)
    │
    └──────────────────────┐
                           │
    ┌──────────────────────▼──────────────────────┐
    │          All Other Services                 │
    │     Verify JWT with RSA Public Key          │
    │  (Public key mounted via K8s Secret)        │
    └─────────────────────────────────────────────┘
```

## Security Model: RS256 Asymmetric Encryption

### Why RS256?

| Feature | HS256 (Symmetric) | RS256 (Asymmetric) |
|---------|-------------------|-------------------|
| Key Distribution | Same secret to ALL services | Private key stays in auth-service only |
| Compromise Risk | All services compromised if secret leaks | Only auth-service can sign tokens |
| Service Verification | Any service can forge tokens | Only auth-service can create valid tokens |
| Key Rotation | Must update ALL services | Only rotate auth-service keys |

### Implementation

1. **Auth Service**: Signs JWT with RSA Private Key (kept secret)
2. **All Other Services**: Verify JWT with RSA Public Key (shared safely)
3. **Key Distribution**: Via Kubernetes Secrets mounted as files
4. **JWKS Endpoint**: `/.well-known/jwks.json` for dynamic key rotation

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- NGINX Ingress Controller installed
- Storage provisioner (for PostgreSQL PVCs)

## Generate RSA Keys

```bash
# Generate 2048-bit RSA private key
openssl genrsa -out jwt-private.pem 2048

# Extract public key
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Base64 encode for Kubernetes Secret (remove headers)
openssl base64 -A -in jwt-private.pem > jwt-private.b64
openssl base64 -A -in jwt-public.pem > jwt-public.b64

# Update secrets.yaml with the base64-encoded keys
cat jwt-private.b64
cat jwt-public.b64
```

## Deployment

### Option 1: Using kubectl

```bash
# Apply all manifests
kubectl apply -f namespace.yaml
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml

# Deploy databases
kubectl apply -f postgres-auth.yaml
kubectl apply -f postgres-vendor.yaml
kubectl apply -f postgres-rfq.yaml
kubectl apply -f postgres-procurement.yaml
kubectl apply -f postgres-delivery.yaml
kubectl apply -f postgres-scoring.yaml

# Deploy infrastructure
kubectl apply -f kafka.yaml

# Deploy microservices
kubectl apply -f auth-service.yaml
kubectl apply -f vendor-service.yaml
kubectl apply -f rfq-bidding-service.yaml
kubectl apply -f procurement-service.yaml
kubectl apply -f delivery-invoice-service.yaml
kubectl apply -f scoring-service.yaml
kubectl apply -f analytics-service.yaml
kubectl apply -f notification-service.yaml
kubectl apply -f api-gateway.yaml

# Deploy ingress
kubectl apply -f ingress.yaml
```

### Option 2: Using Kustomize (Recommended)

```bash
# Deploy everything at once
kubectl apply -k .

# Or with kubectl 1.14+
kubectl apply -k https://github.com/your-repo/procurement-system/k8s
```

### Option 3: Using Helm (Future Enhancement)

```bash
# Package as Helm chart
helm package ./k8s

# Install
helm install procurement ./procurement-chart
```

## Verification

```bash
# Check all pods are running
kubectl get pods -n procurement

# Check services
kubectl get svc -n procurement

# Check ingress
kubectl get ingress -n procurement

# View logs for a specific service
kubectl logs -f deployment/auth-service -n procurement

# Port forward for local testing
kubectl port-forward svc/api-gateway 8080:80 -n procurement
```

## Accessing the Application

### Local (with port-forward)
```bash
kubectl port-forward svc/api-gateway 8080:80 -n procurement
curl http://localhost:8080/api/auth/login
```

### With Ingress
Add to `/etc/hosts`:
```
127.0.0.1 api.procurement.local
```

Then access:
```
https://api.procurement.local/api/auth/login
```

## Key Kubernetes Resources

### Secrets (`secrets.yaml`)
- `jwt-keys`: RSA private/public keys
- `db-credentials`: PostgreSQL passwords
- `kafka-credentials`: Kafka authentication (if enabled)

### ConfigMap (`configmap.yaml`)
- Service URLs for inter-service communication
- Kafka configuration
- JWT settings
- Application properties

### Deployments
Each microservice has:
- **2 replicas** for high availability
- **Resource limits** (CPU/Memory)
- **Health checks** (liveness/readiness probes)
- **JWT public key** mounted as volume
- **Environment variables** from ConfigMap and Secrets

### Services
- **ClusterIP** for internal communication
- Headless services for databases

### PersistentVolumeClaims
- 5Gi storage for each PostgreSQL instance

## Scaling

```bash
# Scale a specific service
kubectl scale deployment vendor-service --replicas=3 -n procurement

# Horizontal Pod Autoscaler (HPA) example
kubectl autoscale deployment auth-service --min=2 --max=5 --cpu-percent=70 -n procurement
```

## Updates

```bash
# Rolling update for a service
kubectl set image deployment/auth-service auth-service=procurement/auth-service:v2.0 -n procurement

# Check rollout status
kubectl rollout status deployment/auth-service -n procurement

# Rollback if needed
kubectl rollout undo deployment/auth-service -n procurement
```

## Monitoring

### Recommended Tools
- **Prometheus** + **Grafana** for metrics
- **ELK Stack** (Elasticsearch, Logstash, Kibana) for logs
- **Jaeger** for distributed tracing

### Example ServiceMonitor for Prometheus
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: procurement-metrics
  namespace: procurement
spec:
  selector:
    matchLabels:
      app: auth-service
  endpoints:
    - port: metrics
      path: /actuator/prometheus
```

## Troubleshooting

### Pod not starting
```bash
kubectl describe pod <pod-name> -n procurement
kubectl logs <pod-name> -n procurement --previous
```

### Service not reachable
```bash
kubectl get endpoints -n procurement
kubectl exec -it <pod-name> -n procurement -- nslookup <service-name>
```

### JWT validation failing
```bash
# Check if public key is mounted correctly
kubectl exec -it deployment/vendor-service -n procurement -- cat /etc/jwt-keys/jwt-public.key

# Check auth-service public key endpoint
curl http://auth-service:8081/.well-known/public-key
```

## Security Best Practices

1. **Use Network Policies** - Restrict pod-to-pod communication
2. **Pod Security Policies** - Run containers as non-root
3. **RBAC** - Limit service account permissions
4. **Secrets Management** - Use external secret management (Vault, AWS Secrets Manager)
5. **mTLS** - Enable mutual TLS between services (Istio/Linkerd)
6. **Image Scanning** - Scan images for vulnerabilities before deployment
7. **Resource Quotas** - Prevent resource exhaustion attacks

## Cleanup

```bash
# Delete all resources
kubectl delete namespace procurement

# Or delete specific resources
kubectl delete -k .
```

## Directory Structure

```
k8s/
├── README.md                    # This file
├── kustomization.yaml           # Kustomize configuration
├── namespace.yaml               # Namespace definition
├── secrets.yaml                 # Kubernetes Secrets
├── configmap.yaml               # Configuration
├── postgres-*.yaml              # 6 PostgreSQL StatefulSets
├── kafka.yaml                   # Kafka + Zookeeper
├── auth-service.yaml            # Auth service (with private key)
├── vendor-service.yaml          # Vendor service (public key only)
├── rfq-bidding-service.yaml     # RFQ service (public key only)
├── procurement-service.yaml     # Procurement service
├── delivery-invoice-service.yaml # Delivery service
├── scoring-service.yaml         # Scoring service
├── analytics-service.yaml       # Analytics service
├── notification-service.yaml    # Notification service
├── api-gateway.yaml             # API Gateway
└── ingress.yaml                 # NGINX Ingress rules
```
