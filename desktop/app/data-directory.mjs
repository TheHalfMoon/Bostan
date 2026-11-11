import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const windowsAclScript = `
$ErrorActionPreference='Stop'
[Console]::Error.WriteLine('BOSTAN_ACL_PHASE:start')
$user=[Security.Principal.WindowsIdentity]::GetCurrent().User
[Console]::Error.WriteLine('BOSTAN_ACL_PHASE:identity_ready')
# Use .NET constructors directly. New-Object invokes PowerShell command/module
# discovery, which can stall in a minimal environment before any ACL is built.
$acl=[Security.AccessControl.DirectorySecurity]::new()
$acl.SetOwner($user)
$acl.SetAccessRuleProtection($true,$false)
$inherit=[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
foreach($sid in @($user.Value,'S-1-5-18','S-1-5-32-544')) {
  $identity=[Security.Principal.SecurityIdentifier]::new($sid)
  $rule=[Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl',$inherit,'None','Allow')
  $acl.AddAccessRule($rule)
}
[Console]::Error.WriteLine('BOSTAN_ACL_PHASE:policy_ready')
[IO.Directory]::SetAccessControl($env:BOSTAN_DESKTOP_DATA_DIR,$acl)
[Console]::Error.WriteLine('BOSTAN_ACL_PHASE:policy_written')
$actual=[IO.Directory]::GetAccessControl($env:BOSTAN_DESKTOP_DATA_DIR)
if(-not $actual.AreAccessRulesProtected) { throw 'ACL inheritance is not protected' }
$rules=@($actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
$allowed=@($user.Value,'S-1-5-18','S-1-5-32-544')
if($rules.Count -ne 3) { throw 'Unexpected ACL rules' }
foreach($rule in $rules) {
  if($rule.IsInherited -or $rule.AccessControlType -ne 'Allow' -or $rule.IdentityReference.Value -notin $allowed) { throw 'Unexpected ACL identity' }
}
[Console]::Error.WriteLine('BOSTAN_ACL_PHASE:verified')
Write-Output 'BOSTAN_DESKTOP_DATA_ACL_READY'
`;

export function protectDataDirectory(directory) {
  if (!path.isAbsolute(directory)) throw new Error("Bostan data directory must be absolute");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (!fs.lstatSync(directory).isDirectory() || fs.lstatSync(directory).isSymbolicLink()) throw new Error("Unsafe Bostan data directory");
  if (process.platform !== "win32") {
    if (fs.statSync(directory).uid !== process.getuid()) throw new Error("Bostan data directory has a different owner");
    fs.chmodSync(directory, 0o700);
    return;
  }
  const root = process.env.SystemRoot;
  if (!/^[A-Za-z]:\\Windows$/i.test(root ?? "")) throw new Error("Bostan Windows security tools are unavailable");
  const binary = path.join(root, "System32/WindowsPowerShell/v1.0/powershell.exe");
  try {
    const output = execFileSync(binary, ["-NoProfile", "-NonInteractive", "-Command", windowsAclScript], {
      windowsHide: true, encoding: "utf8", timeout: 15000, maxBuffer: 4096,
      env: { SystemRoot: root, WINDIR: root, BOSTAN_DESKTOP_DATA_DIR: directory }, stdio: ["ignore", "pipe", "pipe"],
    });
    if (output.trim() !== "BOSTAN_DESKTOP_DATA_ACL_READY") throw new Error();
  } catch (cause) {
    // Keep diagnostics bounded to fixed stage names: PowerShell errors may
    // contain local paths. The user-facing startup message stays concise.
    const phases = [...String(cause.stderr ?? "").matchAll(/BOSTAN_ACL_PHASE:(start|identity_ready|policy_ready|policy_written|verified)(?:\r?\n|$)/g)];
    const error = new Error("Bostan could not secure its data directory; startup stopped without opening the database");
    error.code = "BOSTAN_DESKTOP_DATA_SECURITY_FAILED";
    error.details = Object.freeze({ kind: cause.code === "ETIMEDOUT" ? "timeout" : "failed", phase: phases.at(-1)?.[1] ?? "unknown" });
    throw error;
  }
}
