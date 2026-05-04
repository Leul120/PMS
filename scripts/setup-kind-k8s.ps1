#!/usr/bin/env pwsh
# Setup Kubernetes using kind (Kubernetes IN Docker)
# This is the recommended way to run K8s on Docker Desktop for Windows

$ErrorActionPreference = "Stop"

Write-Host "=== Setting up Kubernetes with kind ===" -ForegroundColor Cyan
Write-Host ""

# Check if kind is installed
$kindExists = Get-Command kind -ErrorAction SilentlyContinue
if (!$kindExists) {
    Write-Host "kind is not installed. Installing..." -ForegroundColor Yellow
    
    # Download kind for Windows
    $kindUrl = "https://kind.sigs.k8s.io/dl/v0.22.0/kind-windows-amd64"
    $kindPath = "$Env:USERPROFILE\bin\kind.exe"
    
    # Create bin directory if not exists
    if (!(Test-Path "$Env:USERPROFILE\bin")) {
        New-Item -ItemType Directory -Path "$Env:USERPROFILE\bin" -Force | Out-Null
    }
    
    # Download kind
    try {
        Invoke-WebRequest -Uri $kindUrl -OutFile $kindPath
        Write-Host "✓ kind downloaded to $kindPath" -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed to download kind. Please install manually from https://kind.sigs.k8s.io/" -ForegroundColor Red
        exit 1
    }
    
    # Add to PATH if not already there
    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($userPath -notlike "*$Env:USERPROFILE\bin*") {
        [Environment]::SetEnvironmentVariable("PATH", "$userPath;$Env:USERPROFILE\bin", "User")
        Write-Host "✓ Added $Env:USERPROFILE\bin to PATH" -ForegroundColor Green
        $Env:PATH = "$Env:PATH;$Env:USERPROFILE\bin"
    }
}

Write-Host "✓ kind is installed" -ForegroundColor Green

# Check if kubectl is installed
$kubectlExists = Get-Command kubectl -ErrorAction SilentlyContinue
if (!$kubectlExists) {
    Write-Host "kubectl is not installed. Please install kubectl from https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/" -ForegroundColor Yellow
    Write-Host "  Or run: winget install Kubernetes.kubectl" -ForegroundColor Gray
}

# Create kind cluster config
$kindConfig = @"
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: procurement
nodes:
  - role: control-plane
    extraPortMappings:
      # API Gateway
      - containerPort: 30080
        hostPort: 8080
        protocol: TCP
      # Auth Service
      - containerPort: 30081
        hostPort: 8081
        protocol: TCP
      # Vendor Service
      - containerPort: 30082
        hostPort: 8082
        protocol: TCP
      # Kafka
      - containerPort: 30092
        hostPort: 9092
        protocol: TCP
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
  - role: worker
  - role: worker
"@

$kindConfigPath = "$PWD/../kind-config.yaml"
$kindConfig | Out-File -FilePath $kindConfigPath -Encoding UTF8
Write-Host "✓ Created kind config: $kindConfigPath" -ForegroundColor Green

# Check if cluster already exists
$existingCluster = kind get clusters 2>$null | Select-String "procurement"
if ($existingCluster) {
    Write-Host "Cluster 'procurement' already exists. Deleting..." -ForegroundColor Yellow
    kind delete cluster --name procurement
}

# Create cluster
Write-Host ""
Write-Host "Creating kind cluster (this may take 2-3 minutes)..." -ForegroundColor Cyan
try {
    kind create cluster --name procurement --config $kindConfigPath
    Write-Host "✓ Cluster created successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to create cluster: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Set kubectl context
Write-Host ""
Write-Host "Configuring kubectl..." -ForegroundColor Cyan
kubectl cluster-info --context kind-procurement
Write-Host "✓ kubectl configured" -ForegroundColor Green

$manifests = @(
    "../k8s/secrets.yaml",
    "../k8s/configmap.yaml",
    "../k8s/redis.yaml",
    "../k8s/postgres-auth.yaml",
    "../k8s/rfq-bidding-service.yaml",
    "../k8s/procurement-service.yaml",
    "../k8s/delivery-invoice-service.yaml",
    "../k8s/scoring-service.yaml",
    "../k8s/analytics-service.yaml",
    "../k8s/notification-service.yaml",
    "../k8s/api-gateway.yaml",
    "../k8s/metallb.yaml",
    "../k8s/ingress.yaml"
)

foreach ($manifest in $manifests) {
    $manifestName = Split-Path $manifest -Leaf
    Write-Host "  Applying $manifestName..." -ForegroundColor Yellow
    kubectl apply -f $manifest -n procurement 2>$null || Write-Host "    (may need image loading first)" -ForegroundColor Gray
}

# Load Docker images into kind
Write-Host ""
Write-Host "Loading Docker images into kind..." -ForegroundColor Cyan
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

foreach ($service in $services) {
    Write-Host "  Loading $service..." -ForegroundColor Yellow
    kind load docker-image "procurement/$($service):latest" --name procurement 2>$null || 
        Write-Host "    (image may not exist yet, build with: docker-compose build $service)" -ForegroundColor Gray
}

# Show status
Write-Host ""
Write-Host "=== Deployment Status ===" -ForegroundColor Cyan
kubectl get pods -n procurement
Write-Host ""
kubectl get svc -n procurement

Write-Host ""
Write-Host "=== Kubernetes Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor White
Write-Host "  kubectl get pods -n procurement" -ForegroundColor Yellow
Write-Host "  kubectl port-forward svc/api-gateway 8080:80 -n procurement" -ForegroundColor Yellow
Write-Host "  kind delete cluster --name procurement  # To delete" -ForegroundColor Yellow
 get svc -nrcuemen" ForegroundColor Yellow
Write-Host "  kubectl port-elete" -ForegroundColor Yellow
Write-Host ""
Writ-Host "Access URLs:" -ForegroundCoor White
Writ-Hos "  NodPort: http://localhost:30080 (kind node port)" -ForegroundColor Yellow
Write-Host "  Port-forward: kubectl port-forward svc/api-gateway 8080:80 -n procurement