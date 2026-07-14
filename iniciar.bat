@echo off
cd /d "%~dp0"
echo Iniciando MDGym en un servidor local...
echo (No cierres esta ventana mientras uses la app)
echo.
start "MDGym - servidor local" cmd /k "python serve.py 8000 || py serve.py 8000 || echo No se encontro Python instalado. Instalalo desde python.org y volve a intentar."
timeout /t 2 /nobreak >nul
start "" http://localhost:8000/
echo Si el navegador no se abrio solo, entra manualmente a http://localhost:8000
pause
