# Start TRACKO backend microservices (Windows PowerShell)
# Run from repo root: .\scripts\start-microservices.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Start-ServiceWindow {
  param(
    [string]$Title,
    [string]$WorkDir,
    [string]$Command
  )
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$WorkDir'; Write-Host '=== $Title ===' -ForegroundColor Cyan; $Command"
  )
}

$auth = Join-Path $root "apps\services\auth-service"
$ts = Join-Path $root "apps\services\timesheet-service"
$leave = Join-Path $root "apps\services\leave-service"
$gateway = Join-Path $root "apps\api"

foreach ($dir in @($auth, $ts, $leave, $gateway)) {
  if (-not (Test-Path (Join-Path $dir ".env"))) {
    Write-Warning "Missing .env in $dir — copy from .env.example first."
  }
}

Start-ServiceWindow -Title "auth-service :3010" -WorkDir $auth -Command "npm run start:dev"
Start-Sleep -Seconds 2
Start-ServiceWindow -Title "timesheet-service :3020" -WorkDir $ts -Command "npm run start:dev"
Start-Sleep -Seconds 2
Start-ServiceWindow -Title "leave-service :3030" -WorkDir $leave -Command "npm run start:dev"
Start-Sleep -Seconds 3
Start-ServiceWindow -Title "api-gateway :3001" -WorkDir $gateway -Command "npm run start:dev"

Write-Host "Started 4 terminals. Web should use NEXT_PUBLIC_API_URL=http://localhost:3001"
