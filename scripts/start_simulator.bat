@echo off
call "%~dp0set_demo_env.bat"
cd /d "%~dp0.."
title SIMULATOR
py -m scripts.event_simulator --scenario fire_live --delay 0.2
pause
