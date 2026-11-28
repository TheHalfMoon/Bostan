$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'bostan-ci-windows-run-diagnostic.ps1')

$events = [ordered]@{
  available = $true; harnessReady = 1; sessionStarted = 1; sessionResumed = 0
  turnStarted = 1; turnCompleted = 0; turnFailed = 1; turnCancelled = 0
  turnInterrupted = 0; providerEvents = 3; providerRpcResults = 2
  nativeFailure = [ordered]@{
    sourceFailureCode = 'provider_process_exited'; recoveryMode = 'bootstrap_retry'
    providerSessionEstablished = $false; providerEventsExist = $false; checkpointExists = $false
    safeSignal = 'native_provider_process_exited'
  }
}
$log = [ordered]@{
  available = $true; bytes = 4096L; safeSignal = 'native_provider_timeout'
  jsonLines = 6; errorRecords = 1; recordsWithErrorField = 1; recordsWithCodeField = 1
}
$diagnostic = [ordered]@{
  status = 'failed'; errorCode = 'adapter_failed'; executionStage = 'settled'
  safeSignal = 'native_provider_timeout'; failureClass = 'database_statement_timeout'; events = $events; log = $log
}
$prefix = 'BOSTAN_PACKAGED_FIRST_AGENT_RUN_DIAGNOSTIC '
$valid = Get-BostanAllowedFirstAgentRunDiagnostic ($prefix + (ConvertTo-Json -InputObject $diagnostic -Compress -Depth 5))
if ($valid -isnot [string] -or -not $valid.StartsWith($prefix, [StringComparison]::Ordinal)) {
  throw 'valid sanitized first-agent diagnostic was rejected'
}
$roundTrip = ConvertFrom-Json -InputObject $valid.Substring($prefix.Length)
if ($roundTrip.status -ne 'failed' -or $roundTrip.errorCode -ne 'adapter_failed' -or
  $roundTrip.executionStage -ne 'settled' -or $roundTrip.safeSignal -ne 'native_provider_timeout' -or
  $roundTrip.failureClass -ne 'database_statement_timeout' -or
  $roundTrip.events.turnFailed -ne 1 -or $roundTrip.log.errorRecords -ne 1 -or
  $roundTrip.events.nativeFailure.sourceFailureCode -ne 'provider_process_exited' -or
  $roundTrip.events.nativeFailure.recoveryMode -ne 'bootstrap_retry' -or
  $roundTrip.events.nativeFailure.safeSignal -ne 'native_provider_process_exited') {
  throw 'bounded first-agent diagnostic fields were not preserved'
}
if ($valid -match 'C:\\Users|password|token=|secret|private') {
  throw 'first-agent diagnostic exposed sensitive fixture text'
}

$unavailable = [ordered]@{}
foreach ($property in $diagnostic.GetEnumerator()) { $unavailable[$property.Key] = $property.Value }
$unavailable['log'] = [ordered]@{ available = $false; bytes = 0L; safeSignal = $null }
$unavailableReceipt = Get-BostanAllowedFirstAgentRunDiagnostic ($prefix + (ConvertTo-Json -InputObject $unavailable -Compress -Depth 5))
if ($unavailableReceipt -isnot [string]) { throw 'minimal unavailable-log diagnostic was rejected' }
$unavailableRoundTrip = ConvertFrom-Json -InputObject $unavailableReceipt.Substring($prefix.Length)
if ($unavailableRoundTrip.events.turnFailed -ne 1 -or $unavailableRoundTrip.log.available -or
  $unavailableRoundTrip.log.bytes -ne 0 -or $unavailableRoundTrip.log.jsonLines -ne 0 -or
  $unavailableRoundTrip.log.errorRecords -ne 0) {
  throw 'unavailable-log diagnostic was not normalized with zero counts'
}

$withSecret = [ordered]@{}
foreach ($property in $diagnostic.GetEnumerator()) { $withSecret[$property.Key] = $property.Value }
$withSecret['providerOutput'] = 'private token=must-not-escape'
if (Get-BostanAllowedFirstAgentRunDiagnostic ($prefix + (ConvertTo-Json -InputObject $withSecret -Compress -Depth 5))) {
  throw 'unexpected diagnostic fields were accepted'
}

