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
  goto tunnel
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
goto tunnel

:ready
echo   [OK] 服务已就绪，正在打开浏览器
start "" http://localhost:3000

:tunnel
echo.
echo   [2/2] 启动公网隧道（第二个窗口）
echo         窗口里会显示 https://xxx.lhr.life 链接，
echo         把它发给任何人即可访问（不需要同一 WiFi）。
echo.
start "CIRCUITORIUM-公网隧道" /D "%~dp0." cmd /k tunnel.cmd
echo   全部启动完成。关闭窗口即停止对应服务。
echo   隧道断线会自动重连，无需重启窗口。
echo.
pause
