@echo off
chcp 65001 >nul
cd /d "%~dp0."
title CIRCUITORIUM-公网隧道
echo ============================================
echo   CIRCUITORIUM 公网隧道（自动重连）
echo ============================================
echo.
echo   前提：项目服务已在运行（先跑 启动.bat 或 npm run dev）
echo   建立成功后，窗口里会显示 https://... 链接，
echo   并自动复制到剪贴板、保存到「当前公网地址.txt」。
echo   断线会自动重连；按 Ctrl+C 或关闭窗口即彻底停止。
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\tunnel.ps1"
echo.
echo   隧道脚本已退出。按任意键关闭本窗口。
pause