$badSignal = [ordered]@{}
foreach ($property in $diagnostic.GetEnumerator()) { $badSignal[$property.Key] = $property.Value }
$badSignal['safeSignal'] = 'provider_private_secret'
if (Get-BostanAllowedFirstAgentRunDiagnostic ($prefix + (ConvertTo-Json -InputObject $badSignal -Compress -Depth 5))) {
  throw 'unknown safe signal was accepted'
}

$badNativeFailure = [ordered]@{}
foreach ($property in $diagnostic.GetEnumerator()) { $badNativeFailure[$property.Key] = $property.Value }
$badNativeFailure['events'] = [ordered]@{}
foreach ($property in $events.GetEnumerator()) { $badNativeFailure['events'][$property.Key] = $property.Value }
$badNativeFailure['events']['nativeFailure'] = [ordered]@{
  sourceFailureCode = 'private_provider_failure'; recoveryMode = 'bootstrap_retry'
  providerSessionEstablished = $false; providerEventsExist = $false; checkpointExists = $false
  safeSignal = 'native_provider_process_exited'
}
if (Get-BostanAllowedFirstAgentRunDiagnostic ($prefix + (ConvertTo-Json -InputObject $badNativeFailure -Compress -Depth 6))) {
  throw 'unknown native failure source code was accepted'
}

$badStage = [ordered]@{}
foreach ($property in $diagnostic.GetEnumerator()) { $badStage[$property.Key] = $property.Value }
$badStage['executionStage'] = @('settled','private')
if (Get-BostanAllowedFirstAgentRunDiagnostic ($prefix + (ConvertTo-Json -InputObject $badStage -Compress -Depth 5))) {
  throw 'non-scalar execution stage was accepted'
}

$badFailureClass = [ordered]@{}
foreach ($property in $diagnostic.GetEnumerator()) { $badFailureClass[$property.Key] = $property.Value }
$badFailureClass['failureClass'] = 'private error text'
if (Get-BostanAllowedFirstAgentRunDiagnostic ($prefix + (ConvertTo-Json -InputObject $badFailureClass -Compress -Depth 5))) {
  throw 'unknown first-agent failure class was accepted'
}

$badCount = [ordered]@{}
foreach ($property in $diagnostic.GetEnumerator()) { $badCount[$property.Key] = $property.Value }
$badEvents = [ordered]@{}
foreach ($property in $events.GetEnumerator()) { $badEvents[$property.Key] = $property.Value }
$badEvents['turnFailed'] = 201
$badCount['events'] = $badEvents
if (Get-BostanAllowedFirstAgentRunDiagnostic ($prefix + (ConvertTo-Json -InputObject $badCount -Compress -Depth 5))) {
  throw 'unbounded event count was accepted'
}

if (Get-BostanAllowedFirstAgentRunDiagnostic ($prefix + ('x' * 4100))) {
  throw 'oversized diagnostic line was accepted'
}

$resourcePrefix = 'BOSTAN_NATIVE_WINDOWS_RESOURCES_AFTER_MODEL_SETUP '
$resourceLine = $resourcePrefix + '{"totalMemoryGiB":16,"freeMemoryGiB":3.25,"tempFreeGiB":12.5}'
$resourceReceipt = Get-BostanAllowedNativeResourceDiagnostic $resourceLine
if ($resourceReceipt -isnot [string] -or -not $resourceReceipt.StartsWith($resourcePrefix, [StringComparison]::Ordinal)) {
  throw 'valid native resource receipt was rejected'
}
$resourceValues = ConvertFrom-Json -InputObject $resourceReceipt.Substring($resourcePrefix.Length)
if ($resourceValues.totalMemoryGiB -ne 16 -or $resourceValues.freeMemoryGiB -ne 3.25 -or $resourceValues.tempFreeGiB -ne 12.5) {
  throw 'native resource receipt did not preserve bounded numeric measurements'
}
if (Get-BostanAllowedNativeResourceDiagnostic ($resourcePrefix + '{"totalMemoryGiB":16,"freeMemoryGiB":3,"tempFreeGiB":12,"path":"C:\\Users\\private"}')) {
  throw 'native resource receipt accepted an unexpected field'
}

Write-Output 'BOSTAN_CI_FIRST_AGENT_RUN_DIAGNOSTIC_PROBE_PASS cases=valid,unavailable_log,extra_field,unsafe_signal,unsafe_native_failure,non_scalar_stage,unsafe_failure_class,bounded_counts,oversized_line,resources,unsafe_resource'
