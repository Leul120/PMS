# Kubernetes Deployment Guide

## Overview

Complete Kubernetes manifests for deploying the full ProcurePro stack: 10 microservices, 8 PostgreSQL instances, 9 Redis instances, Kafka, the Next.js frontend, Kafka UI, and the Kubernetes Dashboard.

## Manifest Inventory

```
k8s/
├── namespace.yaml               Procurement namespace
├── secrets.yaml                 JWT RSA keys, DB passwords
├── configmap.yaml               Service URLs, Kafka config, app settings
│
├── redis.yaml                   Shared Redis (api-gateway rate limiting)
├── redis-services.yaml          9 per-service Redis instances
│
├── postgres-auth.yaml           authdb        (auth-service)
├── postgres-vendor.yaml         vendordb      (vendor-service)
├── postgres-rfq.yaml            rfqdb         (rfq-bidding-service)
├── postgres-procurement.yaml    procurementdb (procurement-service)
├── postgres-delivery.yaml       deliverydb    (delivery-invoice-service)
├── postgres-scoring.yaml        scoringdb     (scoring-service)
├── postgres-inventory.yaml      inventorydb   (inventory-service)
├── postgres-notification.yaml   notificationdb (notification-service)
│
├── kafka.yaml                   Kafka + Zookeeper
│
├── auth-service.yaml            :8081  (holds RSA private key)
├── vendor-service.yaml          :8082
├── rfq-bidding-service.yaml     :8083
├── procurement-service.yaml     :8084
├── delivery-invoice-service.yaml :8085
├── scoring-service.yaml         :8086
├── analytics-service.yaml       :8087  (Redis-only, no DB)
├── inventory-service.yaml       :8088
├── notification-service.yaml    :8089
├── api-gateway.yaml             :8080
├── frontend.yaml                :3000
│
├── kafka-ui.yaml                Kafka web UI (provectuslabs/kafka-ui)
├── kubernetes-dashboard.yaml    Kubernetes web UI
│
├── metallb.yaml                 MetalLB load balancer config
├── ingress.yaml                 NGINX Ingress routing rules
└── kustomization.yaml           Kustomize entrypoint (apply everything with one command)
```

---

## Security Model: RS256 Asymmetric JWT

The Kubernetes deployment uses RSA-256 instead of the HMAC-SHA256 used in Docker Compose. The difference:

| | HS256 (Docker Compose) | RS256 (Kubernetes) |
|---|---|---|
| Key type | One shared secret | RSA key pair |
| Who can sign | Any service that has the secret | Only auth-service (holds private key) |
| Who can verify | Any service | Any service (public key is safe to share) |
| Risk if a service is compromised | Attacker can forge tokens for any user | Attacker can only read tokens, not forge them |

**Implementation:**
- `auth-service` mounts the **RSA private key** via K8s Secret → signs JWTs.
- All other services mount only the **RSA public key** → can verify but never forge.

---

## Prerequisites

- Kubernetes cluster v1.24+
- `kubectl` configured
- NGINX Ingress Controller installed (`kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/...`)
- A storage provisioner for PVCs (built-in in most managed clusters; use `local-path-provisioner` for bare-metal)
- MetalLB for bare-metal LoadBalancer support (already included in `metallb.yaml`)

---

## Step 1 — Generate RSA Keys

```bash
# Generate RSA private key
openssl genrsa -out jwt-private.pem 2048

# Extract public key
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Print base64 values to paste into secrets.yaml
echo "Private key:"; cat jwt-private.pem
echo "Public key:";  cat jwt-public.pem
```

Edit `secrets.yaml` and replace the placeholder RSA key blocks with your generated keys.

Also change all `secret` password values in `secrets.yaml` before deploying to any non-local environment.

---

## Step 2 — Deploy

### Option A: Kustomize (recommended — deploys everything in one command)

```bash
kubectl apply -k k8s/
```

Kustomize applies all resources in dependency order. Wait ~3 minutes for all pods to reach `Running` state.

### Option B: Manual order (if debugging a specific layer)

```bash
# 1. Foundation
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml

# 2. Storage
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/redis-services.yaml
kubectl apply -f k8s/postgres-auth.yaml
kubectl apply -f k8s/postgres-vendor.yaml
kubectl apply -f k8s/postgres-rfq.yaml
kubectl apply -f k8s/postgres-procurement.yaml
kubectl apply -f k8s/postgres-delivery.yaml
kubectl apply -f k8s/postgres-scoring.yaml
kubectl apply -f k8s/postgres-inventory.yaml
kubectl apply -f k8s/postgres-notification.yaml
kubectl apply -f k8s/kafka.yaml

# 3. Services (wait for DB pods to be Ready first)
kubectl apply -f k8s/auth-service.yaml
kubectl apply -f k8s/vendor-service.yaml
kubectl apply -f k8s/rfq-bidding-service.yaml
kubectl apply -f k8s/procurement-service.yaml
kubectl apply -f k8s/delivery-invoice-service.yaml
kubectl apply -f k8s/scoring-service.yaml
kubectl apply -f k8s/analytics-service.yaml
kubectl apply -f k8s/inventory-service.yaml
kubectl apply -f k8s/notification-service.yaml
kubectl apply -f k8s/api-gateway.yaml
kubectl apply -f k8s/frontend.yaml

# 4. Tooling & Networking
kubectl apply -f k8s/kafka-ui.yaml
kubectl apply -f k8s/metallb.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## Step 3 — Verify

```bash
# All pods should be Running (takes ~2-3 min)
kubectl get pods -n procurement

# Check services
kubectl get svc -n procurement

# Check ingress routes
kubectl get ingress -n procurement

# Tail logs for a specific service
kubectl logs -f deployment/auth-service -n procurement

