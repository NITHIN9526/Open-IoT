param([string]$Iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe")
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $root
function Native($program, $arguments) { & $program @arguments; if ($LASTEXITCODE -ne 0) { throw "$program failed ($LASTEXITCODE)" } }
if (-not (Test-Path $Iscc)) { throw 'Install Inno Setup 6 or pass -Iscc with its compiler path.' }
if ((& node -p 'process.versions.node.split(".")[0]') -ne '24') { throw 'Build with Node.js 24 LTS (x64).' }
if ((& node -p 'process.arch') -ne 'x64') { throw 'Build with x64 Node.js.' }
Native npm.cmd @('ci')
Native npm.cmd @('run','build')
Native npm.cmd @('run','check:release')
$stage = Join-Path $PSScriptRoot 'stage'
$vendor = Join-Path $PSScriptRoot 'vendor'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage,$vendor,"$stage\runtime","$stage\web","$stage\installer\windows","$stage\licenses" -Force | Out-Null
foreach ($name in @('server','sql','scripts','docs')) { Copy-Item $name $stage -Recurse }
Copy-Item package.json,package-lock.json,LICENSE $stage
Copy-Item web\package.json "$stage\web"
Copy-Item web\dist "$stage\web" -Recurse
Copy-Item installer\windows\service.ps1 "$stage\installer\windows"
Push-Location $stage
try { Native npm.cmd @('ci','--omit=dev','--workspaces=false') } finally { Pop-Location }
$lock = Get-Content "$PSScriptRoot\vendor-lock.json" -Raw | ConvertFrom-Json
function Download-Verified($url, $path, $hash) {
    if (-not (Test-Path $path)) { Invoke-WebRequest $url -OutFile $path }
    if ((Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash.ToLowerInvariant()) { throw "Checksum mismatch: $path. Delete the cached file and investigate upstream." }
}
Download-Verified $lock.postgres.url "$vendor\postgres.zip" $lock.postgres.sha256
Download-Verified $lock.winsw.url "$vendor\winsw.exe" $lock.winsw.sha256
Copy-Item "$vendor\winsw.exe" "$stage\OpenIoTService.exe"
# Only extract PostgreSQL server components, not pgAdmin or StackBuilder.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead("$vendor\postgres.zip")
try {
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -notmatch '^pgsql/(bin/|lib/|share/|[^/]*license[^/]*$)') { continue }
        $destination = Join-Path "$stage\runtime" $entry.FullName
        if ($entry.FullName.EndsWith('/')) { New-Item -ItemType Directory -Path $destination -Force | Out-Null; continue }
        New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)
    }
} finally { $zip.Dispose() }
$version = (& node -p 'process.version').Trim()
$nodeName = "node-$version-win-x64.zip"
$sums = (Invoke-WebRequest "https://nodejs.org/dist/$version/SHASUMS256.txt").Content
$line = ($sums -split "`n" | Where-Object { $_.Trim().EndsWith("  $nodeName") })
if (-not $line) { throw 'Node release checksum was not found.' }
Download-Verified "https://nodejs.org/dist/$version/$nodeName" "$vendor\$nodeName" ($line -split '\s+')[0]
Expand-Archive "$vendor\$nodeName" "$vendor\node" -Force
Copy-Item "$vendor\node\node-$version-win-x64\node.exe" "$stage\runtime\node.exe"
Copy-Item "$vendor\node\node-$version-win-x64\LICENSE" "$stage\licenses\NODE-LICENSE.txt"
Invoke-WebRequest 'https://raw.githubusercontent.com/winsw/winsw/v2.12.0/LICENSE.txt' -OutFile "$stage\licenses\WINSW-LICENSE.txt"
# Microsoft services the redistributable in place. Require its valid publisher signature.
Invoke-WebRequest 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -OutFile "$stage\runtime\vc_redist.x64.exe"
$signature = Get-AuthenticodeSignature "$stage\runtime\vc_redist.x64.exe"
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') { throw 'Microsoft redistributable signature verification failed.' }
$manifest = @{ node = $version; postgres = $lock.postgres; winsw = $lock.winsw; vcRedistSha256 = (Get-FileHash "$stage\runtime\vc_redist.x64.exe").Hash }
$manifest | ConvertTo-Json -Depth 5 | Set-Content "$stage\BUILD-MANIFEST.json"
$appVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
Native $Iscc @("/DAppVersion=$appVersion", "$PSScriptRoot\OpenIoT.iss")
Get-ChildItem "$PSScriptRoot\output\*.exe" | ForEach-Object { (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $_.Name } | Set-Content "$PSScriptRoot\output\SHA256SUMS.txt"
