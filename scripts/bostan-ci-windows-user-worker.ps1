param(
  [Parameter(Mandatory=$true)][ValidateSet('Server','Installer','PostgresProbe','Native')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$NodeBinary
)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:CI -ne 'true') { throw 'Disposable CI worker required' }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Standard user token required' }
if (-not $identity.Name.Split('\')[-1].StartsWith('bostanqa')) { throw 'Unexpected CI user identity' }
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$profileDirectory = [Environment]::GetFolderPath('UserProfile')
if (-not $profileDirectory -or (Split-Path $profileDirectory -Leaf) -ne $identity.Name.Split('\')[-1]) { throw 'Unexpected CI user profile' }
$env:USERPROFILE = $profileDirectory
$env:HOME = $profileDirectory
$env:APPDATA = Join-Path $profileDirectory 'AppData\Roaming'
$env:LOCALAPPDATA = Join-Path $profileDirectory 'AppData\Local'
$env:TEMP = Join-Path $env:LOCALAPPDATA 'Temp'
$env:TMP = $env:TEMP
$env:RUNNER_TEMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
Set-Location -LiteralPath $repo
if ($Mode -eq 'Server') {
  & $NodeBinary (Join-Path $repo 'scripts\bostan-windows-server-journey.mjs') --compiled
} elseif ($Mode -eq 'PostgresProbe') {
  & $NodeBinary (Join-Path $repo 'scripts\bostan-windows-embedded-postgres-node-probe.mjs') 2>&1
} elseif ($Mode -eq 'Native') {
  & $NodeBinary (Join-Path $repo 'scripts\bostan-windows-embedded-postgres-node-probe.mjs') 2>&1
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -NoProfile -NonInteractive -File (Join-Path $repo 'scripts\bostan-windows-local-native-qa.ps1') 2>&1
} else {
  $env:BOSTAN_DESKTOP_INSTALLER_QA = '1'
  & $NodeBinary (Join-Path $repo 'desktop\scripts\qualify-windows-installer.mjs')
}
exit $LASTEXITCODE
