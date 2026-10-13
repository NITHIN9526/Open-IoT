param([ValidateSet('Install','Stop','Remove','OpenSetup','Logs')][string]$Action = 'Install')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSCommandPath))
$data = Join-Path $env:ProgramData 'OpenIoT'
$wrapper = Join-Path $root 'OpenIoTService.exe'
$node = Join-Path $root 'runtime\node.exe'
$cli = Join-Path $root 'server\desktop\cli.js'
function Run-Native($program, $arguments) {
    & $program @arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $program (exit $LASTEXITCODE)" }
}
function Stop-OpenIoT {
    $service = Get-Service -Name OpenIoT -ErrorAction SilentlyContinue
    if ($service -and $service.Status -ne 'Stopped') {
        Stop-Service -Name OpenIoT
        $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
    }
}
# Management shortcuts elevate before reading the protected management credential.
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    if ($Action -notin @('OpenSetup','Logs')) { throw 'Administrator access is required.' }
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Action $Action"
    exit
}
switch ($Action) {
    'Stop' { Stop-OpenIoT }
    'Remove' {
        Stop-OpenIoT
        if (Get-Service OpenIoT -ErrorAction SilentlyContinue) { Run-Native $wrapper @('uninstall') }
        Get-NetFirewallRule -Name 'OpenIoT-Private' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        # Database, keys, logs and backups intentionally survive uninstall.
    }
    'Install' {
        Stop-OpenIoT
        New-Item -ItemType Directory -Path $data -Force | Out-Null
        # Set protection before writing credentials. SIDs avoid localized account names.
        Run-Native icacls.exe @($data, '/inheritance:r', '/grant:r', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F', '*S-1-5-19:(OI)(CI)M')
        Run-Native $node @($cli, 'prepare', $data)
        $escapedRoot = [Security.SecurityElement]::Escape($root)
        $escapedData = [Security.SecurityElement]::Escape($data)
        @"
<service>
  <id>OpenIoT</id><name>Open IoT Server</name>
  <description>Open IoT dashboard, MQTT broker and dedicated PostgreSQL database.</description>
  <executable>$escapedRoot\runtime\node.exe</executable>
  <startarguments>"$escapedRoot\server\desktop\cli.js" run "$escapedData"</startarguments>
  <stoparguments>"$escapedRoot\server\desktop\cli.js" stop "$escapedData"</stoparguments>
  <workingdirectory>$escapedRoot</workingdirectory>
  <startmode>Automatic</startmode><delayedAutoStart>true</delayedAutoStart>
  <serviceaccount><domain>NT AUTHORITY</domain><user>LocalService</user></serviceaccount>
  <stoptimeout>60 sec</stoptimeout><onfailure action="restart" delay="15 sec" />
  <logpath>$escapedData\logs</logpath>
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>5</keepFiles></log>
</service>
"@ | Set-Content -LiteralPath (Join-Path $root 'OpenIoTService.xml') -Encoding UTF8
        if (-not (Get-Service OpenIoT -ErrorAction SilentlyContinue)) { Run-Native $wrapper @('install') }
        Get-NetFirewallRule -Name 'OpenIoT-Private' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        New-NetFirewallRule -Name 'OpenIoT-Private' -DisplayName 'Open IoT (private LAN only)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000,1883 -Program $node -Profile Private -RemoteAddress LocalSubnet | Out-Null
        Start-Service OpenIoT
    }
    'OpenSetup' {
        if ((Get-Service OpenIoT).Status -ne 'Running') { Start-Service OpenIoT }
        $config = Get-Content -Raw -LiteralPath (Join-Path $data 'config.json') | ConvertFrom-Json
        $ready = $false
        for ($i = 0; $i -lt 90; $i++) {
            try {
                $null = Invoke-RestMethod 'http://127.0.0.1:3001/api/status' -Headers @{ Authorization = "Bearer $($config.managementToken)" } -TimeoutSec 2
                $ready = $true; break
            } catch { Start-Sleep -Seconds 1 }
        }
        if (-not $ready) { throw "Server is not ready. Check $data\logs." }
        Start-Process "http://127.0.0.1:3001/#token=$($config.managementToken)"
    }
    'Logs' { Start-Process notepad.exe -ArgumentList "`"$(Join-Path $data 'logs\OpenIoTService.out.log')`"" }
}
