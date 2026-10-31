param(
  [switch]$Run,
  [ValidateRange(1, 2)][int]$Rounds = 2
)
# Bostan B1-105: private native Windows PostgreSQL multi-suite QA.
# Never kills processes or removes data; fail closed on ambiguity.
$ErrorActionPreference = 'Stop'
if (-not $Run) {
  Write-Output 'BOSTAN_B105_PLAN_ONLY; -Run requires a separate owned B### QA worktree and matching TEMP.'
  exit 0
}
try {
  if ($env:OS -ne 'Windows_NT') { throw 'Not native Windows' }
  $root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
  $rootName = Split-Path -Path $root -Leaf
  if ($rootName -cnotmatch '^Bostan-B([0-9]+)-qa$') {
    throw 'Unowned QA repository name'
  }
  $wave = $Matches[1]
  $temp = [System.IO.Path]::GetFullPath([string]$env:TEMP)
  if ((Split-Path $temp -Leaf) -cne "Bostan-B$wave-temp") {
    throw 'QA TEMP does not match checkout'
  }
  $tempItem = Get-Item -LiteralPath $temp -Force
  if (-not $tempItem.PSIsContainer -or
      ($tempItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    throw 'Unsafe or linked temporary directory'
  }
  $marker = Join-Path $temp 'BOSTAN_QA_OWNED'
  $markerItem = Get-Item -LiteralPath $marker -Force
  if ($markerItem.PSIsContainer -or
      ($markerItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -or
      (Get-Content -LiteralPath $marker -Raw).Trim() -cne 'BOSTAN_TEST_ONLY') {
    throw 'Missing exact owner marker'
  }
  $manifest = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw |
    ConvertFrom-Json
  if ($manifest.name -cne 'bostan' -or $manifest.private -ne $true) {
    throw 'Unexpected project identity'
  }
  if (@(Get-ChildItem -LiteralPath $temp -Directory -Force).Count -ne 0) {
    throw 'QA TEMP already has fixture directories'
  }
  $vitest = Join-Path $root 'packages\db\node_modules\.bin\vitest.cmd'
  $scanner = Join-Path $root 'scripts\bostan-native-windows-postgres-no-orphans.ps1'
  if (-not (Test-Path -LiteralPath $vitest -PathType Leaf) -or
      -not (Test-Path -LiteralPath $scanner -PathType Leaf)) {
    throw 'Required pinned local test dependencies are unavailable'
  }
  foreach ($key in [Environment]::GetEnvironmentVariables().Keys) {
    if ([string]$key -match '^(?:PAPERCLIP_CLOUD_|BOSTAN_CLOUD_|PAPERCLIP_MANAGED_CONFIG$)') {
      throw 'Managed cloud environment is not permitted'
    }
  }
  function Assert-Admitted {
    $freeKiB = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory
    $ramGiB = [double]$freeKiB / 1048576
    $systemGiB = [double](Get-PSDrive C).Free / 1GB
    $workGiB = [double](Get-PSDrive D).Free / 1GB
    if ($ramGiB -lt 4 -or $systemGiB -lt 2 -or $workGiB -lt 8) {
      throw 'Safe heavy-suite resource admission refused'
    }
    $pg = @(Get-CimInstance Win32_Process -Filter "Name='postgres.exe'")
    if ($pg.Count -ne 0) { throw 'PostgreSQL already running or unowned' }
    if (@(Get-ChildItem -LiteralPath $temp -Directory -Force).Count -ne 0) {
      throw 'Retained fixture detected; do not overwrite or delete it'
    }
  }
  function Assert-NoOrphans {
    $scan = @(& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $scanner -Run)
    if ($LASTEXITCODE -ne 0 -or
        ($scan -notcontains 'BOSTAN_WINDOWS_POSTGRES_NO_ORPHANS_PASS')) {
      throw 'Independent PostgreSQL process identity proof refused'
    }
    if (@(Get-CimInstance Win32_Process -Filter "Name='postgres.exe'").Count -ne 0) {
      throw 'PostgreSQL worker remains'
    }
    Write-Output 'BOSTAN_B105_POSTGRES_NO_ORPHANS_PASS'
  }
  $savedTemp = $env:TMP
  $savedTemplate = $env:PAPERCLIP_TEST_POSTGRES_TEMPLATE
  $savedNode = $env:NODE_OPTIONS
  $savedNoColor = $env:NO_COLOR
  $savedForceColor = $env:FORCE_COLOR
  try {
    $env:TMP = $temp
    $env:PAPERCLIP_TEST_POSTGRES_TEMPLATE = '0'
    $env:NODE_OPTIONS = '--max-old-space-size=1152'
    $env:NO_COLOR = '1'
    $env:FORCE_COLOR = '0'
    Set-Location -LiteralPath (Join-Path $root 'packages\db')
    for ($round = 1; $round -le $Rounds; $round++) {
      Assert-Admitted
      Assert-NoOrphans
      Write-Output "BOSTAN_B105_PARALLEL_ROUND_$($round)_START"
      $captured = @(& $vitest run src/session-goal-migration.test.ts src/status-card-migrations.test.ts src/chat-tenant-foreign-keys.test.ts --pool=forks --maxWorkers=2 --testTimeout=90000 --hookTimeout=90000 --reporter=dot --silent 2>&1)
      $result = $LASTEXITCODE
      $plain = @($captured | ForEach-Object {
        ([string]$_) -replace '\x1b\[[0-9;]*m',''
      })
      $filesOk = @($plain | Where-Object {
        $_ -match '^\s*Test Files\s+3 passed\s+\(3\)\s*$'
      }).Count -eq 1
      $testsOk = @($plain | Where-Object {
        $_ -match '^\s*Tests\s+3 passed\s+\(3\)\s*$'
      }).Count -eq 1
      Write-Output "BOSTAN_B105_VITEST_EXIT=$result"
      Write-Output "BOSTAN_B105_THREE_REAL_SUITES_PASS=$($filesOk -and $testsOk)"
      Assert-NoOrphans
      if ($result -ne 0 -or -not $filesOk -or -not $testsOk) {
        throw 'Real parallel suite failed or did not run all three tests'
      }
      if (@(Get-ChildItem -LiteralPath $temp -Directory -Force).Count -ne 0) {
        throw 'Post-test data directories retained; qualification refused'
      }
      Write-Output "BOSTAN_B105_ROUND_$($round)_GREEN_NO_RETAINED_FIXTURES"
    }
    Write-Output "BOSTAN_B105_NATIVE_WINDOWS_REAL_PG_PARALLEL_REPEATED_PASS rounds=$Rounds"
  } finally {
    $env:TMP = $savedTemp
    $env:PAPERCLIP_TEST_POSTGRES_TEMPLATE = $savedTemplate
    $env:NODE_OPTIONS = $savedNode
    $env:NO_COLOR = $savedNoColor
    $env:FORCE_COLOR = $savedForceColor
  }
  exit 0
} catch {
  # Keep diagnostics bounded and redact any unexpected exception details.
  # In particular, distinguish an unstarted second round from a failed DB
  # suite without exposing local paths, environment, command lines or SQL.
  if ($_.Exception.Message -eq 'Safe heavy-suite resource admission refused') {
    Write-Output 'BOSTAN_B105_RESOURCE_ADMISSION_REFUSED'
  } else {
    Write-Output 'BOSTAN_B105_UNQUALIFIED_ERROR'
  }
  # No cleanup/kill: preserve any ambiguous fixture for later investigation.
  Write-Output 'BOSTAN_B105_FAIL_CLOSED; no foreign files or processes were touched'
  exit 1
}
