@echo off
chcp 65001 >nul
cd /d "%~dp0."
title CIRCUITORIUM 启动器
echo ============================================
echo   CIRCUITORIUM 一键启动
echo ============================================
echo.

rem ---- 如果服务已经在运行，就直接打开浏览器 ----
curl -s -o NUL --max-time 2 http://localhost:3000 >nul 2>&1
if %errorlevel%==0 (
  echo   [提示] 项目服务已在运行，直接打开浏览器
  start "" http://localhost:3000
  goto done
)

rem ---- 启动项目服务 ----
echo   [1/2] 启动项目服务（第一个窗口，请勿关闭）...
start "CIRCUITORIUM-服务" /D "%~dp0." cmd /k npm run dev

rem ---- 等待服务真正就绪（最多约 40 秒）----
echo   等待服务就绪（首次启动约 10 秒，请稍候）...
set /a tries=0
:waitloop
timeout /t 2 /nobreak >nul
curl -s -o NUL --max-time 2 http://localhost:3000 >nul 2>&1
if %errorlevel%==0 goto ready
set /a tries+=1
if %tries% lss 20 goto waitloop
echo   [警告] 服务启动超时，请查看第一个窗口的报错信息
goto done

:ready
echo   [OK] 服务已就绪，正在打开浏览器
start "" http://localhost:3000

:done
echo.
echo   [2/2] 同一个 WiFi 下的手机、平板、别的电脑也能打开（不用装任何东西）：
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { '          http://' + $_.IPAddress + ':3000/toolbox' }"
echo          上面有几个地址就试几个，挑和手机同网段的那个。
echo.
echo   小提示：上课要发给全班，用「桌面版」或「便携版」的文件更省事，不用联网。
echo.
pause
