@echo off
REM =============================================================================
REM  React arayuzu + MQTT KOPRUSU (py -m src.dashboard_bridge, port 8765)
REM  Dashboard: http://localhost:5173
REM  Node-RED YOK. Eski Node-RED demo icin: start_all_demo.bat
REM =============================================================================
cd /d "%~dp0.."
set "ROOT=%cd%"
setlocal
set "SIM_MODE=%~1"
if "%SIM_MODE%"=="" set "SIM_MODE=idle"

echo.
echo === Akilli Oda — React + MQTT koprusu (tek tik) ===
echo Klasor: %ROOT%
call "%ROOT%\scripts\set_demo_env.bat"
echo MQTT: %MQTT_BROKER_HOST%:%MQTT_BROKER_PORT%
echo Kopru (WebSocket): http://127.0.0.1:8765
echo React (Vite):      http://localhost:5173/
echo.
if /I "%SIM_MODE%"=="temperature" (
    echo Simulator senaryosu: temperature
) else if /I "%SIM_MODE%"=="temp" (
    echo Simulator senaryosu: temperature
) else if /I "%SIM_MODE%"=="fire" (
    echo Simulator senaryosu: fire_live
) else (
    echo Simulator senaryosu: baslangic ^(yangin yok, 22°C telemetri^)
)
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

start "CONTROLLER" cmd /k ""%ROOT%\scripts\start_controller.bat""
echo Controller baslatildi.
timeout /t 3 /nobreak >nul

start "DASHBOARD_BRIDGE" /D "%ROOT%" cmd /k "call scripts\set_demo_env.bat && title DASHBOARD_BRIDGE && echo Kopru: http://127.0.0.1:8765  MQTT: %MQTT_BROKER_HOST%:%MQTT_BROKER_PORT% && py -m src.dashboard_bridge"
echo Kopru baslatildi ^(8765^). Bir kac saniye bekleniyor...
timeout /t 5 /nobreak >nul

if not exist "%ROOT%\web\smartroom-dashboard\node_modules\" (
    echo Ilk kurulum: npm install...
    pushd "%ROOT%\web\smartroom-dashboard"
    call npm install
    if errorlevel 1 (
        echo HATA: npm install basarisiz. Node.js kurulu mu?
        popd
        pause
        exit /b 1
    )
    popd
)

start "VITE" /D "%ROOT%\web\smartroom-dashboard" cmd /k "title VITE_REACT_DASHBOARD && echo http://localhost:5173 && npm run dev"
echo Vite baslatiliyor...
timeout /t 6 /nobreak >nul

start "SIMULATOR" cmd /k ""%ROOT%\scripts\start_simulator.bat" %SIM_MODE%"
timeout /t 2 /nobreak >nul

start "" "http://localhost:5173/"

echo.
echo Acilan: BROKER ^(gerekirse^), CONTROLLER, DASHBOARD_BRIDGE, VITE, SIMULATOR
echo Node-RED dashboard degil — React: http://localhost:5173/
echo MQTT'siz deneme: http://localhost:5173/?demo=1
echo.
echo Kullanim:
echo   scripts\start_all_react_bridge_demo.bat              ^(baslangic: yangin yok^)
echo   scripts\start_all_react_bridge_demo.bat fire         ^(fire_live^)
echo   scripts\start_all_react_bridge_demo.bat temperature  ^(sicaklik^)
echo.
pause
