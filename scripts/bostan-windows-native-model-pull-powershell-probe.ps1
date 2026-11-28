param(
  [Parameter(Mandatory=$true)][string]$HelperPath,
  [Parameter(Mandatory=$true)][string]$NodePath,
  [Parameter(Mandatory=$true)][string]$StdoutPath,
  [Parameter(Mandatory=$true)][string]$StderrPath
)
$ErrorActionPreference = 'Stop'
$modelPullReceiptLine = $null
& $NodePath $HelperPath --executable $NodePath --model 'qwen2.5-coder:1.5b' --stdout $StdoutPath --stderr $StderrPath | ForEach-Object {
  $line = [string]$_
  Write-Output $line
  if ($line -match '^BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=(unavailable|-?[0-9]{1,10}) elapsedSeconds=(?:unavailable|(?:[0-9]{1,4}|[1-7][0-9]{4}|8[0-5][0-9]{3}|86[0-3][0-9]{2}|86400)) diagnostic=(access_denied|authorization|disk_space|model_unavailable|network|other|output_limit|resource) failureClass=(io_error|none|output_limit|process_exit|process_launch|process_state) outputBytes=([0-9]{1,7}) childClose=(closed|unconfirmed)$') {
    $modelPullReceiptLine = $line
  }
}
$runnerExitCode = $LASTEXITCODE
if ($modelPullReceiptLine -notmatch '^BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=1 elapsedSeconds=(?:[0-9]{1,4}|[1-7][0-9]{4}|8[0-5][0-9]{3}|86[0-3][0-9]{2}|86400) diagnostic=[a-z_]+ failureClass=process_exit outputBytes=[0-9]{1,7} childClose=closed$' -or $runnerExitCode -ne 1) {
  throw 'Windows PowerShell 5.1 did not preserve the model-pull child exit receipt'
}
Write-Output 'BOSTAN_WINDOWS_POWERSHELL5_MODEL_PULL_PASS child_exit=1 runner_exit=1'
