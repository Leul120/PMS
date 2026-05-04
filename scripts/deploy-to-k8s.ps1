#!/usr/bin/env pwsh
# Deploy Procurement System to local k3s Kubernetes

$ErrorActionPreference = "Stop"

Write-Host "=== Deploying Procurement System to Kubernetes ===" -ForegroundColor Cyan
Write-Host ""

# Setup kubectl
$KubeconfigPath = "../k3s-output/kubeconfig.yaml"
if (Test-Path $KubeconfigPath) {
    $Env:KUBECONFIG = (Resolve-Path $KubeconfigPath).Path
    Write-Host "✓ Using kubeconfig: $Env:KUBECONFIG" -ForegroundColor Green
} else {
    Write-Host "ERROR: kubeconfig not found. Run setup-k8s.ps1 first" -ForegroundColor Red
    exit 1
}

# Load images
Write-Host ""
Write-Host "Step 1: Building and loading Docker images..." -ForegroundColor Cyan
& "$PSScriptRoot/load-images-to-k3s.ps1"

# Create namespace
Write-Host ""
Write-Host "Step 2: Creating namespace..." -ForegroundColor Cyan
kubectl create namespace procurement --dry-run=client -o yaml | kubectl apply -f -

# Apply manifests
Write-Host ""
Write-Host "Step 3: Applying Kubernetes manifests..." -ForegroundColor Cyan
$manifests = @(
    "../k8s/secrets.yaml",
    "../k8s/configmap.yaml",
    "../k8s/postgres-auth.yaml",
    "../k8s/postgres-vendor.yaml",
    "../k8s/postgres-rfq.yaml",
    "../k8s/postgres-procurement.yaml",
    "../k8s/postgres-delivery.yaml",
    "../k8s/postgres-scoring.yaml",
    "../k8s/kafka.yaml",
    "../k8s/auth-service.yaml",
    "../k8s/vendor-service.yaml",
    "../k8s/rfq-bidding-service.yaml",
    "../k8s/procurement-service.yaml",
    "../k8s/delivery-invoice-service.yaml",
    "../k8s/scoring-service.yaml",
    "../k8s/analytics-service.yaml",
    "../k8s/notification-service.yaml",
    "../k8s/api-gateway.yaml"
)

foreach ($manifest in $manifests) {
    $manifestName = Split-Path $manifest -Leaf
    Write-Host "  Applying $manifestName..." -ForegroundColor Yellow
    kubectl apply -f $manifest
}

# Wait for deployments
Write-Host ""
Write-Host "Step 4: Waiting for deployments to be ready..." -ForegroundColor Cyan
$deployments = kubectl get deployments -n procurement -o name
foreach ($deployment in $deployments) {
    Write-Host "  Waiting for $deployment..." -ForegroundColor Yellow
    kubectl wait --for=condition=available --timeout=120s $deployment -n procurement 2>$null
}

# Show status
Write-Host ""
Write-Host "=== Deployment Status ===" -ForegroundColor Cyan
kubectl get pods -n procurement
Write-Host ""
kubectl get svc -n procurement

Write-Host ""
Write-Host "=== Access the Application ===" -ForegroundColor Cyan
Write-Host "Port forward API Gateway:" -ForegroundColor White
Write-Host "  kubectl port-forward svc/api-gateway 8080:80 -n procurement" -ForegroundColor Yellow
Write-Host ""
Write-Host "Then access:" -ForegroundColor White
Write-Host "  http://localhost:8080/api/auth/login" -ForegroundColor Yellow
