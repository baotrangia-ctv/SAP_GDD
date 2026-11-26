$ErrorActionPreference = 'Stop'
$dist = Join-Path (Split-Path $PSScriptRoot -Parent) 'dist'
$snapshot = Join-Path $dist 'data\config-snapshot.json'
if (!(Test-Path -LiteralPath $snapshot)) { throw "Missing snapshot: $snapshot" }
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (!$python -or $python -like '*\Microsoft\WindowsApps\*') {
    $python = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
}
if (!(Test-Path -LiteralPath $python)) { throw 'Python is required to serve the static dashboard.' }
$expected = [Convert]::ToBase64String([IO.File]::ReadAllBytes($snapshot))
Add-Type -AssemblyName System.Net.Http
$handler = [Net.Http.HttpClientHandler]::new()
$handler.UseProxy = $false
$client = [Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds(1)

function Test-DashboardSnapshot($url) {
    try {
        $bytes = $client.GetByteArrayAsync("${url}data/config-snapshot.json").GetAwaiter().GetResult()
        return [Convert]::ToBase64String($bytes) -eq $expected
    } catch {
        $script:lastProbeError = $_.Exception.GetBaseException().Message
        return $false
    }
}

function Open-Dashboard($url) {
    Write-Host "Dashboard ready at $url"
    try { Start-Process $url } catch { Write-Warning "Open $url in your browser." }
}

foreach ($port in 8080..8090) {
    $url = "http://127.0.0.1:$port/"
    if (Test-DashboardSnapshot $url) {
        Open-Dashboard $url
        exit 0
    }
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
    try { $listener.Start() } catch { continue } finally { $listener.Stop() }
    $server = Start-Process -FilePath $python -ArgumentList @('-m', 'http.server', "$port", '--bind', '127.0.0.1', '--directory', ('"' + $dist + '"')) -WindowStyle Hidden -PassThru
    foreach ($attempt in 1..30) {
        if (Test-DashboardSnapshot $url) {
            Open-Dashboard $url
            Write-Host 'Keep this window open while using the dashboard.'
            $server.WaitForExit()
            throw "Dashboard server stopped (exit code $($server.ExitCode)). Run start.cmd to restart it."
        }
        if ($server.HasExited) { break }
        Start-Sleep -Milliseconds 100
    }
    if (!$server.HasExited) { Stop-Process -Id $server.Id }
}
throw "Cannot reach dashboard on local ports 8080-8090. Last HTTP error: $lastProbeError"
