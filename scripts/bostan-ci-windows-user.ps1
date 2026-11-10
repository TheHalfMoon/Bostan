param(
  [ValidateSet('Server','Installer')][string]$Mode = 'Server'
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
  $process = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -ArgumentList $arguments -Credential $credential -LoadUserProfile -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -Wait -PassThru
  Get-Content -LiteralPath $stdout
  if ((Get-Item -LiteralPath $stderr).Length -gt 0) { Get-Content -LiteralPath $stderr | Write-Output }
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
