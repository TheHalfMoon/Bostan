param([switch]$RequireStandardUser)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'bostan-windows-native-archive-hash.ps1')

if ($RequireStandardUser) {
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
  $username = $identity.Name.Split('\')[-1]
  if ($principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator) -or -not $username.StartsWith('bostanqa')) {
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_PROBE_FAILURE phase=standard_user cause=other'
    throw 'archive hash probe requires the disposable standard-user token'
  }
}

try {
  Test-BostanArchiveHashFixtures
  if ($RequireStandardUser) {
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_STANDARD_USER_PASS'
  } else {
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_PROBE_PASS'
  }
} catch {
  $category = Get-BostanArchiveFailureCategory -Exception $_.Exception
  Write-Output "BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_PROBE_FAILURE phase=fixtures cause=$category"
  throw 'archive hash fixture probe failed'
}
