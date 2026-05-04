#!/usr/bin/env pwsh
# Setup script for local Kubernetes (k3s in Docker)
# This configures kubectl to use the k3s cluster running in Docker Compose

$ErrorActionPreference = "Stop"

Write-Host "=== Procurement System - Kubernetes Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if k3s-output directory exists
if (!(Test-Path "../k3s-output")) {
    Write-Host "Waiting for k3s to generate kubeconfig..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}

$KubeconfigPath = "../k3s-output/kubeconfig.yaml"

# Wait for kubeconfig to be generated
$retryCount = 0
$maxRetries = 30
while (!(Test-Path $KubeconfigPath) -and $retryCount -lt $maxRetries) {
    Write-Host "Waiting for kubeconfig... ($retryCount/$maxRetries)" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    $retryCount++
}

if (!(Test-Path $KubeconfigPath)) {
    Write-Host "ERROR: kubeconfig not found. Is k3s-server running?" -ForegroundColor Red
    Write-Host "Run: docker-compose up -d k3s-server" -ForegroundColor Yellow
    exit 1
}

# Configure kubectl
$Env:KUBECONFIG = (Resolve-Path $KubeconfigPath).Path
Write-Host "✓ Kubeconfig set to: $Env:KUBECONFIG" -ForegroundColor Green

# Replace localhost with k3s-server for Docker networking
(Get-Content $KubeconfigPath) -replace 'https://localhost:6443', 'https://k3s-server:6443' | Set-Content $KubeconfigPath
Write-Host "✓ Updated server address for Docker networking" -ForegroundColor Green

# Test connection
Write-Host ""
Write-Host "Testing cluster connection..." -ForegroundColor Cyan
try {
    $nodes = kubectl get nodes -o name 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Connected to Kubernetes cluster" -ForegroundColor Green
        Write-Host "Nodes: $nodes" -ForegroundColor Gray
    } else {
        Write-Host "⚠ Could not connect to cluster. Retrying in 5 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        kubectl get nodes
    }
} catch {
    Write-Host "⚠ Could not connect to cluster. You may need to wait for k3s to fully start." -ForegroundColor Yellow
}

# Show status
Write-Host ""
Write-Host "=== Cluster Status ===" -ForegroundColor Cyan
kubectl get nodes
Write-Host ""
kubectl get pods -n procurement 2>$null || Write-Host "No pods in procurement namespace yet (manifests are being applied)" -ForegroundColor Yellow

Write-Host ""
Write-Host "=== Usage ===" -ForegroundColor Cyan
Write-Host "Set environment variable in this session:" -ForegroundColor White
Write-Host "  `$Env:KUBECONFIG = `"$((Resolve-Path $KubeconfigPath).Path)`"" -ForegroundColor Yellow
Write-Host ""
Write-Host "Or in your PowerShell profile:" -ForegroundColor White
Write-Host "  [Environment]::SetEnvironmentVariable('KUBECONFIG', '$((Resolve-Path $KubeconfigPath).Path)', 'User')" -ForegroundColor Yellow
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor White
Write-Host "  kubectl get pods -n procurement" -ForegroundColor Yellow
Write-Host "  kubectl get svc -n procurement" -ForegroundColor Yellow
Write-Host "  kubectl port-forward svc/api-gateway 8080:80 -n procurement" -ForegroundColor Yellow
