function Get-BostanAllowedFirstAgentRunDiagnostic([string]$line) {
  $prefix = 'BOSTAN_PACKAGED_FIRST_AGENT_RUN_DIAGNOSTIC '
  if (-not $line.StartsWith($prefix, [StringComparison]::Ordinal)) { return $null }
  if ($line.Length -gt 4096) { return $false }
  try {
    $record = ConvertFrom-Json -InputObject $line.Substring($prefix.Length) -ErrorAction Stop
    if (-not $record -or $record -is [System.Array]) { return $false }
    $actual = @($record.PSObject.Properties.Name)
    $allowed = @('status','errorCode','executionStage','safeSignal','events','log')
    foreach ($field in $actual) { if ($allowed -cnotcontains [string]$field) { return $false } }
    foreach ($field in @('status','errorCode','executionStage','events','log')) {
      if ($actual -cnotcontains $field) { return $false }
    }

    if ($record.status -isnot [string] -or $record.status -cnotin @('failed','timed_out','cancelled','interrupted')) { return $false }
    if ($null -ne $record.errorCode -and ($record.errorCode -isnot [string] -or $record.errorCode -notmatch '^[a-z][a-z0-9_]{0,63}$')) { return $false }
    if ($null -ne $record.executionStage -and
      ($record.executionStage -isnot [string] -or $record.executionStage -cnotin @('preparing','dispatching','executing','settled'))) { return $false }

    $allowedSignals = @(
      'adapter_rate_limit_signaled','adapter_provider_unavailable_signaled','adapter_timeout_signaled',
      'native_semantic_result_missing','native_terminal_event_missing','native_permission_declined',
      'native_provider_model_rejected','native_provider_approval_required','native_provider_usage_limit',
      'native_provider_initialize_timeout','native_provider_initialize_protocol_error','native_provider_request_timeout',
      'native_provider_request_protocol_error','native_provider_output_closed','native_provider_process_exited',
      'native_provider_transport_failed','native_provider_runtime_missing','native_provider_terminal_failed',
      'native_provider_executable_missing','native_provider_executable_denied','native_provider_auth_rejected',
      'native_provider_timeout','native_provider_connection_refused'
    )
    if ($actual -ccontains 'safeSignal' -and $null -ne $record.safeSignal -and
      ($record.safeSignal -isnot [string] -or $allowedSignals -cnotcontains $record.safeSignal)) { return $false }

    $eventFields = @('available','harnessReady','sessionStarted','sessionResumed','turnStarted','turnCompleted','turnFailed','turnCancelled','turnInterrupted','providerEvents','providerRpcResults')
    $eventProperties = @($record.events.PSObject.Properties.Name)
    if ($record.events -is [System.Array] -or $eventProperties.Count -ne $eventFields.Count) { return $false }
    foreach ($field in $eventProperties) { if ($eventFields -cnotcontains [string]$field) { return $false } }
    if ($record.events.available -isnot [bool]) { return $false }
    foreach ($field in $eventFields | Where-Object { $_ -ne 'available' }) {
      $value = $record.events.$field
      if ((($value -isnot [int]) -and ($value -isnot [long])) -or $value -lt 0 -or $value -gt 200) { return $false }
    }

    $logFields = @('available','bytes','safeSignal','jsonLines','errorRecords','recordsWithErrorField','recordsWithCodeField')
    if ($record.log -is [System.Array]) { return $false }
    $logProperties = @($record.log.PSObject.Properties.Name)
    if ($logProperties.Count -eq 3) {
      $minimalLogFields = @('available','bytes','safeSignal')
      foreach ($field in $logProperties) { if ($minimalLogFields -cnotcontains [string]$field) { return $false } }
      if ($record.log.available -isnot [bool] -or $record.log.available -or
        (($record.log.bytes -isnot [int]) -and ($record.log.bytes -isnot [long])) -or
        $record.log.bytes -ne 0 -or $null -ne $record.log.safeSignal) { return $false }
      $record.log | Add-Member -NotePropertyName jsonLines -NotePropertyValue 0 -Force
      $record.log | Add-Member -NotePropertyName errorRecords -NotePropertyValue 0 -Force
      $record.log | Add-Member -NotePropertyName recordsWithErrorField -NotePropertyValue 0 -Force
      $record.log | Add-Member -NotePropertyName recordsWithCodeField -NotePropertyValue 0 -Force
      $logProperties = @($record.log.PSObject.Properties.Name)
    }
    if ($logProperties.Count -ne $logFields.Count) { return $false }
    foreach ($field in $logProperties) { if ($logFields -cnotcontains [string]$field) { return $false } }
    if ($record.log.available -isnot [bool]) { return $false }
    if ((($record.log.bytes -isnot [int]) -and ($record.log.bytes -isnot [long])) -or $record.log.bytes -lt 0 -or $record.log.bytes -gt 262144) { return $false }
    if ($null -ne $record.log.safeSignal -and ($record.log.safeSignal -isnot [string] -or $allowedSignals -cnotcontains $record.log.safeSignal)) { return $false }
    foreach ($field in @('jsonLines','errorRecords','recordsWithErrorField','recordsWithCodeField')) {
      $value = $record.log.$field
      if ((($value -isnot [int]) -and ($value -isnot [long])) -or $value -lt 0 -or $value -gt 200) { return $false }
    }

    $safeRecord = [ordered]@{
      status = [string]$record.status
      errorCode = $record.errorCode
      executionStage = $record.executionStage
    }
    if ($actual -ccontains 'safeSignal') { $safeRecord['safeSignal'] = $record.safeSignal }
    $safeRecord['events'] = [ordered]@{
      available = [bool]$record.events.available
      harnessReady = [int]$record.events.harnessReady
      sessionStarted = [int]$record.events.sessionStarted
      sessionResumed = [int]$record.events.sessionResumed
      turnStarted = [int]$record.events.turnStarted
      turnCompleted = [int]$record.events.turnCompleted
      turnFailed = [int]$record.events.turnFailed
      turnCancelled = [int]$record.events.turnCancelled
      turnInterrupted = [int]$record.events.turnInterrupted
      providerEvents = [int]$record.events.providerEvents
      providerRpcResults = [int]$record.events.providerRpcResults
    }
    $safeRecord['log'] = [ordered]@{
      available = [bool]$record.log.available
      bytes = [long]$record.log.bytes
      safeSignal = $record.log.safeSignal
      jsonLines = [int]$record.log.jsonLines
      errorRecords = [int]$record.log.errorRecords
      recordsWithErrorField = [int]$record.log.recordsWithErrorField
      recordsWithCodeField = [int]$record.log.recordsWithCodeField
    }
    return $prefix + (ConvertTo-Json -InputObject $safeRecord -Compress -Depth 4)
  } catch { return $false }
}

