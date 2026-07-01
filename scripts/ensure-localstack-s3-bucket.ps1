# Ensure LocalStack S3 bucket exists for document uploads (dev).
$ErrorActionPreference = "SilentlyContinue"
$endpoint = "http://localhost:4566"
$bucket = if ($env:AWS_BUCKET) { $env:AWS_BUCKET } else { "waytocanada-docs" }

for ($i = 0; $i -lt 15; $i++) {
    try {
        $health = Invoke-RestMethod -Uri "$endpoint/_localstack/health" -Method GET -TimeoutSec 3
        if ($health.services.s3 -eq "running" -or $health.services.s3 -eq "available") {
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
}

try {
    Invoke-WebRequest -Uri "$endpoint/$bucket" -Method PUT -UseBasicParsing -TimeoutSec 10 | Out-Null
    Write-Host ">>> S3 bucket ready: $bucket" -ForegroundColor Green
} catch {
    Write-Host ">>> Warning: could not create S3 bucket '$bucket' on LocalStack." -ForegroundColor Yellow
    Write-Host "    Document uploads will fall back to local disk storage." -ForegroundColor Yellow
}
