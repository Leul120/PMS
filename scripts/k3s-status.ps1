#!/usr/bin/env pwsh
# Check k3s status and configure kubectl

Write-Host "=== k3s Status Check ===" -ForegroundColor Cyan
Write-Host ""

# Check if k3s is running
$container = docker ps --filter "name=k3s-server" --format "{{.Names}}: {{.Status}}"
if ($container) {
    Write-Host "✓ k3s container: $container" -ForegroundColor Green
} else {
    Write-Host "✗ k3s-server is not running" -ForegroundColor Red
    Write-Host "  Start it: docker-compose up -d k3s-server" -ForegroundColor Yellow
    exit 1
}

# Check for kubeconfig
$KubeconfigPath = "$PWD/../k3s-output/kubeconfig.yaml"
$retry = 0
while (!(Test-Path $KubeconfigPath) -and $retry -lt 30) {
    Write-Host "Waiting for kubeconfig... ($retry/30)" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    $retry++
}

if (!(Test-Path $KubeconfigPath)) {
    Write-Host "⚠ kubeconfig not found yet - k3s may still be starting" -ForegroundColor Yellow
    Write-Host "  Retrying in 10 seconds..." -ForegroundColor Gray
    exit 1
}

# Configure kubectl
$Env:KUBECONFIG = (Resolve-Path $KubeconfigPath).Path
Write-Host "✓ kubeconfig found" -ForegroundColor Green

# Update server address for Docker network
(Get-Content $KubeconfigPath) -replace 'https://localhost:6443', 'https://k3s-server:6443' -replace '127.0.0.1', 'k3s-server' | Set-Content $KubeconfigPath

# Test connection
try {
    $nodes = kubectl get nodes -o name 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ kubectl connected to k3s" -ForegroundColor Green
        Write-Host ""
        Write-Host "=== Nodes ===" -ForegroundColor Cyan
        kubectl get nodes
        
        Write-Host ""
        Write-Host "=== Pods (procurement namespace) ===" -ForegroundColor Cyan
        kubectl get pods -n procurement 2>$null || Write-Host "  (no pods yet - still deploying)" -ForegroundColor Yellow
        
        Write-Host ""
        Write-Host "=== Services ===" -ForegroundColor Cyan
        kubectl get svc -n procurement 2>$null || Write-Host "  (no services yet)" -ForegroundColor Yellow
    } else {
        Write-Host "⚠ kubectl connection pending..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ kubectl not ready yet: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "To use kubectl, set this environment variable:" -ForegroundColor White
Write-Host "  `$Env:KUBECONFIG = \"$KubeconfigPath\"" -ForegroundColor Yellow
Write-Host ""
Write-Host "Port forward API Gateway:" -ForegroundColor White
Write-Host "  kubectl port-forward svc/api-gateway 8080:80 -n procurement" -ForegroundColor Yellow