# Describe a crashing pod
kubectl describe pod <pod-name> -n procurement
```

---

## Accessing the Applications

### Add to `/etc/hosts` (for local cluster)

```
127.0.0.1  procurement.local
```

### Application URLs

| Application | URL | Notes |
|---|---|---|
| **Frontend** | http://procurement.local | Main web UI |
| **API Gateway** | http://procurement.local/api | All backend API calls |
| **Kafka UI** | http://procurement.local/kafka-ui | Browse topics, messages, consumers |
| **Kubernetes Dashboard** | https://\<node-ip\>:30443 | Pod/deployment management |

### Port-forward for local testing (no Ingress needed)

```bash
# Frontend
kubectl port-forward svc/frontend 3000:3000 -n procurement

# API Gateway
kubectl port-forward svc/api-gateway 8080:8080 -n procurement

# Kafka UI
kubectl port-forward svc/kafka-ui 8090:80 -n procurement
# → open http://localhost:8090

# Kubernetes Dashboard
kubectl port-forward svc/kubernetes-dashboard 8443:443 -n kubernetes-dashboard
# → open https://localhost:8443
```

---

## Kafka UI

Kafka UI (by Provectus) gives you a browser-based view of:
- All topics and their message counts
- Browse individual messages (with JSON formatting)
- Consumer groups and their lag
- Broker and cluster health

**Deploy:**
```bash
kubectl apply -f k8s/kafka-ui.yaml
```

**Access:**
```bash
kubectl port-forward svc/kafka-ui 8090:80 -n procurement
# open http://localhost:8090
```

**Topics you'll see:**
- `vendor.verified`, `rfq.published`, `bid.submitted`
- `po.approved`, `delivery.completed`, `invoice.discrepancy`
- `score.updated`
- Dead-letter topics: `<topic>-dlt` (appear after first consumer failure)

---

## Kubernetes Dashboard

The dashboard (deployed to its own `kubernetes-dashboard` namespace) gives you a browser-based view of:
- All pods, deployments, services, and ingresses
- Real-time CPU and memory usage per pod
- Container logs (same as `kubectl logs`)
- Exec into containers (same as `kubectl exec -it`)
- Apply/edit YAML resources in-browser

**Deploy:**
```bash
kubectl apply -f k8s/kubernetes-dashboard.yaml
```

**Get a login token:**
```bash
kubectl -n kubernetes-dashboard create token admin-user
# Copy the printed token — paste it into the dashboard login screen
```

**Access via NodePort (always available):**
```
https://<node-ip>:30443
```

**Access via port-forward:**
```bash
kubectl port-forward svc/kubernetes-dashboard 8443:443 -n kubernetes-dashboard
# open https://localhost:8443 (accept the self-signed cert warning)
```

> **Note:** The `admin-user` ServiceAccount has `cluster-admin` access — full read/write on the entire cluster. For a shared or production cluster, create a namespace-scoped Role instead.

---

## Scaling

```bash
# Scale a single service
kubectl scale deployment vendor-service --replicas=3 -n procurement

# Horizontal Pod Autoscaler (CPU-based)
kubectl autoscale deployment auth-service --min=2 --max=5 --cpu-percent=70 -n procurement

# Check HPA status
kubectl get hpa -n procurement
```

---

## Rolling Updates

```bash
# Update to a new image tag
kubectl set image deployment/auth-service \
  auth-service=procurement/auth-service:v2 -n procurement

# Watch the rollout
kubectl rollout status deployment/auth-service -n procurement

# Rollback
kubectl rollout undo deployment/auth-service -n procurement
```

---

## Troubleshooting

**Pod stuck in `Pending`:**
```bash
kubectl describe pod <pod-name> -n procurement
# Common cause: no PVC storage available → check your storage provisioner
```

**Pod in `CrashLoopBackOff`:**
```bash
kubectl logs <pod-name> -n procurement --previous
# Common causes: DB not ready yet (wait), wrong DB URL, missing secret
```

**Service unreachable:**
```bash
kubectl get endpoints -n procurement
# If endpoint list is empty, the pod selector labels don't match the service selector

kubectl exec -it deployment/api-gateway -n procurement -- nslookup auth-service
# Tests internal DNS resolution
```

**JWT validation failing on non-auth services:**
```bash
# Check the public key is mounted
kubectl exec -it deployment/vendor-service -n procurement \
  -- cat /etc/jwt-keys/jwt-public.pem
```

**Kafka consumer not processing events:**
```bash
# Check consumer group lag in Kafka UI or via CLI:
kubectl exec -it deployment/kafka -n procurement \
  -- kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
     --group notification-service-group --describe
# Look for LAG > 0 — means messages are queued but not processed
```

---

## Security Checklist Before Production

- [ ] Replace all `secret` passwords in `secrets.yaml` with strong random values
- [ ] Replace RSA key placeholders with real generated keys
- [ ] Enable HTTPS on Ingress (`tls` block in `ingress.yaml` + a real TLS cert via cert-manager)
- [ ] Set `SMTP_USERNAME` and `SMTP_PASSWORD` secrets for email notifications
- [ ] Set `FRONTEND_URL` in `configmap.yaml` to your real domain
- [ ] Restrict Kubernetes Dashboard ServiceAccount to namespace-scoped Role
- [ ] Enable NetworkPolicies to restrict pod-to-pod traffic
- [ ] Set `imagePullPolicy: Always` and use specific image tags instead of `latest`

---

## Cleanup

```bash
# Remove all procurement resources (keeps kubernetes-dashboard)
kubectl delete namespace procurement

# Remove Kubernetes Dashboard
kubectl delete namespace kubernetes-dashboard

# Or remove everything applied by kustomize
kubectl delete -k k8s/
```
