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
  # One clean CIM read is not proof that late io_worker descendants are gone.
  # Take three independent scans with bounded gaps; aggregate any positive or
  # ambiguous identity from ANY scan, never accept only the last clean sample.
  $requiredSnapshots = 3
  for ($sample = 0; $sample -lt $requiredSnapshots; $sample++) {
    if ($sample -gt 0) { Start-Sleep -Milliseconds 250 }
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
        # A different binary path cannot prove this process unrelated.
        # Do not terminate, alter or conceal an unattributed process.
        $uninspected++
      }
    }
  }
  Write-Output ("BOSTAN_WINDOWS_PG_SNAPSHOTS=" + $requiredSnapshots)
  Write-Output ("BOSTAN_WINDOWS_PG_OWNED_PROCESSES=" + $owned.Count)
  Write-Output ("BOSTAN_WINDOWS_PG_UNINSPECTABLE=" + $uninspected)
  if ($owned.Count -ne 0 -or $uninspected -ne 0) { exit 1 }
  Write-Output 'BOSTAN_WINDOWS_POSTGRES_NO_ORPHANS_PASS'
  exit 0
} catch {
  Write-Error 'Bostan Windows PostgreSQL orphan check failed closed'
  exit 2
}
