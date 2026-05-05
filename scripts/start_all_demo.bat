@echo off
cd /d "%~dp0.."
set "ROOT=%cd%"
setlocal

echo.
echo === Petri-Edge demo (tek tik) ===
echo Klasor: %ROOT%
call "%ROOT%\scripts\set_demo_env.bat"
echo MQTT: %MQTT_BROKER_HOST%:%MQTT_BROKER_PORT%
echo.
echo ONEMLI: Node-RED mqtt-in Server portu %MQTT_BROKER_PORT% olmali.
echo Demo senaryosu: fire_live
echo.

set "BROKER_READY="
for /l %%I in (1,1,2) do (
    powershell -NoProfile -Command "$s=New-Object Net.Sockets.TcpClient; try { $s.Connect('%MQTT_BROKER_HOST%', %MQTT_BROKER_PORT%); exit 0 } catch { exit 1 } finally { $s.Dispose() }" >nul 2>&1
    if not errorlevel 1 set "BROKER_READY=1"
)

if not defined BROKER_READY (
    start "BROKER" cmd /k ""%ROOT%\scripts\start_broker.bat""
    echo Broker baslatiliyor, port %MQTT_BROKER_PORT% bekleniyor...
    set "BROKER_READY="
    for /l %%I in (1,1,20) do (
        powershell -NoProfile -Command "$s=New-Object Net.Sockets.TcpClient; try { $s.Connect('%MQTT_BROKER_HOST%', %MQTT_BROKER_PORT%); exit 0 } catch { exit 1 } finally { $s.Dispose() }" >nul 2>&1
        if not errorlevel 1 (
            set "BROKER_READY=1"
            goto :broker_ready
        )
        timeout /t 1 /nobreak >nul
    )
)

:broker_ready
if not defined BROKER_READY (
    echo HATA: Broker %MQTT_BROKER_HOST%:%MQTT_BROKER_PORT% uzerinde hazir degil.
    echo Lutfen BROKER penceresini kontrol edin.
    pause
    exit /b 1
)
echo Broker hazir.

start "NODE_RED" cmd /k ""%ROOT%\scripts\start_node_red.bat""
timeout /t 5 /nobreak >nul

start "CONTROLLER" cmd /k ""%ROOT%\scripts\start_controller.bat""
echo Controller baslatildi.
timeout /t 3 /nobreak >nul

start "SIMULATOR" cmd /k ""%ROOT%\scripts\start_simulator.bat""
timeout /t 4 /nobreak >nul

start "" "http://127.0.0.1:1880/"
start "" "http://127.0.0.1:1880/ui"

echo Acilan: BROKER, NODE_RED, CONTROLLER, SIMULATOR
echo Editor: http://127.0.0.1:1880/
echo Dashboard: http://127.0.0.1:1880/ui
echo.
pause
