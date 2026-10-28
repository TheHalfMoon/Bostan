param([switch]$Run)
$ErrorActionPreference = 'Stop'
if (-not $Run) {
  Write-Output 'Bostan Windows PostgreSQL orphan check: explicit -Run required; read-only, no process termination.'
  exit 0
}
try {
  $repo = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
  $manifestPath = Join-Path $repo 'package.json'
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.name -ne 'bostan' -or $manifest.private -ne $true) {
    throw 'Unexpected private Bostan checkout identity'
  }
  $rootPrefix = $repo.TrimEnd('\') + '\'
  $owned = @()
  $uninspected = 0
  foreach ($proc in (Get-CimInstance Win32_Process -Filter "Name = 'postgres.exe'")) {
    $exe = [string]$proc.ExecutablePath
    if ([string]::IsNullOrWhiteSpace($exe)) {
      # No executable path: ownership cannot be established. Fail closed.
      $uninspected++
      continue
    }
    $full = [System.IO.Path]::GetFullPath($exe)
    if ($full.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      $owned += $proc
    } else {
      # The native embedded-postgres binary may live outside the checkout
      # (e.g. a redirected pnpm virtual store). A different executable path
      # alone cannot PROVE the process is unrelated to this QA run. Treat it
      # as unattributed rather than silently claiming no Bostan orphans.
      # This deliberately blocks qualification if unrelated PostgreSQL is
      # running: never terminate or alter that process to make a test pass.
      $uninspected++
    }
  }
  Write-Output ("BOSTAN_WINDOWS_PG_OWNED_PROCESSES=" + $owned.Count)
  Write-Output ("BOSTAN_WINDOWS_PG_UNINSPECTABLE=" + $uninspected)
  if ($owned.Count -ne 0 -or $uninspected -ne 0) { exit 1 }
  Write-Output 'BOSTAN_WINDOWS_POSTGRES_NO_ORPHANS_PASS'
  exit 0
} catch {
  Write-Error 'Bostan Windows PostgreSQL orphan check failed closed'
  exit 2
}
