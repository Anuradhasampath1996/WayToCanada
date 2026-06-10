# Installs Stripe CLI to %LOCALAPPDATA%\stripe-cli
$version = "1.21.8"
$zip     = Join-Path $env:TEMP "stripe_cli.zip"
$dest    = Join-Path $env:LOCALAPPDATA "stripe-cli"
$url     = "https://github.com/stripe/stripe-cli/releases/download/v$version/stripe_${version}_windows_x86_64.zip"

Write-Host "Downloading Stripe CLI v$version..."
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest | Out-Null
}

Expand-Archive -Path $zip -DestinationPath $dest -Force
Remove-Item $zip -Force

$exe = Join-Path $dest "stripe.exe"
if (-not (Test-Path $exe)) {
    Write-Error "stripe.exe not found after extract."
    exit 1
}

& $exe --version
Write-Host "Installed to: $dest"
