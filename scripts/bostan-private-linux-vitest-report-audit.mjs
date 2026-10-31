// B1-124: audit the exact Vitest JSON result, not just its exit status.
// Vitest can succeed while all rootless bubblewrap integration tests skip.
import { readFileSync } from "node:fs";

export const REQUIRED_NATIVE_SANDBOX_CASES = Object.freeze([
  "prevents reads outside the workspace while allowing workspace writes",
  "runs the adapter-utils TypeScript build inside the confined workspace",
  "denies direct network egress",
  "allows only configured network targets through the proxy bridge",
]);

export const REQUIRED_SANDBOX_SUITES = Object.freeze([
  "local-process-sandbox.test.ts",
  "execution-target-sandbox.test.ts",
  "paperclip-runner-permissions.test.ts",
  "sandbox-install-command.test.ts",
]);

export function auditNativeSandboxReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report) ||
      report.success !== true || report.numFailedTests !== 0 ||
      !Array.isArray(report.testResults)) {
    throw new Error("Vitest JSON summary is missing, unsuccessful, or has failed tests");
  }
  const targetSuites = report.testResults.filter(
    (suite) => typeof suite?.name === "string" &&
      REQUIRED_SANDBOX_SUITES.some((name) => suite.name.endsWith("/" + name) || suite.name === name),
  );
  for (const file of REQUIRED_SANDBOX_SUITES) {
    const suites = targetSuites.filter(
      (suite) => suite.name === file || suite.name.endsWith("/" + file),
    );
    if (suites.length !== 1 || suites[0].status !== "passed") {
      throw new Error(`Required sandbox suite missing, duplicated, or not passed: ${file}`);
    }
  }
  const sandbox = targetSuites.find(
    (suite) => suite.name === REQUIRED_SANDBOX_SUITES[0] ||
      suite.name.endsWith("/" + REQUIRED_SANDBOX_SUITES[0]),
  );
  if (!Array.isArray(sandbox?.assertionResults)) {
    throw new Error("Sandbox assertion results are missing");
  }
  for (const title of REQUIRED_NATIVE_SANDBOX_CASES) {
    const matching = sandbox.assertionResults.filter(
      (entry) => entry && entry.title === title,
    );
    if (matching.length !== 1 || matching[0].status !== "passed") {
      throw new Error(`Required rootless bubblewrap test missing, skipped, or failed: ${title}`);
    }
  }
  return {
    suites: REQUIRED_SANDBOX_SUITES.length,
    rootlessCases: REQUIRED_NATIVE_SANDBOX_CASES.length,
  };
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  try {
    const filename = process.argv[2];
    if (!filename) throw new Error("A concrete Vitest JSON report path is required");
    const report = JSON.parse(readFileSync(filename, "utf8"));
    const result = auditNativeSandboxReport(report);
    process.stdout.write(
      `BOSTAN_B124_VERIFIED_SUITES=${result.suites}\nBOSTAN_B124_VERIFIED_ROOTLESS_CASES=${result.rootlessCases}\n`,
    );
  } catch (error) {
    process.stderr.write(`BOSTAN_B124_REPORT_REFUSED: ${error.message}\n`);
    process.exitCode = 1;
  }
}
