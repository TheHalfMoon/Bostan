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
      # A process without an inspectable executable cannot be proven unrelated
      # to this QA checkout. Never claim zero owned workers while it exists.
      # Read-only: do not terminate or inspect unrelated process secrets.
      $uninspected++
      continue
    }
    $full = [System.IO.Path]::GetFullPath($exe)
    if ($full.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      $owned += $proc
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
