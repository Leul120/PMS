# Kubernetes with Docker Compose

This guide explains how to run a **local Kubernetes cluster (k3s)** inside Docker alongside your microservices.

## Quick Start

### 1. Start Everything (Docker + Kubernetes)

```powershell
# Start all services including k3s
docker-compose up -d

# Wait for k3s to be ready (about 30-60 seconds)
Start-Sleep -Seconds 30

# Setup kubectl
cd scripts
.\setup-k8s.ps1

# Deploy to Kubernetes
.\deploy-to-k8s.ps1
```

### 2. Access the Application

```powershell
# Port forward API Gateway
kubectl port-forward svc/api-gateway 8080:80 -n procurement

# In another terminal, test the API
curl http://localhost:8080/api/auth/login
```

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    Docker Compose Network                      │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │   Kafka     │  │ PostgreSQL  │  │   Microservices     │    │
│  │  (9092)     │  │   (6x)      │  │  (8081-8088)        │    │
│  └─────────────┘  └─────────────┘  └─────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              k3s-server (Kubernetes)                   │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │         Kubernetes Control Plane                 │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │  │  │
│  │  │  │   API   │ │  etcd   │ │ Controller Mgr  │ │  │  │
│  │  │  │ Server  │ │         │ │                 │ │  │  │
│  │  │  └─────────┘ └─────────┘ └─────────────────┘ │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  Auto-deployed manifests from ./k8s/ folder             │  │
│  │  - Deployments, Services, ConfigMaps, Secrets          │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## What's Happening?

1. **k3s-server** starts a full Kubernetes control plane inside a Docker container
2. The `./k8s/` folder is mounted to `/var/lib/rancher/k3s/server/manifests/procurement`
3. k3s **automatically applies** all YAML files in that folder (auto-deploy feature)
4. Your Docker images are loaded into k3s's internal containerd runtime
5. Kubernetes manages your microservices with replicas, health checks, etc.

## Useful Commands

### Check Kubernetes Status
```powershell
# Set kubeconfig
$Env:KUBECONFIG = "$PWD\k3s-output\kubeconfig.yaml"

# View nodes
kubectl get nodes

# View all pods
kubectl get pods -n procurement

# View services
kubectl get svc -n procurement

# View logs
kubectl logs -f deployment/auth-service -n procurement
```

### Scale Services
```powershell
# Scale auth-service to 3 replicas
kubectl scale deployment auth-service --replicas=3 -n procurement

# Check rollout status
kubectl rollout status deployment/auth-service -n procurement
```

### Restart Deployments
```powershell
# Restart all deployments
kubectl rollout restart deployment -n procurement

# Restart specific service
kubectl rollout restart deployment vendor-service -n procurement
```

### Troubleshooting
```powershell
# Check pod events
kubectl describe pod <pod-name> -n procurement

# Get pod logs
kubectl logs <pod-name> -n procurement

# Previous container logs (if crashed)
kubectl logs <pod-name> -n procurement --previous

# Execute into pod
kubectl exec -it <pod-name> -n procurement -- /bin/sh
```

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `scripts/setup-k8s.ps1` | Configure kubectl to use k3s |
| `scripts/load-images-to-k3s.ps1` | Build and load Docker images into k3s |
| `scripts/deploy-to-k8s.ps1` | Deploy all manifests to Kubernetes |

## Two Ways to Run

### Option A: Docker Compose Only (Traditional)
```powershell
docker-compose up -d
# Access via localhost:8080-8088 directly
```

### Option B: Kubernetes via k3s (Recommended)
```powershell
docker-compose up -d k3s-server  # Start k3s
.\scripts\setup-k8s.ps1         # Configure kubectl
.\scripts\deploy-to-k8s.ps1     # Deploy to K8s
kubectl port-forward svc/api-gateway 8080:80 -n procurement
```

## Key Differences: Docker vs Kubernetes

| Feature | Docker Compose | Kubernetes (k3s) |
|---------|---------------|-------------------|
| **Orchestration** | Single instance | Multi-replica, auto-healing |
| **Scaling** | Manual `docker-compose up --scale` | `kubectl scale deployment` |
| **Health Checks** | Basic Docker healthcheck | Liveness + Readiness probes |
| **Service Discovery** | Docker DNS | CoreDNS |
| **Secrets** | Environment variables | Kubernetes Secrets |
| **Config** | Environment variables | ConfigMaps |
| **Load Balancing** | Docker internal | kube-proxy |
| **Rolling Updates** | Manual | Automated rollouts |

## Persistent Data

k3s stores data in Docker volumes:
- `k3s-server-data` - Kubernetes state, etcd
- `k3s-agent-data` - Worker node state

To reset everything:
```powershell
docker-compose down -v  # Removes volumes too
docker-compose up -d k3s-server
```

## Accessing k3s from Outside Docker

The kubeconfig is generated at `./k3s-output/kubeconfig.yaml`. To use with your local kubectl:

```powershell
# Copy kubeconfig to default location
copy .\k3s-output\kubeconfig.yaml $Env:USERPROFILE\.kube\config

# Or set environment variable
[Environment]::SetEnvironmentVariable('KUBECONFIG', "$PWD\k3s-output\kubeconfig.yaml", 'User')

# Test
kubectl get nodes
```

## Port Mapping

| Port | Service |
|------|---------|
| 6443 | Kubernetes API Server |
| 8081-8090 | NodePort range for services |

To expose a service externally:
```powershell
# Edit k8s/api-gateway.yaml - change to NodePort
kubectl patch svc api-gateway -n procurement -p '{"spec":{"type":"NodePort"}}'

# Get NodePort
kubectl get svc api-gateway -n procurement
# Access via localhost:30080 (mapped to 8081)
```

## Stopping Everything

```powershell
# Stop but keep data
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop and remove everything including volumes
docker-compose down -v
```

## Troubleshooting

### k3s-server won't start
```powershell
# Check logs
docker logs k3s-server

# Usually needs privileged mode - make sure Docker Desktop allows it
# Settings -> General -> "Use the WSL 2 based engine"
# Settings -> Resources -> WSL Integration -> Enable for your distro
```

### Images won't load
```powershell
# Check if k3s containerd is working
docker exec k3s-server ctr images list

# Manual image import
docker save procurement/auth-service:latest | docker exec -i k3s-server ctr images import -
```

### Pods stuck in Pending
```powershell
# Check events
kubectl get events -n procurement

# Usually resource constraints or missing images
kubectl describe pod <pod-name> -n procurement
```

## Next Steps

- Add **Helm** charts for templating
- Install **Istio** or **Linkerd** for service mesh
- Add **Prometheus** + **Grafana** for monitoring
- Set up **GitOps** with ArgoCD or Flux
