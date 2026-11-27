function Get-BostanArchiveSha256 {
  param([Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$LiteralPath)

  $stream = $null
  $sha256 = $null
  try {
    $stream = [System.IO.File]::Open(
      $LiteralPath,
      [System.IO.FileMode]::Open,
      [System.IO.FileAccess]::Read,
      [System.IO.FileShare]::Read
    )
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $digest = $sha256.ComputeHash($stream)
    return [System.BitConverter]::ToString($digest).Replace('-', '').ToLowerInvariant()
  } finally {
    if ($sha256) { $sha256.Dispose() }
    if ($stream) { $stream.Dispose() }
  }
}

function Get-BostanArchiveFailureCategory {
  param([Parameter(Mandatory=$true)][System.Exception]$Exception)

  $cause = $Exception.GetBaseException()
  switch ($cause.GetType().Name) {
    'UnauthorizedAccessException' { return 'access_denied' }
    'FileNotFoundException' { return 'path_missing' }
    'DirectoryNotFoundException' { return 'path_missing' }
    'IOException' { return 'io_error' }
    'ArgumentException' { return 'invalid_argument' }
    default { return 'other' }
  }
}

function Test-BostanArchiveHashFixtures {
  $fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('bostan-hash-fixture-' + [Guid]::NewGuid().ToString('N'))
  $null = [System.IO.Directory]::CreateDirectory($fixtureRoot)
  $validPath = Join-Path $fixtureRoot 'valid.bin'
  $missingPath = Join-Path $fixtureRoot 'missing.bin'
  $deniedPath = Join-Path $fixtureRoot 'denied.bin'
  $denyRuleAdded = $false
  $icacls = Join-Path $env:SystemRoot 'System32\icacls.exe'

  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes('bostan-hash-fixture-v1')
    [System.IO.File]::WriteAllBytes($validPath, $bytes)
    $expectedSha256 = '61738181e73e31f175e039d4c272c223fcb283002ce27cf27e1a7356b36c0d26'
    $validSha256 = Get-BostanArchiveSha256 -LiteralPath $validPath
    if ($validSha256 -ne $expectedSha256) { throw 'fixture_valid_hash_failed' }
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FIXTURE_PASS phase=valid'

    $corruptedBytes = [byte[]]$bytes.Clone()
    $corruptedBytes[0] = $corruptedBytes[0] -bxor 1
    [System.IO.File]::WriteAllBytes($validPath, $corruptedBytes)
    $corruptedSha256 = Get-BostanArchiveSha256 -LiteralPath $validPath
    if ($corruptedSha256 -eq $expectedSha256) { throw 'fixture_corruption_detection_failed' }
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FIXTURE_PASS phase=corruption_detected'

    $missingCategory = $null
    try { $null = Get-BostanArchiveSha256 -LiteralPath $missingPath }
    catch { $missingCategory = Get-BostanArchiveFailureCategory -Exception $_.Exception }
    if ($missingCategory -ne 'path_missing') { throw 'fixture_missing_file_classification_failed' }
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FIXTURE_PASS phase=missing_file'

    [System.IO.File]::WriteAllBytes($deniedPath, $bytes)
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $denyPrincipal = '*' + $identity.User.Value + ':(R)'
    $denyRuleAdded = $true
    $null = & $icacls $deniedPath '/deny' $denyPrincipal '/Q' 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'fixture_access_denied_acl_setup_failed' }
    $accessCategory = $null
    try { $null = Get-BostanArchiveSha256 -LiteralPath $deniedPath }
    catch { $accessCategory = Get-BostanArchiveFailureCategory -Exception $_.Exception }
    if ($accessCategory -ne 'access_denied') { throw 'fixture_access_denied_classification_failed' }
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FIXTURE_PASS phase=access_denied'

    $wrongExpectedSha256 = '0000000000000000000000000000000000000000000000000000000000000000'
    $digestMatchesWrongExpectation = $validSha256 -eq $wrongExpectedSha256
    if ($digestMatchesWrongExpectation) { throw 'fixture_digest_mismatch_detection_failed' }
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FIXTURE_PASS phase=digest_mismatch'

    if ($denyRuleAdded) {
      $null = & $icacls $deniedPath '/reset' '/Q' 2>&1
      if ($LASTEXITCODE -ne 0) { throw 'fixture_access_denied_acl_restore_failed' }
      $denyRuleAdded = $false
    }
    [System.IO.File]::Move($validPath, (Join-Path $fixtureRoot 'moved.bin'))
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FIXTURE_PASS phase=stream_disposed'
  } finally {
    $aclCleanupFailed = $false
    if ($denyRuleAdded -and [System.IO.File]::Exists($deniedPath)) {
      $null = & $icacls $deniedPath '/reset' '/Q' 2>&1
      $aclCleanupFailed = ($LASTEXITCODE -ne 0)
    }
    try {
      if ([System.IO.Directory]::Exists($fixtureRoot)) {
        [System.IO.Directory]::Delete($fixtureRoot, $true)
      }
    } catch {
      throw 'archive hash fixture cleanup failed'
    }
    if ($aclCleanupFailed) { throw 'archive hash fixture ACL cleanup failed' }
  }
}
