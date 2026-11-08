import { createHash, timingSafeEqual } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { executionWorkspaces, toolInvocations, type Db } from "@bostan/db";
import { openRunnerApiWorkspaceFile } from "./native-runtime/runner-api-files.js";

// One deliberately small, independently read local artifact; no provider
// response is accepted as evidence. The root MUST come from a trusted,
// company-scoped workspace DB row, never from tool-controlled request bytes.
export const BOSTAN_FILE_READBACK_LIMIT_BYTES = 8 * 1024 * 1024;
export type BostanFileReadbackState = "matches_expected_content" | "content_mismatch" |
  "file_missing" | "unreadable_or_unsafe" | "changed_during_read";

export function validBostanRelativeArtifactPath(value: string): boolean {
  const parts = value.split("/");
  return value.length > 0 && value.length <= 1024 && !path.isAbsolute(value) &&
    !/[\\\x00-\x1f\x7f]/.test(value) &&
    parts.every(part => part.length > 0 && part !== "." && part !== ".." && part.length <= 255);
}

export async function verifyBostanLocalFileContent(input: {
  trustedWorkspaceRoot: string;
  relativePath: string;
  expectedSha256: string;
  expectedByteSize: number;
}): Promise<{ state: BostanFileReadbackState; contentReadbackMatched: boolean }> {
  const result = (state: BostanFileReadbackState) => ({ state, contentReadbackMatched: state === "matches_expected_content" });
  if (!validBostanRelativeArtifactPath(input.relativePath) ||
    !/^[0-9a-f]{64}$/.test(input.expectedSha256) ||
    !Number.isSafeInteger(input.expectedByteSize) || input.expectedByteSize < 0 ||
    input.expectedByteSize > BOSTAN_FILE_READBACK_LIMIT_BYTES) {
    return result("unreadable_or_unsafe");
  }
  try {
    const root = path.resolve(input.trustedWorkspaceRoot);
    // No workspace-root symlink and no implicit fallback to user home.
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return result("unreadable_or_unsafe");
    const canonicalRoot = await realpath(root);
    const filename = path.resolve(canonicalRoot, ...input.relativePath.split("/"));
    if (path.relative(canonicalRoot, filename).startsWith("..") ||
      path.relative(canonicalRoot, filename) === "") return result("unreadable_or_unsafe");
    // Reuse the original runner's no-symlinks-at-any-component opener:
    // O_NOFOLLOW_ANY on macOS and directory-fd traversal on Linux.
    const file = await openRunnerApiWorkspaceFile(filename);
    try {
      const before = await file.stat();
      if (!before.isFile() || before.nlink !== 1 ||
        before.size > BOSTAN_FILE_READBACK_LIMIT_BYTES) return result("unreadable_or_unsafe");
      if (before.size !== input.expectedByteSize) return result("content_mismatch");
      const hash = createHash("sha256");
      const buffer = Buffer.alloc(64 * 1024);
      let offset = 0;
      while (offset < before.size) {
        const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.length, before.size - offset), offset);
        if (!bytesRead) return result("changed_during_read");
        hash.update(buffer.subarray(0, bytesRead));
        offset += bytesRead;
      }
      const after = await file.stat();
      if (!after.isFile() || after.nlink !== 1 ||
        after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs)
        return result("changed_during_read");
      const actual = hash.digest();
      return result(timingSafeEqual(actual, Buffer.from(input.expectedSha256, "hex"))
        ? "matches_expected_content" : "content_mismatch");
    } finally { await file.close(); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return result("file_missing");
    return result("unreadable_or_unsafe");
  }
}

export async function verifyBostanCompanyWorkspaceFile(input: {
  db: Db;
  companyId: string;
  invocationId: string;
  workspaceId: string;
  relativePath: string;
  expectedSha256: string;
  expectedByteSize: number;
}) {
  const [record] = await input.db.select({ invocation: toolInvocations, workspace: executionWorkspaces })
    .from(toolInvocations)
    .innerJoin(executionWorkspaces, and(
      eq(executionWorkspaces.id, input.workspaceId),
      eq(executionWorkspaces.companyId, toolInvocations.companyId),
      eq(executionWorkspaces.sourceIssueId, toolInvocations.issueId),
    ))
    .where(and(eq(toolInvocations.id, input.invocationId),
      eq(toolInvocations.companyId, input.companyId)));
  if (!record) return null;
  const { workspace, invocation } = record;
  // B3-02 is local artifact readback, not an arbitrary remote file getter.
  if (workspace.status !== "active" || workspace.providerType !== "local_fs" ||
    !workspace.cwd || !path.isAbsolute(workspace.cwd) ||
    !["succeeded", "failed", "cancelled", "timed_out"].includes(invocation.status)) {
    return { invocationId: input.invocationId, workspaceId: input.workspaceId,
      state: "unreadable_or_unsafe" as const, contentReadbackMatched: false,
      independentEffectVerified: false, autoRetrySafe: false };
  }
  const observed = await verifyBostanLocalFileContent({
    trustedWorkspaceRoot: workspace.cwd, relativePath: input.relativePath,
    expectedSha256: input.expectedSha256, expectedByteSize: input.expectedByteSize,
  });
  return {
    invocationId: input.invocationId,
    workspaceId: input.workspaceId,
    ...observed,
    // Identical file bytes alone cannot attribute creation to a tool call,
    // prove an edit happened, or grant an automatic retry.
    independentEffectVerified: false,
    autoRetrySafe: false,
  };
}
