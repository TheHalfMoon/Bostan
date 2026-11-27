param(
  [ValidateSet('Server','Installer','PostgresProbe','ArchiveHashProbe','Native')][string]$Mode = 'Server'
)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:CI -ne 'true' -or -not $env:RUNNER_TEMP) {
  Write-Output 'Bostan standard-user qualification requires a disposable GitHub Actions runner.'
  exit 2
}
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ([IO.Path]::GetFullPath($env:GITHUB_WORKSPACE) -ne $repo) { throw 'Unexpected CI checkout' }
$nodeBinary = (Get-Command node.exe).Source
$worker = Join-Path $PSScriptRoot 'bostan-ci-windows-user-worker.ps1'
$nonce = [Guid]::NewGuid().ToString('N').Substring(0,10)
$qaUserName = 'bostanqa' + $nonce
$passwordBytes = New-Object byte[] 32
$random = [Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($passwordBytes)
$random.Dispose()
$qaPassword = ConvertTo-SecureString ('Bq1!' + [Convert]::ToBase64String($passwordBytes)) -AsPlainText -Force
$qaUser = $null
$qaProfile = $null
$qaScratch = Join-Path $env:RUNNER_TEMP ('bostan-standard-user-' + $nonce)
New-Item -ItemType Directory -Path $qaScratch | Out-Null
$exitCode = 1
function Get-AllowedInstallerReceipt([string]$line) {
  if ($line -match '^BOSTAN_WINDOWS_INSTALLER_PHASE (?:pre_init|multiuser_ready|extraction_direct_complete|install_begin|install_failed|install_complete|receipt_check_begin|receipt_check_complete|registration_check_begin|registration_check_complete|signature_check_begin|signature_check_complete|native_agent_begin|native_agent_complete|electron_launch_begin|electron_connected|data_path_verified|first_window|backend_page_ready|forced_stop_failure)$') { return $line }
  if ($line -match '^BOSTAN_WINDOWS_INSTALLER_TIMING \{"elapsedMs":[0-9]+,"budgetMs":300000\}$') { return $line }
  if ($line -match '^BOSTAN_WINDOWS_INSTALLER_FAILURE (?:qualification_failed|signature_check_failed)$') { return $line }
  $failurePrefix = 'BOSTAN_WINDOWS_INSTALLER_FAILURE '
  if ($line.StartsWith($failurePrefix)) {
    try {
      $record = ConvertFrom-Json -InputObject $line.Substring($failurePrefix.Length) -ErrorAction Stop
      $expectedFields = @('entries','installDirectoryPresent','installedExecutable','installerFailed','phases','scanCapped','scanFailed','temporary')
      $actualFields = @($record.PSObject.Properties.Name)
      $actualFieldNames = (@($actualFields | Sort-Object) -join ',')
      $expectedFieldNames = (@($expectedFields | Sort-Object) -join ',')
      if ($actualFieldNames -ne $expectedFieldNames) { return $false }
      $booleanFacts = @($record.installerFailed,$record.installedExecutable,$record.installDirectoryPresent,$record.scanCapped,$record.scanFailed)
      if (@($booleanFacts | Where-Object { $_ -isnot [bool] }).Count -gt 0) { return $false }
      if (($record.entries -isnot [long]) -and ($record.entries -isnot [int])) { return $false }
      if ($record.entries -lt 0 -or $record.entries -gt 4096) { return $false }
      $allowedPhases = @('pre_init','multiuser_ready','extraction_direct_complete','install_complete','unavailable')
      if (@($record.phases).Count -gt 8 -or @($record.phases | Where-Object { $_ -isnot [string] -or $_ -notin $allowedPhases }).Count -gt 0) { return $false }
      $treeFields = @('capped','entries','failed','regularBytes')
      $tree = $record.temporary
      if (-not $tree) { return $false }
      $actualTreeFields = (@($tree.PSObject.Properties.Name | Sort-Object) -join ',')
      $expectedTreeFields = (@($treeFields | Sort-Object) -join ',')
      if ($actualTreeFields -ne $expectedTreeFields) { return $false }
      if ($tree.capped -isnot [bool] -or $tree.failed -isnot [bool]) { return $false }
      if (($tree.entries -isnot [long]) -and ($tree.entries -isnot [int])) { return $false }
      if ($tree.entries -lt 0 -or $tree.entries -gt 4096) { return $false }
      if (($tree.regularBytes -isnot [long]) -and ($tree.regularBytes -isnot [int])) { return $false }
      if ($tree.regularBytes -lt 0) { return $false }
      $safeRecord = [ordered]@{
        installerFailed = [bool]$record.installerFailed
        installedExecutable = [bool]$record.installedExecutable
        installDirectoryPresent = [bool]$record.installDirectoryPresent
        phases = @($record.phases | ForEach-Object { [string]$_ })
        entries = [int]$record.entries
        scanCapped = [bool]$record.scanCapped
        scanFailed = [bool]$record.scanFailed
        temporary = [ordered]@{
          entries = [int]$tree.entries
          regularBytes = [long]$tree.regularBytes
          capped = [bool]$tree.capped
          failed = [bool]$tree.failed
        }
      }
      return $failurePrefix + (ConvertTo-Json -InputObject $safeRecord -Compress -Depth 3)
    } catch { return $false }
  }
  if ($line -match '^BOSTAN_WINDOWS_NSIS_PHASES \[(?:"(?:pre_init|multiuser_ready|extraction_direct_complete|install_complete)"(?:,"(?:pre_init|multiuser_ready|extraction_direct_complete|install_complete)")*)?\]$') { return $line }
  if ($line -match '^BOSTAN_INSTALLED_TASK_PHASE (?:provider_ready|artifact_verified|cancelled_child_stopped|timed_out_child_stopped|task_retry_accepted|operator_reconciliation_recorded|exact_retry_succeeded|restart_persistence_verified)$') { return $line }
  if ($line -eq 'BOSTAN_INSTALLED_WINDOWS_ONBOARDING_RESTART_UNINSTALL_PASS (deterministic process/artifact/control/restart qualification; no real model execution)') { return $line }
  if ($line -match '^BOSTAN_DESKTOP_STARTUP_PHASE (?:window_loaded|data_protected|runtime_valid|child_spawned|utility_bootstrap|importing_server|starting_server|ready)$') { return $line }
  if ($line -match '^BOSTAN_DESKTOP_STARTUP_STAGE (?:STARTUP_FAILED|STARTUP_TIMEOUT|BACKEND_EXITED|RUNTIME_MISSING|ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|ERR_UNKNOWN_FILE_EXTENSION|ERR_DLOPEN_FAILED|ERR_REQUIRE_ESM|ERR_INVALID_PACKAGE_CONFIG|EACCES|EPERM|ENOENT|EADDRINUSE|POSTGRES_LIBRARY_MISSING|POSTGRES_SIGNATURE_INVALID|POSTGRES_LOCALE_INVALID|POSTGRES_PERMISSION_DENIED|POSTGRES_ROOT_REFUSED|POSTGRES_INIT_FAILED|POSTGRES_START_FAILED|POSTGRES_DATABASE_FAILED|POSTGRES_MIGRATION_FAILED|POSTGRES_MIGRATION_CONNECTION_FAILED|POSTGRES_MIGRATION_AUTH_FAILED|POSTGRES_MIGRATION_SCHEMA_FAILED|POSTGRES_MIGRATION_CONSTRAINT_FAILED|POSTGRES_MIGRATION_FEATURE_UNSUPPORTED|POSTGRES_MIGRATION_FILE_MISSING|POSTGRES_BOOTSTRAP_FAILED|DATABASE_BOOTSTRAP_FAILED|DATABASE_MIGRATION_FAILED|SERVER_INSTRUMENTATION_FAILED|SERVER_ERROR_MONITORING_FAILED|SERVER_SIGNING_SECRET_FAILED|SERVER_CONFIG_FAILED|SERVER_RUNTIME_INITIALIZATION_FAILED|SERVER_STARTUP_FAILED)$') { return $line }
  if ($line -match '^BOSTAN_DESKTOP_STARTUP_FAILURE (?:STARTUP_FAILED|STARTUP_TIMEOUT|BACKEND_EXITED|RUNTIME_MISSING|ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|ERR_UNKNOWN_FILE_EXTENSION|ERR_DLOPEN_FAILED|ERR_REQUIRE_ESM|ERR_INVALID_PACKAGE_CONFIG|EACCES|EPERM|ENOENT|EADDRINUSE|POSTGRES_LIBRARY_MISSING|POSTGRES_SIGNATURE_INVALID|POSTGRES_LOCALE_INVALID|POSTGRES_PERMISSION_DENIED|POSTGRES_ROOT_REFUSED|POSTGRES_INIT_FAILED|POSTGRES_START_FAILED|POSTGRES_DATABASE_FAILED|POSTGRES_MIGRATION_FAILED|POSTGRES_MIGRATION_CONNECTION_FAILED|POSTGRES_MIGRATION_AUTH_FAILED|POSTGRES_MIGRATION_SCHEMA_FAILED|POSTGRES_MIGRATION_CONSTRAINT_FAILED|POSTGRES_MIGRATION_FEATURE_UNSUPPORTED|POSTGRES_MIGRATION_FILE_MISSING|POSTGRES_BOOTSTRAP_FAILED|DATABASE_BOOTSTRAP_FAILED|DATABASE_MIGRATION_FAILED|SERVER_INSTRUMENTATION_FAILED|SERVER_ERROR_MONITORING_FAILED|SERVER_SIGNING_SECRET_FAILED|SERVER_CONFIG_FAILED|SERVER_RUNTIME_INITIALIZATION_FAILED|SERVER_STARTUP_FAILED)$') { return $line }
  if ($line -match '^BOSTAN_DESKTOP_STARTUP_MIGRATION \d{4}_[a-z0-9_]+\.sql$') { return $line }
  if ($line -match '^BOSTAN_DESKTOP_STARTUP_MIGRATION_ISSUE POSTGRES_(?:EXTENSION_CONTROL_FILE_MISSING|EXTENSION_SQL_FILE_MISSING|EXTENSION_LIBRARY_MISSING|MIGRATION_FILE_MISSING|EXTENSION_FILE_LOOKUP_FAILED)$') { return $line }
  if ($line -match '^BOSTAN_DESKTOP_STARTUP_SITE (?:server|config|signing):[1-9][0-9]{0,5}:[1-9][0-9]{0,5}$') { return $line }
  if ($line -match '^BOSTAN_NODE_POSTGRES_PROBE_(?:PASS|CLEANUP_PASS|CLEANUP_FAIL|PROCESS_EXIT [01]|PROCESS_EXIT_CODE (?:null|0|[1-9][0-9]{0,2}))$') { return $line }
  if ($line -match '^BOSTAN_NODE_POSTGRES_PROBE_FAIL (?:runtime_prepare|initialize|start|stop) POSTGRES_START_[A-Z0-9_]{1,80}$') { return $line }
  if ($line -match '^BOSTAN_PACKAGED_STARTUP_PHASE (?:window_loaded|data_protected|runtime_valid|child_spawned|utility_bootstrap|importing_server|starting_server|ready)$') { return $line }
  if ($line -match '^BOSTAN_PACKAGED_STARTUP_FAILURE [A-Z0-9_]{1,80}$') { return $line }
  if ($line -match '^BOSTAN_PACKAGED_STARTUP_ISSUE POSTGRES_START_[A-Z0-9_]{1,80}$') { return $line }
  if ($line -match '^BOSTAN_PACKAGED_DESKTOP_(?:PRIVATE_HEALTH|FIRST_ADMIN|NATIVE_AGENT_READY|RESTART_READY|FIRST_TASK_PERSISTENCE|NATIVE_QA_GRACEFUL_SHUTDOWN|NATIVE_QA_TEMP_PROFILE_CLEANUP)_PASS$') { return $line }
  if ($line -match '^BOSTAN_PACKAGED_FIRST_AGENT_FAIL [a-z0-9_]{1,100}$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_PHASE (?:ollama_download_begin|ollama_download_complete|ollama_archive_verified|ollama_server_ready|qwen_model_pull_begin|qwen_model_pull_complete|qwen_model_manifest_verified|qwen_model_license_verified)$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_ARCHIVE_VERIFY sizeBytes=[0-9]{1,12} sha256=[a-f0-9]{64} sizeMatches=(?:true|false) digestMatches=(?:true|false)$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_ARCHIVE_SIZE sizeBytes=[0-9]{1,12} sizeMatches=(?:true|false)$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_ARCHIVE_STAT_FAILURE (?:access_denied|path_missing|io_error|invalid_argument|other)$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FIXTURE_PASS phase=(?:valid|corruption_detected|missing_file|access_denied|digest_mismatch|stream_disposed)$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_(?:STANDARD_USER_PASS|PROBE_PASS)$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_PROBE_FAILURE phase=(?:standard_user|fixtures) cause=(?:access_denied|path_missing|io_error|path_too_long|invalid_archive|unsupported|invalid_argument|other)$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FAILURE (?:access_denied|path_missing|io_error|path_too_long|invalid_archive|unsupported|invalid_argument|other)$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_ARCHIVE_OPERATION_PASS step=(?:extract|executable_discovery|extract_fixture|reject_traversal|reject_existing_root|reject_reparse_parent|reject_symlink|reject_corrupt)$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_ARCHIVE_OPERATION_SKIP step=reparse_parent_fixture_unavailable$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_ARCHIVE_OPERATION_FAILURE step=(?:extract|executable_discovery|version_verify) cause=(?:access_denied|path_missing|io_error|path_too_long|invalid_archive|unsupported|invalid_argument|other|unexpected_count|version_mismatch)$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_ARCHIVE_EXECUTABLES count=\d{1,4}$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_OLLAMA_VERSION exit=(?:success|failure) versionMatches=(?:true|false)$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_CLEANUP_PASS task_owned_temp=true$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_WINDOWS_FAILURE (?:ollama_download|ollama_archive_verify|ollama_archive_extract|ollama_executable_discovery|ollama_version_verify|ollama_server_start|qwen_model_pull|qwen_model_manifest_verify|qwen_model_license_verify|host_resource_verify|installed_app_qualification)$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_MODEL_PULL_WAIT elapsedSeconds=[0-9]{1,4} outputProgress=(?:advanced|stalled)$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=[1-9][0-9]{0,2} diagnostic=(?:authorization|disk_space|model_unavailable|network|other|resource) outputBytes=[0-9]{1,7}$') { return $line }
  if ($line -match '^BOSTAN_NATIVE_MODEL_PULL_OPERATION_FAILURE cause=(?:access_denied|io_error|other|output_limit|process_launch|process_state) childAlive=(?:true|false) outputBytes=[0-9]{1,7}$') { return $line }
  $nativeSuccessPrefix = 'BOSTAN_PACKAGED_DESKTOP_FIRST_FREE_AGENT_TASK_PASS '
  if ($line.StartsWith($nativeSuccessPrefix)) {
    try {
      $record = ConvertFrom-Json -InputObject $line.Substring($nativeSuccessPrefix.Length) -ErrorAction Stop
      $validNativeSuccess = $record.model -eq 'ollama/qwen2.5-coder:1.5b'
      $validNativeSuccess = $validNativeSuccess -and $record.runStatus -eq 'succeeded'
      $validNativeSuccess = $validNativeSuccess -and ($record.exitCode -in @($null, 0))
      $validNativeSuccess = $validNativeSuccess -and $record.costUsd -eq 0 -and $record.taskStatus -eq 'done'
      $validNativeSuccess = $validNativeSuccess -and $record.runAttributedCommentPersisted -eq $true
      $validNativeSuccess = $validNativeSuccess -and $record.gracefulShutdown -eq $true
      $validNativeSuccess = $validNativeSuccess -and $record.temporaryProfileCleanupVerified -eq $true
      if (-not $validNativeSuccess) { return $false }
      return $nativeSuccessPrefix + '{"model":"ollama/qwen2.5-coder:1.5b","runStatus":"succeeded","costUsd":0,"taskStatus":"done","runAttributedCommentPersisted":true,"gracefulShutdown":true,"temporaryProfileCleanupVerified":true}'
    } catch { return $false }
  }
  return $null
}
function Read-InstallerWorkerOutput {
  $script:BostanInstallerBytesRead = 0
  if (-not (Test-Path -LiteralPath $stdout)) { return }
  $stream = [IO.File]::Open($stdout, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
  try {
    $remaining = [Math]::Min($stream.Length - $script:BostanInstallerOutputOffset, [Math]::Max(0, 1048576 - $script:BostanInstallerOutputOffset))
    if ($remaining -le 0) { return }
    $limit = [int][Math]::Min($remaining, 65536)
    $bytes = New-Object byte[] $limit
    $stream.Position = $script:BostanInstallerOutputOffset
    $script:BostanInstallerBytesRead = $stream.Read($bytes, 0, $limit)
    $script:BostanInstallerOutputOffset += $script:BostanInstallerBytesRead
  } finally { $stream.Dispose() }
  $chunk = [Text.Encoding]::UTF8.GetString($bytes, 0, $script:BostanInstallerBytesRead)
  foreach ($character in $chunk.ToCharArray()) {
    if ($character -eq "`n") {
      if (-not $script:BostanInstallerDroppingLine) {
        $receipt = Get-AllowedInstallerReceipt $script:BostanInstallerPending.TrimEnd("`r")
        if ($receipt) { Write-Output $receipt }
      }
      $script:BostanInstallerPending = ''
      $script:BostanInstallerDroppingLine = $false
    } elseif (-not $script:BostanInstallerDroppingLine) {
      if ($script:BostanInstallerPending.Length -ge 4096) {
        $script:BostanInstallerPending = ''
        $script:BostanInstallerDroppingLine = $true
      } else { $script:BostanInstallerPending += $character }
    }
  }
}
try {
  # PostgreSQL refuses an elevated token. Qualify with an actual standard
  # account, rather than weakening PostgreSQL's administrator refusal.
  $qaUser = New-LocalUser -Name $qaUserName -Password $qaPassword -AccountExpires (Get-Date).AddDays(1) -UserMayNotChangePassword
  $usersGroup = Get-LocalGroup -SID 'S-1-5-32-545'
  if (-not (Get-LocalGroupMember -Group $usersGroup | Where-Object { $_.SID -eq $qaUser.SID })) {
    Add-LocalGroupMember -Group $usersGroup -Member $qaUser
  }
  # pnpm's NTFS hardlinks may retain the runner account's cache ACL. Grant
  # this disposable SID read/execute within this disposable checkout only.
  & (Join-Path $env:SystemRoot 'System32\icacls.exe') $repo /grant ('*'+$qaUser.SID.Value+':(OI)(CI)RX') /T /Q
  if ($LASTEXITCODE -ne 0) { throw 'Could not grant CI fixture read access' }
  $credential = New-Object Management.Automation.PSCredential($qaUserName,$qaPassword)
  $stdout = Join-Path $qaScratch 'stdout.log'
  $stderr = Join-Path $qaScratch 'stderr.log'
  $arguments = @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"'+$worker+'"'),'-Mode',$Mode,'-NodeBinary',('"'+$nodeBinary+'"'))
  Write-Output ('BOSTAN_WINDOWS_USER_WORKER_BEGIN mode=' + $Mode)
  $process = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -ArgumentList $arguments -Credential $credential -LoadUserProfile -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
  if ($Mode -in @('Installer','PostgresProbe','ArchiveHashProbe','Native')) {
    # Stream only bounded, validated qualification receipts. Raw stderr and
    # arbitrary stdout stay private to this disposable runner invocation.
    $script:BostanInstallerOutputOffset = [long]0
    $script:BostanInstallerPending = ''
    $script:BostanInstallerDroppingLine = $false
    $startedAt = Get-Date
    $lastHeartbeat = 0
    do {
      Read-InstallerWorkerOutput
      $process.Refresh()
      if (-not $process.HasExited) {
        $elapsedSeconds = [int]((Get-Date) - $startedAt).TotalSeconds
        if ($elapsedSeconds -ge ($lastHeartbeat + 60)) {
          $lastHeartbeat = $elapsedSeconds - ($elapsedSeconds % 60)
          Write-Output ('BOSTAN_WINDOWS_USER_WORKER_WAIT elapsedSeconds=' + $lastHeartbeat)
        }
        Start-Sleep -Seconds 5
      }
    } while (-not $process.HasExited)
    # The worker may have written its terminal receipt while the parent slept.
    # Drain bounded chunks after exit before flushing one final partial line.
    $process.WaitForExit()
    do { Read-InstallerWorkerOutput } while ($script:BostanInstallerBytesRead -gt 0)
    if ($script:BostanInstallerPending -and -not $script:BostanInstallerDroppingLine) {
      $receipt = Get-AllowedInstallerReceipt $script:BostanInstallerPending.TrimEnd("`r")
      if ($receipt) { Write-Output $receipt }
    }
  } else {
    $process.WaitForExit()
  }
  $process.WaitForExit()
  if ($process.ExitCode -isnot [int]) { throw 'CI worker exit status unavailable; qualification refused' }
  if ($Mode -eq 'Server') {
    Get-Content -LiteralPath $stdout
    if ((Get-Item -LiteralPath $stderr).Length -gt 0) { Get-Content -LiteralPath $stderr | Write-Output }
  }
  Write-Output ('BOSTAN_WINDOWS_USER_WORKER_EXIT code=' + $process.ExitCode)
  $exitCode = $process.ExitCode
} finally {
  if ($qaUser) {
    $sid = $qaUser.SID.Value
    $current = Get-LocalUser -SID $qaUser.SID
    if ($current.Name -ne $qaUserName) { throw 'CI account identity changed; cleanup refused' }
    $qaProfile = Get-CimInstance Win32_UserProfile | Where-Object SID -eq $sid
    if ($qaProfile) {
      $expectedProfile = Join-Path ([IO.Path]::GetPathRoot($env:SystemRoot)) ('Users\' + $qaUserName)
      if ($qaProfile.Loaded -or [IO.Path]::GetFullPath($qaProfile.LocalPath) -ne [IO.Path]::GetFullPath($expectedProfile)) {
        throw 'Owned CI profile is still loaded or ambiguous; retained for runner teardown'
      }
      # Windows removes only the profile associated with this newly created SID.
      $qaProfile | Remove-CimInstance
    }
    Remove-LocalUser -SID $qaUser.SID
  }
  # This invocation owns only this fresh log directory. Keep failed diagnostics
  # in Actions output, without retaining plaintext local-account credentials.
  $actual = [IO.Path]::GetFullPath($qaScratch)
  $expectedParent = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\')
  if ([IO.Path]::GetDirectoryName($actual) -ne $expectedParent -or [IO.Path]::GetFileName($actual) -ne ('bostan-standard-user-' + $nonce)) { throw 'CI scratch cleanup refused' }
  if ((Get-Item -LiteralPath $actual).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked CI scratch retained' }
  foreach ($entry in Get-ChildItem -LiteralPath $actual -Force) {
    if ($entry.PSIsContainer -or $entry.Name -notin @('stdout.log','stderr.log') -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unexpected CI scratch entry retained' }
  }
  Remove-Item -LiteralPath $actual -Recurse -Force
}
exit $exitCode
