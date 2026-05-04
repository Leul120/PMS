#!/usr/bin/env pwsh
# Load Docker images into k3s container
# k3s runs its own containerd and can't see host Docker images directly

$ErrorActionPreference = "Stop"

Write-Host "=== Loading Docker Images into k3s ===" -ForegroundColor Cyan
Write-Host ""

$services = @(
    "auth-service",
    "vendor-service", 
    "rfq-bidding-service",
    "procurement-service",
    "delivery-invoice-service",
    "scoring-service",
    "analytics-service",
    "notification-service",
    "api-gateway"
)

# Check if k3s-server is running
$k3sRunning = docker ps -q -f name=k3s-server
if (!$k3sRunning) {
    Write-Host "ERROR: k3s-server container is not running!" -ForegroundColor Red
    Write-Host "Start it with: docker-compose up -d k3s-server" -ForegroundColor Yellow
    exit 1
}

foreach ($service in $services) {
    $imageTag = "procurement/$($service):latest"
    
    Write-Host "Processing $service..." -ForegroundColor White
    
    # Check if image exists locally
    $imageExists = docker images -q $imageTag
    if (!$imageExists) {
        Write-Host "  Building $imageTag..." -ForegroundColor Yellow
        docker build -t $imageTag "../$service"
    }
    
    # Save image to tar and load into k3s
    Write-Host "  Loading $imageTag into k3s..." -ForegroundColor Yellow
    docker save $imageTag | docker exec -i k3s-server ctr images import -
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Loaded successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to load" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== All images loaded ===" -ForegroundColor Green
Write-Host ""
Write-Host "Restart deployments to use new images:" -ForegroundColor White
Write-Host "  kubectl rollout restart deployment -n procurement" -ForegroundColor Yellow
