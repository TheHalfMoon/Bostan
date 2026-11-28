$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'bostan-windows-native-model-diagnostics.ps1')
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([char[]]@([char]92, [char]47))
$probeToken = [Guid]::NewGuid().ToString('N')
$probeDirectory = Join-Path $tempRoot "bostan-native-model-diagnostics-$probeToken"
$stdoutPath = Join-Path $probeDirectory 'stdout.log'
$stderrPath = Join-Path $probeDirectory 'stderr.log'
if ([IO.Directory]::Exists($probeDirectory) -or [IO.File]::Exists($probeDirectory)) { throw 'Refusing pre-existing model diagnostic fixture path' }
try {
  $null = [IO.Directory]::CreateDirectory($probeDirectory)
  [IO.File]::WriteAllText($stdoutPath, ('progress ' * 12000) + "`nTLS certificate validation failed")
  [IO.File]::WriteAllText($stderrPath, ('rendering ' * 12000) + "`nUnauthorized model response")
  $bothStreams = Get-BostanNativeModelPullDiagnostic -StdoutPath $stdoutPath -StderrPath $stderrPath
  if ($bothStreams.Diagnostic -ne 'authorization' -or $bothStreams.OutputBytes -ne ((Get-Item -LiteralPath $stdoutPath).Length + (Get-Item -LiteralPath $stderrPath).Length) -or $bothStreams.ReadFailed -or $bothStreams.OutputLimitExceeded) {
    throw 'Bounded dual-stream tail classification fixture failed'
  }
  [IO.File]::WriteAllText($stdoutPath, ('progress ' * 9000) + "`nTLS certificate validation failed")
  [IO.File]::WriteAllText($stderrPath, '')
  $tail = Get-BostanNativeModelPullDiagnostic -StdoutPath $stdoutPath -StderrPath $stderrPath
  if ($tail.Diagnostic -ne 'network') { throw 'Terminal stdout diagnostic was lost behind progress output' }
  [IO.File]::WriteAllText($stdoutPath, ('x' * 1048577))
  [IO.File]::WriteAllText($stdoutPath, ('x' * 600000))
  [IO.File]::WriteAllText($stderrPath, ('y' * 448576))
  $atLimit = Get-BostanNativeModelPullDiagnostic -StdoutPath $stdoutPath -StderrPath $stderrPath
  if ($atLimit.OutputLimitExceeded -or $atLimit.OutputBytes -ne 1048576) { throw 'Exact combined model diagnostic cap fixture failed' }
  [IO.File]::WriteAllText($stdoutPath, ('x' * 600001))
  $overLimit = Get-BostanNativeModelPullDiagnostic -StdoutPath $stdoutPath -StderrPath $stderrPath
  if (-not $overLimit.OutputLimitExceeded -or $overLimit.OutputBytes -ne 1048577) { throw 'Model diagnostic output cap fixture failed' }
  $missing = Get-BostanNativeModelPullDiagnostic -StdoutPath (Join-Path $probeDirectory 'missing.out') -StderrPath (Join-Path $probeDirectory 'missing.err')
  if ($missing.OutputBytes -ne 0 -or $missing.ReadFailed -or $missing.Diagnostic -ne 'other') { throw 'Missing diagnostic files were not handled as empty input' }
  Write-Output 'BOSTAN_NATIVE_MODEL_DIAGNOSTICS_PROBE_PASS cases=dual_stream_tail,terminal_stdout_tail,exact_combined_limit,output_limit,missing_files'
} finally {
  $resolvedDirectory = [IO.Path]::GetFullPath($probeDirectory)
  $expectedDirectory = [IO.Path]::GetFullPath((Join-Path $tempRoot "bostan-native-model-diagnostics-$probeToken"))
  if ($resolvedDirectory -ne $expectedDirectory -or -not $resolvedDirectory.StartsWith($tempRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing model diagnostic fixture cleanup outside its owned TEMP directory'
  }
  if ([IO.Directory]::Exists($resolvedDirectory)) { Remove-Item -LiteralPath $resolvedDirectory -Recurse -Force }
}
