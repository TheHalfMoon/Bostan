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
    'SecurityException' { return 'access_denied' }
    'FileNotFoundException' { return 'path_missing' }
    'DirectoryNotFoundException' { return 'path_missing' }
    'PathTooLongException' { return 'path_too_long' }
    'InvalidDataException' { return 'invalid_archive' }
    'IOException' { return 'io_error' }
    'NotSupportedException' { return 'unsupported' }
    'ArgumentException' { return 'invalid_argument' }
    default { return 'other' }
  }
}

function Expand-BostanVerifiedArchive {
  param(
    [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$LiteralPath,
    [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$DestinationPath
  )

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $destinationRoot = [System.IO.Path]::GetFullPath($DestinationPath)
  $separator = [System.IO.Path]::DirectorySeparatorChar
  $backslash = [char]92
  $rootPrefix = $destinationRoot.TrimEnd([char[]]@($backslash, [char]47)) + $separator
  $archive = $null
  try {
    $archive = [System.IO.Compression.ZipFile]::OpenRead($LiteralPath)
    if ($archive.Entries.Count -gt 100000) { throw [System.IO.InvalidDataException]::new('archive_entry_limit') }
    $null = [System.IO.Directory]::CreateDirectory($destinationRoot)
    foreach ($entry in $archive.Entries) {
      $name = [string]$entry.FullName
      if ([string]::IsNullOrEmpty($name) -or $name.IndexOf([char]0) -ge 0 -or [System.IO.Path]::IsPathRooted($name)) {
        throw [System.IO.InvalidDataException]::new('archive_entry_path_invalid')
      }
      $segments = $name.Split([char[]]@([char]47, $backslash), [System.StringSplitOptions]::RemoveEmptyEntries)
      if ($segments.Count -eq 0 -or @($segments | Where-Object { $_ -eq '.' -or $_ -eq '..' -or $_.Contains(':') }).Count -gt 0) {
        throw [System.IO.InvalidDataException]::new('archive_entry_path_invalid')
      }
      $relativeName = $name.Replace([char]47, $separator).Replace($backslash, $separator)
      $targetPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($destinationRoot, $relativeName))
      if (-not $targetPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw [System.IO.InvalidDataException]::new('archive_entry_path_invalid')
      }
      $unixFileType = ([int64]$entry.ExternalAttributes -shr 16) -band 0xF000
      if ($unixFileType -eq 0xA000) { throw [System.IO.InvalidDataException]::new('archive_symlink_not_allowed') }
      $isDirectory = $name.EndsWith([string][char]47) -or $name.EndsWith([string]$backslash) -or $unixFileType -eq 0x4000
      if ($isDirectory) {
        $null = [System.IO.Directory]::CreateDirectory($targetPath)
        continue
      }
      $parentPath = [System.IO.Path]::GetDirectoryName($targetPath)
      $null = [System.IO.Directory]::CreateDirectory($parentPath)
      $sourceStream = $null
      $targetStream = $null
      try {
        $sourceStream = $entry.Open()
        $targetStream = [System.IO.File]::Open($targetPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        $sourceStream.CopyTo($targetStream, 81920)
      } finally {
        if ($targetStream) { $targetStream.Dispose() }
        if ($sourceStream) { $sourceStream.Dispose() }
      }
    }
  } finally {
    if ($archive) { $archive.Dispose() }
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

function Test-BostanArchiveExtractionFixture {
  $fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('bostan-extract-fixture-' + [Guid]::NewGuid().ToString('N'))
  $sourceRoot = Join-Path $fixtureRoot 'source'
  $extractRoot = Join-Path $fixtureRoot 'extract'
  $archivePath = Join-Path $fixtureRoot 'fixture.zip'
  $unsafeArchivePath = Join-Path $fixtureRoot 'unsafe.zip'
  $unsafeExtractRoot = Join-Path $fixtureRoot 'unsafe-extract'
  $outsidePath = Join-Path $fixtureRoot 'outside.txt'
  $corruptArchivePath = Join-Path $fixtureRoot 'corrupt.zip'
  $expected = 'bostan-verified-archive-fixture-v1'
  $null = [System.IO.Directory]::CreateDirectory($sourceRoot)
  try {
    [System.IO.File]::WriteAllText((Join-Path $sourceRoot 'ollama.exe'), $expected, [System.Text.Encoding]::UTF8)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($sourceRoot, $archivePath)
    Expand-BostanVerifiedArchive -LiteralPath $archivePath -DestinationPath $extractRoot
    $matches = @(Get-ChildItem -LiteralPath $extractRoot -Filter 'ollama.exe' -File -Recurse)
    if ($matches.Count -ne 1) { throw 'fixture_executable_discovery_failed' }
    if ([System.IO.File]::ReadAllText($matches[0].FullName).TrimStart([char]0xFEFF) -ne $expected) {
      throw 'fixture_extraction_content_failed'
    }
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_OPERATION_PASS step=extract_fixture'

    $unsafeArchive = [System.IO.Compression.ZipFile]::Open($unsafeArchivePath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
      $unsafeEntry = $unsafeArchive.CreateEntry('../outside.txt')
      $unsafeStream = $unsafeEntry.Open()
      try {
        $unsafeBytes = [System.Text.Encoding]::UTF8.GetBytes('unsafe')
        $unsafeStream.Write($unsafeBytes, 0, $unsafeBytes.Length)
      } finally {
        $unsafeStream.Dispose()
      }
    } finally {
      $unsafeArchive.Dispose()
    }
    $unsafeCategory = $null
    try {
      Expand-BostanVerifiedArchive -LiteralPath $unsafeArchivePath -DestinationPath $unsafeExtractRoot
      throw 'fixture_archive_traversal_was_not_rejected'
    } catch {
      $unsafeCategory = Get-BostanArchiveFailureCategory -Exception $_.Exception
    }
    if ($unsafeCategory -ne 'invalid_archive' -or [System.IO.File]::Exists($outsidePath)) {
      throw 'fixture_archive_traversal_rejection_failed'
    }
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_OPERATION_PASS step=reject_traversal'

    [System.IO.File]::WriteAllText($corruptArchivePath, 'not a zip archive')
    $corruptCategory = $null
    try {
      Expand-BostanVerifiedArchive -LiteralPath $corruptArchivePath -DestinationPath (Join-Path $fixtureRoot 'corrupt-extract')
      throw 'fixture_corrupt_archive_was_not_rejected'
    } catch {
      $corruptCategory = Get-BostanArchiveFailureCategory -Exception $_.Exception
    }
    if ($corruptCategory -notin @('invalid_archive', 'io_error')) { throw 'fixture_corrupt_archive_rejection_failed' }
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_OPERATION_PASS step=reject_corrupt'
  } finally {
    if ([System.IO.Directory]::Exists($fixtureRoot)) {
      [System.IO.Directory]::Delete($fixtureRoot, $true)
    }
  }
}
