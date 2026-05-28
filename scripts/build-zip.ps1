# Builds a Chrome Web Store-ready zip of the extension.
# Output: dist/use-chat-vX.Y.Z.zip (version pulled from manifest.json)
#
# Run from repo root: .\scripts\build-zip.ps1

$ErrorActionPreference = 'Stop'

# Move to repo root regardless of invocation cwd
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Read version from manifest
$manifest = Get-Content manifest.json -Raw | ConvertFrom-Json
$version = $manifest.version
if (-not $version) { throw 'No version field in manifest.json' }

$distDir = Join-Path $repoRoot 'dist'
if (-not (Test-Path $distDir)) { New-Item -ItemType Directory $distDir | Out-Null }

$zipName = "use-chat-v$version.zip"
$zipPath = Join-Path $distDir $zipName

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Files to include — keep this list tight so we don't ship dev artifacts
$include = @(
  'manifest.json',
  'content.js',
  'styles.css',
  'icons'
)

# Validate all include paths exist
foreach ($p in $include) {
  if (-not (Test-Path $p)) { throw "Missing required path: $p" }
}

# Syntax-check JS before packaging
node --check content.js
if ($LASTEXITCODE -ne 0) { throw 'content.js failed syntax check' }

Compress-Archive -Path $include -DestinationPath $zipPath -CompressionLevel Optimal -Force

$size = (Get-Item $zipPath).Length
Write-Host "Built $zipPath ($size bytes)"
Write-Host ""
Write-Host "Next: upload to https://chrome.google.com/webstore/devconsole"
Write-Host "      and bump version in manifest.json before the next release."
