$ErrorActionPreference = 'Stop'
$registryRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
if (-not (Test-Path -LiteralPath $registryRoot)) {
  Write-Output '[]'
  exit 0
}
$entries = @(Get-ChildItem -LiteralPath $registryRoot | ForEach-Object {
  $registration = Get-ItemProperty -LiteralPath $_.PSPath
  if ($registration.PSChildName -eq $env:BOSTAN_QA_UNINSTALL_KEY -or
      $registration.DisplayName -eq $env:BOSTAN_QA_PRODUCT_NAME -or
      $registration.DisplayName -eq $env:BOSTAN_QA_DISPLAY_NAME) {
    [PSCustomObject]@{
      key = $registration.PSChildName
      displayName = $registration.DisplayName
      displayVersion = $registration.DisplayVersion
      uninstallString = $registration.UninstallString
    }
  }
})
ConvertTo-Json -InputObject $entries -Compress
