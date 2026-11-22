$ErrorActionPreference = 'Stop'
$ollamaVersion = '0.40.17'
$ollamaSha256 = '3dd80f6e3a9699f2eadf4ac418f00529cee594df9557541806eda1f1f3f5588a'
$modelManifestSha256 = 'd7372fd828518a4d38b1eb196c673c31a85f2ed302b3d1e406c4c2d1b64a0668'
$ollamaRoot = Join-Path $env:RUNNER_TEMP 'bostan-native-ollama'
$zipPath = Join-Path $env:RUNNER_TEMP 'ollama-windows-amd64.zip'
$modelRoot = Join-Path $ollamaRoot 'models'
$server = $null

try {
  New-Item -ItemType Directory -Path $ollamaRoot -Force | Out-Null
  $zipUrl = "https://github.com/ollama/ollama/releases/download/v$ollamaVersion/ollama-windows-amd64.zip"
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash.ToLowerInvariant() -ne $ollamaSha256) {
    throw 'Pinned Ollama Windows archive digest mismatch'
  }
  Expand-Archive -LiteralPath $zipPath -DestinationPath $ollamaRoot -Force
  $ollamaMatches = @(Get-ChildItem -LiteralPath $ollamaRoot -Filter ollama.exe -File -Recurse)
  if ($ollamaMatches.Count -ne 1) { throw 'Expected one Ollama executable in the verified archive' }
  $ollamaExe = $ollamaMatches[0].FullName
  $versionOutput = (& $ollamaExe --version | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $versionOutput -notmatch [regex]::Escape($ollamaVersion)) {
    throw 'Unexpected Ollama runtime version'
  }

  $env:OLLAMA_HOST = 'http://127.0.0.1:11434'
  $env:OLLAMA_MODELS = $modelRoot
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

  & $ollamaExe pull qwen2.5-coder:1.5b
  if ($LASTEXITCODE -ne 0) { throw 'Pinned local Qwen model pull failed' }
  $modelInfo = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 10
  $model = @($modelInfo.models | Where-Object { $_.name -eq 'qwen2.5-coder:1.5b' })
  if ($model.Count -ne 1 -or $model[0].digest -ne $modelManifestSha256) {
    throw 'Local Qwen model manifest digest mismatch'
  }
  $showBody = @{ model = 'qwen2.5-coder:1.5b' } | ConvertTo-Json -Compress
  $show = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:11434/api/show' `
    -ContentType 'application/json' -Body $showBody -TimeoutSec 20
  if ($show.license -notmatch 'Apache License') { throw 'Pinned local Qwen model license metadata is not Apache' }

  $resources = node -e "const os=require('node:os'),fs=require('node:fs');const d=fs.statfsSync(os.tmpdir());console.log(JSON.stringify({totalMemoryGiB:+(os.totalmem()/2**30).toFixed(2),freeMemoryGiB:+(os.freemem()/2**30).toFixed(2),tempFreeGiB:+(d.bavail*d.bsize/2**30).toFixed(2)}))"
  if ($LASTEXITCODE -ne 0) { throw 'Hosted Windows resource inspection failed' }
  Write-Output "BOSTAN_NATIVE_WINDOWS_RESOURCES_AFTER_MODEL_SETUP $resources"

  $env:BOSTAN_E2E_CONFIRM_TEMP_DATA = '1'
  $env:BOSTAN_E2E_ALLOW_LOCAL_MODEL = '1'
  $env:BOSTAN_E2E_MODEL_MODE = 'local-ollama'
  $env:BOSTAN_E2E_FREE_MODEL = 'ollama/qwen2.5-coder:1.5b'
  $env:BOSTAN_E2E_APP_EXE = (Resolve-Path 'desktop/dist/win-unpacked/Bostan.exe').Path
  $env:BOSTAN_E2E_OPENCODE_EXE = (Resolve-Path 'desktop/dist/win-unpacked/resources/runtime/node_modules/.pnpm/opencode-windows-x64-baseline@1.18.34/node_modules/opencode-windows-x64-baseline/bin/opencode.exe').Path
  node scripts/bostan-windows-packaged-free-first-agent-qa.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Packaged Windows native local-model acceptance failed' }
} finally {
  if ($server -and -not $server.HasExited) {
    & taskkill.exe /PID $server.Id /T /F | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Owned Ollama process tree cleanup was not confirmed' }
  }
  $tempRoot = [IO.Path]::GetFullPath($env:RUNNER_TEMP)
  $targetRoot = [IO.Path]::GetFullPath($ollamaRoot)
  if ($targetRoot -ne [IO.Path]::GetFullPath((Join-Path $tempRoot 'bostan-native-ollama'))) {
    throw 'Refusing Ollama cleanup outside its isolated runner TEMP directory'
  }
  Remove-Item -LiteralPath $targetRoot -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
}
