@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0."
set PORT=8734
title CIRCUITORIUM 工具箱（便携版）

echo ============================================
echo   CIRCUITORIUM 工具箱
echo ============================================
echo.
echo   正在启动本地服务（不需要联网、不需要安装任何东西）...

start "CIRCUITORIUM-本地服务" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port %PORT% -Root "%~dp0site"

rem ---- 等本地服务真正就绪再打开浏览器 ----
set /a tries=0
:waitloop
ping -n 2 127.0.0.1 >nul
curl -s -o NUL --max-time 2 "http://127.0.0.1:%PORT%/toolbox/" >nul 2>&1
if %errorlevel%==0 goto ready
set /a tries+=1
if %tries% lss 20 goto waitloop
echo   [提示] 服务启动较慢或失败，请看最小化的那个窗口里的提示。
goto open

:ready
echo   [OK] 服务已就绪
:open
start "" "http://127.0.0.1:%PORT%/toolbox/"
echo.
echo   浏览器已打开：http://127.0.0.1:%PORT%/toolbox/
echo   数据保存在这台电脑上，关掉服务窗口后下次打开还在。
echo.
echo   本窗口可以关闭（关闭不会停止服务；要停止服务请关掉最小化的那个窗口）。
pause
