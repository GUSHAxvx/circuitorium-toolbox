# CIRCUITORIUM 公网隧道守护脚本
# 优先使用 cloudflared（稳定），未找到时回退到 localhost.run
# 特点：自动重连 + 自动抓取公网地址 + 复制到剪贴板 + 写入「当前公网地址.txt」

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$root    = Split-Path -Parent $PSScriptRoot
$exe     = Join-Path $root '.tools\cloudflared.exe'
$urlFile = Join-Path $root '当前公网地址.txt'
$lastUrl = ''

function Show-PublicUrl([string]$url) {
    Write-Host ''
    Write-Host '  ============================================================' -ForegroundColor Cyan
    Write-Host '   公网地址（把这一行发出去，手机流量也能打开）' -ForegroundColor Cyan
    Write-Host "   $url" -ForegroundColor Yellow
    Write-Host '  ============================================================' -ForegroundColor Cyan
    try { Set-Clipboard -Value $url -ErrorAction Stop; Write-Host '   已复制到剪贴板' -ForegroundColor Green } catch { Write-Host '   （剪贴板不可用，请手动复制上面那一行）' -ForegroundColor DarkGray }
    try { Set-Content -Path $urlFile -Value $url -Encoding UTF8 -ErrorAction Stop; Write-Host "   已保存到 当前公网地址.txt" -ForegroundColor Green } catch {}
    Write-Host ''
}

Write-Host ''
Write-Host '  CIRCUITORIUM 公网隧道' -ForegroundColor White
Write-Host '  断线会自动重连（每 3 秒一次）；按 Ctrl+C 或关闭窗口即停止。' -ForegroundColor DarkGray
Write-Host ''

if (Test-Path $exe) {
    while ($true) {
        Write-Host '  [连接中] 正在通过 Cloudflare 建立隧道 ...' -ForegroundColor DarkGray
        & $exe tunnel --url http://localhost:3000 --no-autoupdate 2>&1 | ForEach-Object {
            $line = [string]$_
            Write-Host $line
            if ($line -match 'https://[a-z0-9][a-z0-9\-]*\.trycloudflare\.com') {
                $found = $Matches[0]
                if ($found -ne $lastUrl) { $lastUrl = $found; Show-PublicUrl $found }
            }
        }
        Write-Host '  [断开] 隧道已断开，3 秒后自动重连 ...' -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}
else {
    Write-Host '  [提示] 未找到 .tools\cloudflared.exe，改用 localhost.run 隧道。' -ForegroundColor DarkGray
    while ($true) {
        Write-Host '  [连接中] 正在通过 localhost.run 建立隧道 ...' -ForegroundColor DarkGray
        ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=20 -o ServerAliveCountMax=3 -R 80:localhost:3000 nokey@localhost.run 2>&1 | ForEach-Object {
            $line = [string]$_
            Write-Host $line
            if ($line -match 'https://[a-z0-9]+\.lhr\.life') {
                $found = $Matches[0]
                if ($found -ne $lastUrl) { $lastUrl = $found; Show-PublicUrl $found }
            }
        }
        Write-Host '  [断开] 隧道已断开，3 秒后自动重连 ...' -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}
