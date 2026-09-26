# CIRCUITORIUM 工具箱 · 便携版本地服务
# 只用 PowerShell 自带的 TcpListener，不装任何东西、不需要管理员权限。
# 关掉这个窗口 = 停止服务（数据已经存在浏览器本地，下次打开还在）。

# 参数：-Lan 表示让同一个 WiFi 下的手机/其它电脑也能打开（默认只允许本机）
param(
  [int]$Port = 8734,
  [string]$Root = (Join-Path $PSScriptRoot 'site'),
  [switch]$Lan
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

if (-not (Test-Path $Root)) {
  Write-Host "找不到站点目录：$Root" -ForegroundColor Red
  exit 1
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.gif'  = 'image/gif'
  '.ico'  = 'image/x-icon'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.txt'  = 'text/plain; charset=utf-8'
  '.map'  = 'application/json; charset=utf-8'
}

function Send-Response {
  param($Stream, [int]$Status, [string]$StatusText, [byte[]]$Body, [string]$ContentType, [bool]$HeadOnly = $false)
  $header = "HTTP/1.1 $Status $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if (-not $HeadOnly -and $Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
  $Stream.Flush()
}

$bindAddress = if ($Lan) { [System.Net.IPAddress]::Any } else { [System.Net.IPAddress]::Loopback }
$listener = [System.Net.Sockets.TcpListener]::new($bindAddress, $Port)
try {
  $listener.Start()
} catch {
  Write-Host "端口 $Port 被占用，请关掉占用它的程序，或用 -Port 换一个端口。" -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '  CIRCUITORIUM 工具箱（便携版）已启动' -ForegroundColor Cyan
Write-Host "  本机地址：http://127.0.0.1:$Port/toolbox/" -ForegroundColor Yellow
if ($Lan) {
  Write-Host ''
  Write-Host '  同一个 WiFi 下的手机/平板/别的电脑，用下面任意一个地址打开：' -ForegroundColor Cyan
  $ips = @()
  try {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
      Select-Object -ExpandProperty IPAddress -Unique
  } catch { }
  if ($ips.Count -gt 0) {
    foreach ($ip in $ips) { Write-Host "      http://${ip}:$Port/toolbox" -ForegroundColor Yellow }
    Write-Host '  （多个地址就挨个试，挑和手机同网段的那个）' -ForegroundColor DarkGray
  } else {
    Write-Host '      没读到本机 IP，可在命令行执行 ipconfig 查看' -ForegroundColor DarkGray
  }
  Write-Host ''
  Write-Host '  打不开的话，多半是 Windows 防火墙拦了：' -ForegroundColor DarkGray
  Write-Host "      以管理员身份运行一次：netsh advfirewall firewall add rule name=`"CIRCUITORIUM便携版`" dir=in action=allow protocol=TCP localport=$Port" -ForegroundColor DarkGray
  Write-Host '  注意：同网段的人都能打开（内容是只读的，写不进你的电脑）。' -ForegroundColor DarkGray
}
Write-Host '  数据存在这台电脑的浏览器里 · 不联网也能用' -ForegroundColor DarkGray
Write-Host '  关掉本窗口即停止服务（数据不会丢）' -ForegroundColor DarkGray
Write-Host ''

$rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')

while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $client.ReceiveTimeout = 5000
    $client.SendTimeout = 15000
    $stream = $client.GetStream()

    # 读取请求行
    $buffer = New-Object byte[] 8192
    $read = $stream.Read($buffer, 0, $buffer.Length)
    if ($read -le 0) { $client.Close(); continue }
    $request = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
    $lines = $request -split "`r`n"
    $parts = $lines[0] -split ' '
    if ($parts.Length -lt 2) { $client.Close(); continue }
    $method = $parts[0].ToUpper()
    $target = $parts[1]
    $headOnly = $method -eq 'HEAD'

    # 去掉查询串并解码
    $path = ($target -split '\?')[0]
    $path = [System.Uri]::UnescapeDataString($path)
    if ($path -eq '/' -or $path -eq '') { $path = '/toolbox/' }

    # 拼接本地路径：先逐段校验（拒绝 .. / 盘符 / 反斜杠），再做前缀兜底检查
    $segments = @($path.Trim('/') -split '/' | Where-Object { $_ -ne '' })
    $bad = $false
    foreach ($seg in $segments) {
      if ($seg -eq '..' -or $seg -eq '.' -or $seg -match ':' -or $seg -match '\\') { $bad = $true; break }
    }
    if ($bad) {
      $body = [System.Text.Encoding]::UTF8.GetBytes('403 Forbidden')
      Send-Response -Stream $stream -Status 403 -StatusText 'Forbidden' -Body $body -ContentType 'text/plain; charset=utf-8'
      $client.Close(); continue
    }

    $relative = ($segments -join '\')
    $resolved = [System.IO.Path]::GetFullPath((Join-Path $rootFull $relative))

    if (-not $resolved.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      $body = [System.Text.Encoding]::UTF8.GetBytes('403 Forbidden')
      Send-Response -Stream $stream -Status 403 -StatusText 'Forbidden' -Body $body -ContentType 'text/plain; charset=utf-8'
      $client.Close(); continue
    }

    if (Test-Path -LiteralPath $resolved -PathType Container) {
      $resolved = Join-Path $resolved 'index.html'
    } elseif (-not (Test-Path -LiteralPath $resolved)) {
      # 目录式路径：/toolbox → /toolbox/index.html
      $candidate = Join-Path $resolved 'index.html'
      if (Test-Path -LiteralPath $candidate) { $resolved = $candidate }
    }

    if (Test-Path -LiteralPath $resolved -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($resolved).ToLower()
      $ctype = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($resolved)
      Send-Response -Stream $stream -Status 200 -StatusText 'OK' -Body $bytes -ContentType $ctype -HeadOnly $headOnly
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
      Send-Response -Stream $stream -Status 404 -StatusText 'Not Found' -Body $body -ContentType 'text/plain; charset=utf-8'
    }
    $client.Close()
  } catch {
    if ($client) { try { $client.Close() } catch { } }
  }
}
