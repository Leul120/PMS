#!/usr/bin/env pwsh
# Quick test script to verify the Procurement System is working

$ErrorActionPreference = "Continue"

Write-Host "=== Quick Test - Procurement System ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$BaseUrl = "http://localhost:8080"
$AuthUrl = "$BaseUrl/api/auth"

Write-Host "Testing Docker Compose setup..." -ForegroundColor White
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
Write-Host ""

# Test 1: Health Check
Write-Host "Test 1: API Gateway Health" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/actuator/health" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "  ✓ API Gateway is up" -ForegroundColor Green
    Write-Host "    Status: $($response.status)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ API Gateway not responding" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Gray
}

# Test 2: Auth Service - Register Admin
Write-Host ""
Write-Host "Test 2: Auth Service - Register Admin User" -ForegroundColor Yellow
$adminUser = @{
    fullName = "Admin User"
    email = "admin@procurement.com"
    password = "admin123"
    phoneNumber = "+1234567890"
    roleName = "ADMIN"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$AuthUrl/register" -Method POST -ContentType "application/json" -Body $adminUser -TimeoutSec 10
    Write-Host "  ✓ Admin registered successfully" -ForegroundColor Green
    Write-Host "    User ID: $($response.userId)" -ForegroundColor Gray
} catch {
    if ($_.Exception.Response.StatusCode -eq 409 -or $_.ToString().Contains("already exists")) {
        Write-Host "  ℹ Admin user already exists (expected)" -ForegroundColor Yellow
    } else {
        Write-Host "  ✗ Registration failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 3: Auth Service - Login
Write-Host ""
Write-Host "Test 3: Auth Service - Login" -ForegroundColor Yellow
$loginRequest = @{
    email = "admin@procurement.com"
    password = "admin123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$AuthUrl/login" -Method POST -ContentType "application/json" -Body $loginRequest -TimeoutSec 10
    Write-Host "  ✓ Login successful" -ForegroundColor Green
    Write-Host "    Token: $($response.accessToken.Substring(0, 30))..." -ForegroundColor Gray
    Write-Host "    Role: $($response.role)" -ForegroundColor Gray
    
    # Save token for future tests
    $global:JwtToken = $response.accessToken
} catch {
    Write-Host "  ✗ Login failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Create Vendor
if ($global:JwtToken) {
    Write-Host ""
    Write-Host "Test 4: Vendor Service - Create Category" -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $global:JwtToken"
        "Content-Type" = "application/json"
    }
    
    $category = @{
        categoryName = "IT Services"
        description = "Information technology services and software"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/categories" -Method POST -Headers $headers -Body $category -TimeoutSec 10
        Write-Host "  ✓ Category created" -ForegroundColor Green
        Write-Host "    Category ID: $($response.categoryId)" -ForegroundColor Gray
    } catch {
        if ($_.ToString().Contains("already")) {
            Write-Host "  ℹ Category may already exist" -ForegroundColor Yellow
        } else {
            Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # Test 5: List Vendors
    Write-Host ""
    Write-Host "Test 5: Vendor Service - List Vendors" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/vendors" -Method GET -Headers $headers -TimeoutSec 10
        Write-Host "  ✓ Retrieved vendors" -ForegroundColor Green
        Write-Host "    Count: $($response.Count)" -ForegroundColor Gray
    } catch {
        Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 6: RFQ Service
if ($global:JwtToken) {
    Write-Host ""
    Write-Host "Test 6: RFQ Service - Create RFQ" -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $global:JwtToken"
        "Content-Type" = "application/json"
    }
    
    $rfq = @{
        title = "Office Supplies Q2 2024"
        description = "Procurement of office supplies for Q2"
        deadline = (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ss")
        estimatedValue = 5000.00
        categoryId = 1
        expectedQuantity = 100
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/rfqs" -Method POST -Headers $headers -Body $rfq -TimeoutSec 10
        Write-Host "  ✓ RFQ created" -ForegroundColor Green
        Write-Host "    RFQ ID: $($response.rfqId)" -ForegroundColor Gray
        $global:RfqId = $response.rfqId
    } catch {
        Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 7: List RFQs
    if ($global:RfqId) {
        Write-Host ""
        Write-Host "Test 7: RFQ Service - List RFQs" -ForegroundColor Yellow
        try {
            $response = Invoke-RestMethod -Uri "$BaseUrl/api/rfqs" -Method GET -Headers $headers -TimeoutSec 10
            Write-Host "  ✓ Retrieved RFQs" -ForegroundColor Green
            Write-Host "    Count: $($response.Count)" -ForegroundColor Gray
        } catch {
            Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Summary
Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you see ✓ above, your system is working!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Open API Gateway: http://localhost:8080" -ForegroundColor Yellow
Write-Host "  2. Test with Swagger UI (if configured)" -ForegroundColor Yellow
Write-Host "  3. Check Docker: docker-compose ps" -ForegroundColor Yellow
Write-Host "  4. View logs: docker-compose logs -f auth-service" -ForegroundColor Yellow
Write-Host ""
Write-Host "To test Kubernetes deployment:" -ForegroundColor White
Write-Host "  cd scripts; .\deploy-to-k8s.ps1" -ForegroundColor Yellow
