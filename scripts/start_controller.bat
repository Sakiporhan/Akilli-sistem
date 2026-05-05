@echo off
call "%~dp0set_demo_env.bat"
cd /d "%~dp0.."
title CONTROLLER
echo Broker bekleniyor: %MQTT_BROKER_HOST%:%MQTT_BROKER_PORT%
set "BROKER_READY="
for /l %%I in (1,1,20) do (
    powershell -NoProfile -Command "$s=New-Object Net.Sockets.TcpClient; try { $s.Connect('%MQTT_BROKER_HOST%', %MQTT_BROKER_PORT%); exit 0 } catch { exit 1 } finally { $s.Dispose() }" >nul 2>&1
    if not errorlevel 1 (
        set "BROKER_READY=1"
        goto :start_controller
    )
    timeout /t 1 /nobreak >nul
)

if not defined BROKER_READY (
    echo HATA: Broker hazir degil. Lutfen BROKER penceresini kontrol edin.
    pause
    exit /b 1
)

:start_controller
echo Controller baslatiliyor...
py -m src.main --controller
pause
