@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0."
set PORT=8734
title CIRCUITORIUM 工具箱（便携版 · 全班可访问）

echo ============================================
echo   CIRCUITORIUM 工具箱（同网段可访问）
echo ============================================
echo.
echo   这个模式和「启动.bat」的区别：
echo     本机照样能用，同时**同一个 WiFi 下的手机/平板/别的电脑**也能打开。
echo     他们不用装任何东西，浏览器输个网址就能看你的工具箱。
echo.
echo   先启动服务...
echo.

start "CIRCUITORIUM-本地服务" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port %PORT% -Root "%~dp0site" -Lan

rem ---- 等本地服务就绪 ----
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
echo   本机打开：http://127.0.0.1:%PORT%/toolbox/
echo.
echo   给同学/学生的地址（挑和手机同网段的那个）：
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { '          http://' + $_.IPAddress + ':%PORT%/toolbox' }"
echo.
echo   打不开的排查顺序：
echo     1) 手机和这台电脑要连同一个 WiFi（不能用手机流量）
echo     2) 第一次运行会弹防火墙提示，选「允许访问」
echo     3) 还是不行，用管理员身份运行一次下面这行（放行 %PORT% 端口）：
echo        netsh advfirewall firewall add rule name="CIRCUITORIUM便携版" dir=in action=allow protocol=TCP localport=%PORT%
echo.
echo   提醒：同网段的人都能打开这些内容（只读，写不进你的电脑）。
echo   本窗口可以关闭；要停服务请关掉最小化的那个 PowerShell 窗口。
pause