function Get-BostanAllowedNativeResourceDiagnostic([string]$line) {
  $prefix = 'BOSTAN_NATIVE_WINDOWS_RESOURCES_AFTER_MODEL_SETUP '
  if (-not $line.StartsWith($prefix, [StringComparison]::Ordinal)) { return $null }
  if ($line.Length -gt 512) { return $false }
  try {
    $record = ConvertFrom-Json -InputObject $line.Substring($prefix.Length) -ErrorAction Stop
    if (-not $record -or $record -is [System.Array]) { return $false }
    $fields = @('totalMemoryGiB','freeMemoryGiB','tempFreeGiB')
    $actual = @($record.PSObject.Properties.Name)
    if ($actual.Count -ne $fields.Count) { return $false }
    foreach ($field in $actual) { if ($fields -cnotcontains [string]$field) { return $false } }
    foreach ($field in $fields) {
      $value = $record.$field
      if ((($value -isnot [int]) -and ($value -isnot [long]) -and ($value -isnot [double]) -and ($value -isnot [decimal])) -or
        [double]::IsNaN([double]$value) -or [double]::IsInfinity([double]$value)) { return $false }
    }
    if ($record.totalMemoryGiB -lt 1 -or $record.totalMemoryGiB -gt 512 -or
      $record.freeMemoryGiB -lt 0 -or $record.freeMemoryGiB -gt ($record.totalMemoryGiB + 0.01) -or
      $record.tempFreeGiB -lt 0 -or $record.tempFreeGiB -gt 1000000) { return $false }
    $safeRecord = [ordered]@{
      totalMemoryGiB = [Math]::Round([double]$record.totalMemoryGiB, 2)
      freeMemoryGiB = [Math]::Round([double]$record.freeMemoryGiB, 2)
      tempFreeGiB = [Math]::Round([double]$record.tempFreeGiB, 2)
    }
    return $prefix + (ConvertTo-Json -InputObject $safeRecord -Compress -Depth 2)
  } catch { return $false }
}
