function Get-BostanNativeModelPullDiagnostic {
  param(
    [Parameter(Mandatory=$true)][string]$StdoutPath,
    [Parameter(Mandatory=$true)][string]$StderrPath
  )
  $outputBytes = 0L
  $readFailed = $false
  $diagnosticText = New-Object System.Text.StringBuilder
  foreach ($outputPath in @($StdoutPath, $StderrPath)) {
    $stream = $null
    try {
      $stream = [IO.File]::Open($outputPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
    } catch [IO.FileNotFoundException] { continue }
    catch [IO.DirectoryNotFoundException] { continue }
    catch { $readFailed = $true; continue }
    try {
      $outputBytes += $stream.Length
      $stream.Position = [Math]::Max(0L, $stream.Length - 32768L)
      $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::UTF8, $true, 4096, $true)
      try {
        $buffer = New-Object char[] 4096
        $streamCharacters = 0
        while ($streamCharacters -lt 32768) {
          $read = $reader.Read($buffer, 0, [Math]::Min($buffer.Length, 32768 - $streamCharacters))
          if ($read -le 0) { break }
          [void]$diagnosticText.Append($buffer, 0, $read)
          $streamCharacters += $read
        }
      } finally { $reader.Dispose() }
    } catch { $readFailed = $true }
    finally { $stream.Dispose() }
  }
  $text = $diagnosticText.ToString()
  $diagnostic = 'other'
  if ($text -match '(?i)(no space left|not enough space|disk full|insufficient disk)') { $diagnostic = 'disk_space' }
  elseif ($text -match '(?i)(unauthorized|forbidden|terms? (?:of )?service|license acceptance|\bHTTP\s*(?:401|403)\b)') { $diagnostic = 'authorization' }
  elseif ($text -match '(?i)(manifest.*(?:unknown|not found)|model.*(?:unknown|not found|does not exist))') { $diagnostic = 'model_unavailable' }
  elseif ($text -match '(?i)(out of memory|allocation failed|resource exhausted|not enough memory)') { $diagnostic = 'resource' }
  elseif ($text -match '(?i)(access denied|permission denied)') { $diagnostic = 'access_denied' }
  elseif ($text -match '(?i)(resolve|dns|proxy|network|tls|certificate|timed out|deadline exceeded|unexpected eof|\beof\b|context canceled|connection (?:refused|reset|closed)|failed to connect|could not connect)') { $diagnostic = 'network' }
  return [PSCustomObject]@{
    OutputBytes = $outputBytes
    ReadFailed = $readFailed
    OutputLimitExceeded = ($outputBytes -gt 1048576)
    Diagnostic = $diagnostic
  }
}
