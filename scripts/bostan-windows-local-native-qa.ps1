$ErrorActionPreference = 'Stop'
$ollamaVersion = '0.40.17'
$ollamaSha256 = '3dd80f6e3a9699f2eadf4ac418f00529cee594df9557541806eda1f1f3f5588a'
$ollamaArchiveBytes = 1618522644L
$modelManifestSha256 = 'd7372fd828518a4d38b1eb196c673c31a85f2ed302b3d1e406c4c2d1b64a0668'
$runToken = [Guid]::NewGuid().ToString('N')
$ollamaRoot = Join-Path $env:RUNNER_TEMP "bostan-native-ollama-$runToken"
$zipPath = Join-Path $env:RUNNER_TEMP "ollama-windows-$runToken.zip"
$modelRoot = Join-Path $ollamaRoot 'models'
$server = $null
$modelPull = $null
$modelPullExitCode = $null
$modelPullFailureClass = 'other'
$archiveStream = $null
$ownsOllamaRoot = $false
$ownsArchive = $false
$stage = 'ollama_download'
. (Join-Path $PSScriptRoot 'bostan-windows-native-archive-hash.ps1')
. (Join-Path $PSScriptRoot 'bostan-windows-native-model-diagnostics.ps1')

try {
  $existingArchive = Get-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
  if ($existingArchive) { throw 'Refusing to overwrite an existing Ollama archive path' }
  $archiveReservation = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  $ownsArchive = $true
  $archiveReservation.Dispose()
  Write-Output 'BOSTAN_NATIVE_WINDOWS_PHASE ollama_download_begin'
  $zipUrl = "https://github.com/ollama/ollama/releases/download/v$ollamaVersion/ollama-windows-amd64.zip"
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
  Write-Output 'BOSTAN_NATIVE_WINDOWS_PHASE ollama_download_complete'
  $stage = 'ollama_archive_verify'
  try {
    $archiveStream = [System.IO.File]::Open(
      $zipPath,
      [System.IO.FileMode]::Open,
      [System.IO.FileAccess]::Read,
      [System.IO.FileShare]::Read
    )
    $archiveBytes = $archiveStream.Length
  } catch {
    $statFailure = switch ($_.Exception.GetType().Name) {
      'UnauthorizedAccessException' { 'access_denied' }
      'FileNotFoundException' { 'path_missing' }
      'DirectoryNotFoundException' { 'path_missing' }
      'IOException' { 'io_error' }
      'ArgumentException' { 'invalid_argument' }
      default { 'other' }
    }
    Write-Output "BOSTAN_NATIVE_WINDOWS_ARCHIVE_STAT_FAILURE $statFailure"
    throw 'Pinned Ollama Windows archive size could not be read'
  }
  $archiveSizeMatches = $archiveBytes -eq $ollamaArchiveBytes
  Write-Output "BOSTAN_NATIVE_WINDOWS_ARCHIVE_SIZE sizeBytes=$archiveBytes sizeMatches=$($archiveSizeMatches.ToString().ToLowerInvariant())"
  if (-not $archiveSizeMatches) {
    throw 'Pinned Ollama Windows archive size mismatch'
  }
  try {
    $archiveSha256 = Get-BostanArchiveSha256FromStream -Stream $archiveStream
  } catch {
    $hashFailure = Get-BostanArchiveFailureCategory -Exception $_.Exception
    Write-Output "BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FAILURE $hashFailure"
    throw 'Pinned Ollama Windows archive hash could not be verified'
  }
  $archiveDigestMatches = $archiveSha256 -eq $ollamaSha256
  Write-Output "BOSTAN_NATIVE_WINDOWS_ARCHIVE_VERIFY sizeBytes=$archiveBytes sha256=$archiveSha256 sizeMatches=true digestMatches=$($archiveDigestMatches.ToString().ToLowerInvariant())"
  if (-not $archiveDigestMatches) {
    throw 'Pinned Ollama Windows archive digest mismatch'
  }
  $stage = 'ollama_archive_extract'
  try {
    $existingRoot = Get-Item -LiteralPath $ollamaRoot -Force -ErrorAction SilentlyContinue
    if ($existingRoot) { throw 'Refusing to extract into an existing Ollama root' }
    $null = New-Item -ItemType Directory -Path $ollamaRoot -ErrorAction Stop
    $ownsOllamaRoot = $true
    Expand-BostanVerifiedArchive -ArchiveStream $archiveStream -DestinationPath $ollamaRoot -DestinationCreatedByCaller
  } catch {
    $extractFailure = Get-BostanArchiveFailureCategory -Exception $_.Exception
    Write-Output "BOSTAN_NATIVE_WINDOWS_ARCHIVE_OPERATION_FAILURE step=extract cause=$extractFailure"
    throw 'Verified Ollama archive extraction failed'
  }
  Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_OPERATION_PASS step=extract'
  $archiveStream.Dispose()
  $archiveStream = $null
  $stage = 'ollama_executable_discovery'
  $ollamaMatches = @(Get-ChildItem -LiteralPath $ollamaRoot -Filter ollama.exe -File -Recurse)
  Write-Output "BOSTAN_NATIVE_WINDOWS_ARCHIVE_EXECUTABLES count=$($ollamaMatches.Count)"
  if ($ollamaMatches.Count -ne 1) {
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_OPERATION_FAILURE step=executable_discovery cause=unexpected_count'
    throw 'Expected one Ollama executable in the verified archive'
  }
  Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_OPERATION_PASS step=executable_discovery'
  $ollamaExe = $ollamaMatches[0].FullName
  $stage = 'ollama_version_verify'
  try {
    $versionOutput = (& $ollamaExe --version | Out-String).Trim()
    $versionExitSucceeded = $LASTEXITCODE -eq 0
  } catch {
    $versionFailure = Get-BostanArchiveFailureCategory -Exception $_.Exception
    Write-Output "BOSTAN_NATIVE_WINDOWS_ARCHIVE_OPERATION_FAILURE step=version_verify cause=$versionFailure"
    throw 'Verified Ollama runtime version check could not execute'
  }
  $versionMatches = $versionOutput -match [regex]::Escape($ollamaVersion)
  Write-Output "BOSTAN_NATIVE_WINDOWS_OLLAMA_VERSION exit=$(if ($versionExitSucceeded) { 'success' } else { 'failure' }) versionMatches=$($versionMatches.ToString().ToLowerInvariant())"
  if (-not $versionExitSucceeded -or -not $versionMatches) {
    Write-Output 'BOSTAN_NATIVE_WINDOWS_ARCHIVE_OPERATION_FAILURE step=version_verify cause=version_mismatch'
    throw 'Unexpected Ollama runtime version'
  }
  Write-Output 'BOSTAN_NATIVE_WINDOWS_PHASE ollama_archive_verified'

  $env:OLLAMA_HOST = 'http://127.0.0.1:11434'
  $env:OLLAMA_MODELS = $modelRoot
  $stage = 'ollama_server_start'
  $server = Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $ollamaRoot 'serve.stdout.log') `
    -RedirectStandardError (Join-Path $ollamaRoot 'serve.stderr.log')
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    if ($server.HasExited) { throw 'Owned local Ollama server exited before readiness' }
    try {
      $null = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 2
      $ready = $true
      break
    } catch { Start-Sleep -Seconds 1 }
  }
  if (-not $ready) { throw 'Local Ollama loopback health did not become ready' }
  Write-Output 'BOSTAN_NATIVE_WINDOWS_PHASE ollama_server_ready'

  $stage = 'qwen_model_pull'
  $modelPullStdout = Join-Path $ollamaRoot 'model-pull.stdout.log'
  $modelPullStderr = Join-Path $ollamaRoot 'model-pull.stderr.log'
  Write-Output 'BOSTAN_NATIVE_WINDOWS_PHASE qwen_model_pull_begin'
  $modelPull = $null
  try {
  $modelPull = Start-Process -FilePath $ollamaExe -ArgumentList @('pull', 'qwen2.5-coder:1.5b') `
    -PassThru -WindowStyle Hidden -RedirectStandardOutput $modelPullStdout -RedirectStandardError $modelPullStderr
  $modelPullStartedAt = Get-Date
  $lastHeartbeat = 0
  $lastOutputLength = 0L
  do {
    $modelPull.Refresh()
    if ($modelPull.HasExited) { break }
    Start-Sleep -Seconds 5
    $outputLength = 0L
    foreach ($outputPath in @($modelPullStdout, $modelPullStderr)) {
      if (Test-Path -LiteralPath $outputPath) { $outputLength += (Get-Item -LiteralPath $outputPath).Length }
    }
    if ($outputLength -gt 1048576) { throw 'Local Qwen model pull diagnostics exceeded the bounded output cap' }
    $elapsedSeconds = [int]((Get-Date) - $modelPullStartedAt).TotalSeconds
    if ($elapsedSeconds -ge ($lastHeartbeat + 60)) {
      $lastHeartbeat = $elapsedSeconds - ($elapsedSeconds % 60)
      $outputProgress = if ($outputLength -gt $lastOutputLength) { 'advanced' } else { 'stalled' }
      $lastOutputLength = $outputLength
      Write-Output "BOSTAN_NATIVE_MODEL_PULL_WAIT elapsedSeconds=$lastHeartbeat outputProgress=$outputProgress"
    }
  } while (-not $modelPull.HasExited)
  $modelPull.WaitForExit()
  $modelPullExitCode = $modelPull.ExitCode
  $outputLength = 0L
  foreach ($outputPath in @($modelPullStdout, $modelPullStderr)) {
    if (Test-Path -LiteralPath $outputPath) { $outputLength += (Get-Item -LiteralPath $outputPath).Length }
  }
  if ($outputLength -gt 1048576) { throw 'Local Qwen model pull diagnostics exceeded the bounded output cap' }
  if ($modelPullExitCode -ne 0) { throw 'Pinned local Qwen model pull failed' }
  Write-Output 'BOSTAN_NATIVE_WINDOWS_PHASE qwen_model_pull_complete'
  } catch {
    $exceptionType = $_.Exception.GetType().FullName
    if ($_.Exception.Message -eq 'Pinned local Qwen model pull failed') { $modelPullFailureClass = 'process_exit' }
    elseif ($exceptionType -match '^System\.ComponentModel\.Win32Exception$') { $modelPullFailureClass = 'process_launch' }
    elseif ($exceptionType -match '^System\.UnauthorizedAccessException$') { $modelPullFailureClass = 'access_denied' }
    elseif ($exceptionType -match '^System\.IO\.(IOException|DirectoryNotFoundException|FileNotFoundException)$') { $modelPullFailureClass = 'io_error' }
    elseif ($exceptionType -match '^System\.InvalidOperationException$') { $modelPullFailureClass = 'process_state' }
    throw 'Local Qwen model pull operation failed'
  }
  $stage = 'qwen_model_manifest_verify'
  $modelInfo = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 10
  $model = @($modelInfo.models | Where-Object { $_.name -eq 'qwen2.5-coder:1.5b' })
  if ($model.Count -ne 1 -or $model[0].digest -ne $modelManifestSha256) {
    throw 'Local Qwen model manifest digest mismatch'
  }
  Write-Output 'BOSTAN_NATIVE_WINDOWS_PHASE qwen_model_manifest_verified'
  $stage = 'qwen_model_license_verify'
  $showBody = @{ model = 'qwen2.5-coder:1.5b' } | ConvertTo-Json -Compress
  $show = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:11434/api/show' `
    -ContentType 'application/json' -Body $showBody -TimeoutSec 20
  if ($show.license -notmatch 'Apache License') { throw 'Pinned local Qwen model license metadata is not Apache' }
  Write-Output 'BOSTAN_NATIVE_WINDOWS_PHASE qwen_model_license_verified'

  $stage = 'host_resource_verify'
  $resources = node -e "const os=require('node:os'),fs=require('node:fs');const d=fs.statfsSync(os.tmpdir());console.log(JSON.stringify({totalMemoryGiB:+(os.totalmem()/2**30).toFixed(2),freeMemoryGiB:+(os.freemem()/2**30).toFixed(2),tempFreeGiB:+(d.bavail*d.bsize/2**30).toFixed(2)}))"
  if ($LASTEXITCODE -ne 0) { throw 'Hosted Windows resource inspection failed' }
  Write-Output "BOSTAN_NATIVE_WINDOWS_RESOURCES_AFTER_MODEL_SETUP $resources"

  $env:BOSTAN_E2E_CONFIRM_TEMP_DATA = '1'
  $env:BOSTAN_E2E_ALLOW_LOCAL_MODEL = '1'
  $env:BOSTAN_E2E_MODEL_MODE = 'local-ollama'
  $env:BOSTAN_E2E_FREE_MODEL = 'ollama/qwen2.5-coder:1.5b'
  $env:BOSTAN_E2E_ENABLE_LOCAL_AGENT_QA = '1'
  $stage = 'installed_app_qualification'
  node desktop/scripts/qualify-windows-installer.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Packaged Windows native local-model acceptance failed' }
} catch {
  if ($stage -eq 'qwen_model_pull') {
    $pullChildAlive = $false
    $pullExitCode = $modelPullExitCode
    if ($null -ne $modelPull) {
      try {
        $modelPull.Refresh()
        $pullChildAlive = -not $modelPull.HasExited
        if (-not $pullChildAlive -and $null -eq $pullExitCode) { $pullExitCode = $modelPull.ExitCode }
      } catch { $pullChildAlive = $true }
    }
    $pullDiagnostics = Get-BostanNativeModelPullDiagnostic -StdoutPath $modelPullStdout -StderrPath $modelPullStderr
    $pullOutputBytes = [Math]::Min([long]$pullDiagnostics.OutputBytes, 1048576L)
    $pullOutputReadFailed = [bool]$pullDiagnostics.ReadFailed
    $pullOutputLimitExceeded = [bool]$pullDiagnostics.OutputLimitExceeded
    $pullDiagnostic = [string]$pullDiagnostics.Diagnostic
    if ($pullOutputLimitExceeded) {
      Write-Output "BOSTAN_NATIVE_MODEL_PULL_OPERATION_FAILURE cause=output_limit childAlive=$($pullChildAlive.ToString().ToLowerInvariant()) failureClass=$modelPullFailureClass exitCode=$(if ($null -eq $pullExitCode) { 'unavailable' } else { $pullExitCode }) diagnostic=output_limit outputBytes=$pullOutputBytes"
    } elseif ($pullOutputReadFailed) {
      Write-Output "BOSTAN_NATIVE_MODEL_PULL_OPERATION_FAILURE cause=io_error childAlive=$($pullChildAlive.ToString().ToLowerInvariant()) failureClass=$modelPullFailureClass exitCode=$(if ($null -eq $pullExitCode) { 'unavailable' } else { $pullExitCode }) diagnostic=$pullDiagnostic outputBytes=$pullOutputBytes"
    } elseif ($null -ne $pullExitCode -and $pullExitCode -ne 0) {
      Write-Output "BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=$pullExitCode diagnostic=$pullDiagnostic failureClass=$modelPullFailureClass outputBytes=$pullOutputBytes"
    } else {
      $pullCause = 'other'
      if ($null -eq $modelPull) { $pullCause = 'process_launch' }
      elseif ($pullChildAlive) { $pullCause = 'process_state' }
      elseif ($pullExitCode -eq 0) { $pullCause = 'process_state' }
      Write-Output "BOSTAN_NATIVE_MODEL_PULL_OPERATION_FAILURE cause=$pullCause childAlive=$($pullChildAlive.ToString().ToLowerInvariant()) failureClass=$modelPullFailureClass exitCode=$(if ($null -eq $pullExitCode) { 'unavailable' } else { $pullExitCode }) diagnostic=$pullDiagnostic outputBytes=$pullOutputBytes"
    }
  }
  Write-Output "BOSTAN_NATIVE_WINDOWS_FAILURE $stage"
  throw
} finally {
  if ($archiveStream) {
    $archiveStream.Dispose()
    $archiveStream = $null
  }
  if ($modelPull -and -not $modelPull.HasExited) {
    & taskkill.exe /PID $modelPull.Id /T /F | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Owned model-pull process tree cleanup was not confirmed' }
  }
  if ($server -and -not $server.HasExited) {
    & taskkill.exe /PID $server.Id /T /F | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Owned Ollama process tree cleanup was not confirmed' }
  }
  $tempRoot = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd([char[]]@([char]92, [char]47))
  $targetRoot = [IO.Path]::GetFullPath($ollamaRoot)
  $expectedRoot = [IO.Path]::GetFullPath((Join-Path $tempRoot "bostan-native-ollama-$runToken"))
  if ($targetRoot -ne $expectedRoot -or -not $targetRoot.StartsWith($tempRoot + [IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing Ollama cleanup outside its isolated runner TEMP directory'
  }
  if ([System.IO.File]::Exists($targetRoot) -or [System.IO.Directory]::Exists($targetRoot)) {
    if (-not $ownsOllamaRoot) { throw 'Refusing to remove an Ollama path not created by this invocation' }
    if (-not [System.IO.Directory]::Exists($targetRoot)) { throw 'Owned Ollama root has an unexpected file type' }
    $targetAttributes = [System.IO.File]::GetAttributes($targetRoot)
    if (($targetAttributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Refusing Ollama cleanup through a reparse point'
    }
    Remove-Item -LiteralPath $targetRoot -Recurse -Force -ErrorAction Stop
    if ([System.IO.File]::Exists($targetRoot) -or [System.IO.Directory]::Exists($targetRoot)) { throw 'Owned Ollama root cleanup did not complete' }
  }
  $expectedArchive = [IO.Path]::GetFullPath((Join-Path $tempRoot "ollama-windows-$runToken.zip"))
  $archivePath = [IO.Path]::GetFullPath($zipPath)
  if ($archivePath -ne $expectedArchive) { throw 'Refusing archive cleanup outside its isolated runner TEMP directory' }
  if ([System.IO.File]::Exists($archivePath) -or [System.IO.Directory]::Exists($archivePath)) {
    if (-not $ownsArchive) { throw 'Refusing to remove an archive path not created by this invocation' }
    if (-not [System.IO.File]::Exists($archivePath)) { throw 'Owned archive path has an unexpected directory type' }
    $archiveAttributes = [System.IO.File]::GetAttributes($archivePath)
    if (($archiveAttributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Refusing archive cleanup through a reparse point'
    }
    Remove-Item -LiteralPath $archivePath -Force -ErrorAction Stop
    if ([System.IO.File]::Exists($archivePath) -or [System.IO.Directory]::Exists($archivePath)) { throw 'Owned archive cleanup did not complete' }
  }
  Write-Output 'BOSTAN_NATIVE_WINDOWS_CLEANUP_PASS task_owned_temp=true'
}
