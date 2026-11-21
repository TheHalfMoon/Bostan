import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createPackagingStage } from "./packaging-stage.mjs";
import { writeInstallPayloadManifest } from "./install-payload-manifest.mjs";

const EXPECTED_7ZA_SHA256 = "223b873c50380fe9a39f1a22b6abf8d46db506e1c08d08312902f6f3cd1f7ac3";
const EXPECTED_EXTRACT_TEMPLATE_SHA256 = "e4174388a0f7a1df0b85a0742aa1ea7a4b2b18f9f29dccd6ef10a66212f68148";

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function safeDefinePath(file) {
  const value = path.resolve(file);
  if (/[\r\n"$]/.test(value)) throw new Error("Unsupported Windows installer support path");
  return value;
}

function compilerPath() {
  const root = process.env.WINDIR || "C:/Windows";
  for (const relative of ["Microsoft.NET/Framework64/v4.0.30319/csc.exe", "Microsoft.NET/Framework/v4.0.30319/csc.exe"]) {
    const candidate = path.join(root, ...relative.split("/"));
    if (fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) return candidate;
  }
  throw new Error("A pinned Windows .NET Framework C# compiler is required for the installer extractor");
}

function extractorMacro() {
  return `!macro extractUsing7za FILE
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5
  Push $OUTDIR
  IfErrors BostanExtractIncomingError
  StrCpy $R4 "0"
  Goto BostanExtractIncomingCaptured
  BostanExtractIncomingError:
    StrCpy $R4 "1"
  BostanExtractIncomingCaptured:
  ClearErrors
  File /oname=$PLUGINSDIR\\BostanExtractor.exe "${"${BOSTAN_EXTRACTOR}"}"
  File /oname=$PLUGINSDIR\\7za.exe "${"${BOSTAN_7ZA}"}"
  File /oname=$PLUGINSDIR\\7za-LICENSE.txt "${"${BOSTAN_7ZA_LICENSE}"}"
  File /oname=$PLUGINSDIR\\7za-COPYING.txt "${"${BOSTAN_7ZA_COPYING}"}"
  File /oname=$PLUGINSDIR\\bostan-runtime-payload.tsv "${"${BOSTAN_RUNTIME_MANIFEST}"}"
  Pop $R3
  SetOutPath $R3

  System::Call "Kernel32::GetCurrentProcessId() i.R5"
  StrCpy $R1 0
  BostanExtractRetryLoop:
    IntOp $R1 $R1 + 1
    nsExec::ExecToStack /TIMEOUT=300000 '\"$PLUGINSDIR\\BostanExtractor.exe\" \"${"${FILE}"}\" \"$OUTDIR\" \"$PLUGINSDIR\\bostan-runtime-payload.tsv\" \"$R5\"'
    Pop $R0
    Pop $R2
  StrCmp $R0 "0" BostanExtractSuccess
    DetailPrint "Bostan extraction failed (code $R0)."
    \${if} $R1 < 5
      Sleep 1000
      Goto BostanExtractRetryLoop
    \${else}
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDCANCEL BostanExtractAbort
      Goto BostanExtractRetryLoop
    \${endIf}

  BostanExtractAbort:
    SetErrorLevel 2
    Quit

  BostanExtractSuccess:
    !insertmacro BostanQaPhase "extraction_direct_complete"
    StrCmp $R4 "1" BostanRestoreIncomingError
    ClearErrors
    Goto BostanRestoreRegisters
  BostanRestoreIncomingError:
    SetErrors
  BostanRestoreRegisters:
    Pop $R5
    Pop $R4
    Pop $R3
    Pop $R2
    Pop $R1
    Pop $R0
!macroend`;
}

/** Prepare an isolated, hash-pinned direct-extraction override for Windows NSIS only. */
export async function prepareWindowsInstallerExtraction({ desktop, payload }) {
  if (process.platform !== "win32") throw new Error("Windows installer extraction is only prepared on Windows");
  const owned = createPackagingStage(desktop);
  try {
    const support = path.dirname(owned.directory);
    const overrideDir = path.join(support, "include");
    fs.mkdirSync(overrideDir);
    const require = createRequire(path.join(desktop, "package.json"));
    require("electron-builder");
    const { getPath7za } = require("app-builder-lib/out/toolsets/7zip.js");
    const sevenZip = await getPath7za();
    assert.equal(sha256(sevenZip), EXPECTED_7ZA_SHA256, "Unexpected pinned Windows 7-Zip extractor");
    const sevenZipRoot = path.dirname(path.dirname(sevenZip));
    const license = path.join(sevenZipRoot, "LICENSE.txt");
    const copying = path.join(sevenZipRoot, "COPYING");
    assert.ok(fs.statSync(license, { throwIfNoEntry: false })?.isFile(), "7-Zip license notice is missing");
    assert.ok(fs.statSync(copying, { throwIfNoEntry: false })?.isFile(), "7-Zip COPYING notice is missing");

    const launcherSource = path.join(desktop, "scripts", "windows-extract-job-launcher.cs");
    const launcher = path.join(support, "BostanExtractor.exe");
    const compiled = spawnSync(compilerPath(), ["/nologo", "/target:exe", "/platform:anycpu", "/out:" + launcher, launcherSource], {
      cwd: desktop, windowsHide: true, encoding: "utf8", timeout: 30000, stdio: "pipe",
    });
    if (compiled.error || compiled.status !== 0 || compiled.signal) throw new Error("Could not compile the Windows extraction job launcher");

    const manifest = path.join(support, "bostan-runtime-payload.tsv");
    writeInstallPayloadManifest(payload, manifest);
    const pinnedTemplate = path.join(desktop, "node_modules", "app-builder-lib", "templates", "nsis", "include", "extractAppPackage.nsh");
    const original = fs.readFileSync(pinnedTemplate, "utf8");
    assert.equal(sha256(pinnedTemplate), EXPECTED_EXTRACT_TEMPLATE_SHA256, "Pinned NSIS extraction template changed");
    const marker = "!macro extractUsing7za FILE";
    assert.equal(original.split(marker).length - 1, 1, "Unexpected pinned NSIS extraction macro layout");
    const override = path.join(overrideDir, "extractAppPackage.nsh");
    fs.writeFileSync(override, original.replace(/!macro extractUsing7za FILE[\s\S]*?!macroend/, extractorMacro()), { flag: "wx" });

    const include = path.join(support, "installer.nsh");
    fs.copyFileSync(path.join(desktop, "scripts", "installer.nsh"), include, fs.constants.COPYFILE_EXCL);
    const includeDirectory = safeDefinePath(overrideDir);
    const definitions = {
      BOSTAN_EXTRACTOR: safeDefinePath(launcher),
      BOSTAN_7ZA: safeDefinePath(sevenZip),
      BOSTAN_7ZA_LICENSE: safeDefinePath(license),
      BOSTAN_7ZA_COPYING: safeDefinePath(copying),
      BOSTAN_RUNTIME_MANIFEST: safeDefinePath(manifest),
    };
    return {
      include,
      definitions,
      inventoryComponent: {
        name: "7-Zip standalone extractor", version: "24.09",
        declaredLicense: "7-Zip license: LGPL-2.1-or-later with unRAR restriction; also BSD/public-domain components",
        noticeFiles: ["embedded:$PLUGINSDIR\\7za-LICENSE.txt", "embedded:$PLUGINSDIR\\7za-COPYING.txt"],
      },
      effectiveOptionComputed(options) {
        assert.ok(Array.isArray(options) && options.length === 2, "Unexpected electron-builder NSIS option callback");
        const [defines, commands] = options;
        Object.assign(defines, definitions);
        const previous = commands["!addincludedir"];
        const directories = previous == null ? [] : Array.isArray(previous) ? previous : [previous];
        commands["!addincludedir"] = [`"${includeDirectory}"`, ...directories];
        return false;
      },
      dispose: () => owned.dispose(),
    };
  } catch (error) {
    owned.dispose();
    throw error;
  }
}
