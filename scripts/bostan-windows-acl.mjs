import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

// This helper only protects *disposable* Windows Bostan source-QA paths.
// A consumer Windows install needs a separately reviewed security model.
const WINDOWS_PRIVATE_ACL_PS = String.raw`
$ErrorActionPreference = 'Stop'
$target = $env:BOSTAN_QA_ACL_TARGET
$action = $env:BOSTAN_QA_ACL_ACTION
if (-not $target -or ($action -ne 'apply' -and $action -ne 'verify')) { throw 'Invalid ACL request' }
$item = Get-Item -LiteralPath $target -Force
if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
  throw 'Unsafe Bostan ACL target'
}
$user = ([Security.Principal.WindowsIdentity]::GetCurrent()).User.Value
$allowed = @($user, 'S-1-5-18', 'S-1-5-32-544')
if ($action -eq 'apply') {
  # Replace, do not merely modify inherited ACEs. TEMP parents can have
  # explicit access for other sandbox users which inheritance:r preserves.
  $sddl = "D:P(A;OICI;FA;;;$user)(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)"
  $acl = [IO.Directory]::GetAccessControl($target)
  $acl.SetSecurityDescriptorSddlForm($sddl, [Security.AccessControl.AccessControlSections]::Access)
  [IO.Directory]::SetAccessControl($target, $acl)
}
$actual = [IO.Directory]::GetAccessControl($target)
if (-not $actual.AreAccessRulesProtected) { throw 'Bostan private ACL inheritance is enabled' }
$rules = @($actual.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
if ($rules.Count -ne 3) { throw 'Bostan private ACL has unexpected entries' }
$seen = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($rule in $rules) {
  $sid = $rule.IdentityReference.Value
  if ($allowed -notcontains $sid -or $rule.IsInherited -or
      $rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or
      ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne
        [Security.AccessControl.FileSystemRights]::FullControl -or
      ($rule.InheritanceFlags -band [Security.AccessControl.InheritanceFlags]::ContainerInherit) -eq 0 -or
      ($rule.InheritanceFlags -band [Security.AccessControl.InheritanceFlags]::ObjectInherit) -eq 0) {
    throw 'Unexpected Bostan private ACL permission'
  }
  [void]$seen.Add($sid)
}
if ($seen.Count -ne 3) { throw 'Missing mandatory Bostan private ACL principal' }
Write-Output 'BOSTAN_PRIVATE_WINDOWS_DACL_VERIFIED'
`;

export function windowsPrivateAclTarget(home) {
  if (process.platform !== "win32") throw new Error("Windows-only Bostan ACL operation");
  if (!home || !path.isAbsolute(home) || path.normalize(home) !== home) {
    throw new Error("Invalid disposable Windows HOME");
  }
  const temp = fs.realpathSync(os.tmpdir()).toLowerCase();
  const actualHome = fs.realpathSync(home).toLowerCase();
  if (!actualHome.startsWith(temp + path.sep) || actualHome === temp
    || fs.lstatSync(home).isSymbolicLink()) {
    throw new Error("Refusing NTFS ACL changes outside a disposable TEMP HOME");
  }
  const appRoot = path.join(home, ".bostan");
  const stat = fs.lstatSync(appRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Unsafe Bostan private directory");
  }
  return appRoot;
}

export function enforceWindowsQaPrivateAcl(home, { fresh = false } = {}) {
  const root = windowsPrivateAclTarget(home);
  const sysRoot = process.env.SystemRoot || process.env.WINDIR;
  if (!sysRoot || !path.isAbsolute(sysRoot)) {
    throw new Error("Windows system PowerShell path unavailable");
  }
  const powershell = path.join(sysRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const encoded = Buffer.from(WINDOWS_PRIVATE_ACL_PS, "utf16le").toString("base64");
  try {
    const output = execFileSync(powershell, [
      "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded,
    ], {
      env: {
        ...process.env,
        BOSTAN_QA_ACL_TARGET: root,
        BOSTAN_QA_ACL_ACTION: fresh ? "apply" : "verify",
      },
      encoding: "utf8",
      timeout: 20_000,
      windowsHide: true,
      maxBuffer: 256 * 1024,
    });
    if (!output.includes("BOSTAN_PRIVATE_WINDOWS_DACL_VERIFIED")) {
      throw new Error("Windows ACL verifier did not confirm protection");
    }
  } catch {
    // Avoid including child error output that may contain private paths.
    throw new Error("Bostan Windows TEMP-QA private ACL check failed; refusing local runtime");
  }
  return root;
}
