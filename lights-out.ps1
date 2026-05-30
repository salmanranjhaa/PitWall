# LIGHTS OUT — starts the F1 Sim backend and frontend
$root = $PSScriptRoot

Write-Host "=== LIGHTS OUT ===" -ForegroundColor Red
Write-Host "Starting backend (port 8000) and frontend (Vite)..." -ForegroundColor Yellow

# Backend — starts in a new terminal window
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$root\project\backend'; Write-Host 'Backend starting...' -ForegroundColor Cyan; .\.venv\Scripts\python start.py"
)

# Frontend — starts in a new terminal window
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$root\frontend-app'; Write-Host 'Frontend starting...' -ForegroundColor Green; npm run dev"
)

Write-Host ""
Write-Host "Two terminals opened:" -ForegroundColor White
Write-Host "  Backend  -> http://localhost:8000" -ForegroundColor Cyan
Write-Host "  Frontend -> http://localhost:5173  (Vite default)" -ForegroundColor Green
Write-Host ""
Write-Host "It's lights out and away we go." -ForegroundColor Red
