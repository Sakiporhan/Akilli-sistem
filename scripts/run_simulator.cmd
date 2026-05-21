@echo off
call "%~dp0set_demo_env.bat"
cd /d "%~dp0.."
title SIMULATOR
set "SIM_MODE=%~1"
if "%SIM_MODE%"=="" set "SIM_MODE=idle"

if /I "%SIM_MODE%"=="temperature" goto :temperature_demo
if /I "%SIM_MODE%"=="temp" goto :temperature_demo

if /I "%SIM_MODE%"=="idle" goto :idle_demo
if /I "%SIM_MODE%"=="baseline" goto :idle_demo

if /I "%SIM_MODE%"=="fire" goto :fire_demo

echo [SIMULATOR] Bilinmeyen mod "%SIM_MODE%", baslangic ^(idle^) kullaniliyor.
goto :idle_demo

:fire_demo
echo [SIMULATOR] Mod: fire_live
py -m scripts.event_simulator --scenario fire_live --delay 0.2
goto :end

:idle_demo
echo [SIMULATOR] Baslangic: yangin yok, sicaklik 22°C ^(MQTT state tetiklenir^)
py -m scripts.event_simulator --scenario idle --delay 0.05
goto :end

:temperature_demo
echo [SIMULATOR] Mod: temperature demo
echo Yuksek sicaklik verileri gonderiliyor (yangin tetikleme)...
py -m scripts.event_simulator --temperature 72 --delay 0.1
timeout /t 3 /nobreak >nul
py -m scripts.event_simulator --temperature 72 --delay 0.1
echo Dusuk sicaklik verileri gonderiliyor (hysteresis reset tetikleme)...
timeout /t 1 /nobreak >nul
py -m scripts.event_simulator --temperature 50 --delay 0.1
timeout /t 5 /nobreak >nul
py -m scripts.event_simulator --temperature 50 --delay 0.1

:end
pause
