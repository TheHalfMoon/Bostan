import { describe, expect, it } from "vitest";
import { RUNNER_BRIDGE_SCHEMAS, runnerBridgeDefinitions, runnerTaskDocumentFormatAllowed } from "../services/native-runtime/runner-bridge-tools.js";

const taskId = "11111111-1111-4111-8111-111111111111";
const currentRevision = "22222222-2222-4222-8222-222222222222";

describe("Bostan B5-12 native agent authoring tool contract", () => {
  const schema = RUNNER_BRIDGE_SCHEMAS.get("write_task_document")!;
  it("keeps Markdown default and exposes bounded JSON only as an explicit opt-in format", () => {
    const ordinary = schema.parse({ taskId, key: "notes", title: "Notes", body: "Hello", baseRevisionId: currentRevision });
    expect(ordinary).toMatchObject({ key: "notes", format: "markdown", baseRevisionId: currentRevision });
    const governed = schema.parse({ taskId, key: "bostan-verification", title: "Independent review",
      body: JSON.stringify({ schema: "bostan.verification.report.v1", verdict: "pass" }),
      baseRevisionId: currentRevision, format: "json" });
    expect(governed).toMatchObject({ format: "json", key: "bostan-verification" });
    expect(schema.safeParse({ ...ordinary, format: "yaml" }).success).toBe(false);
    expect(schema.safeParse({ ...ordinary, body: "x".repeat(20001) }).success).toBe(false);
    expect(schema.safeParse({ ...ordinary, title: "x".repeat(201) }).success).toBe(false);
    expect(runnerTaskDocumentFormatAllowed(ordinary)).toBe(true);
    expect(runnerTaskDocumentFormatAllowed(governed)).toBe(true);
    expect(runnerTaskDocumentFormatAllowed({ key: "notes", format: "json" })).toBe(false);
    expect(runnerTaskDocumentFormatAllowed({ key: "bostan-verification", format: "markdown" })).toBe(true);
  });
  it("publishes the corrected JSON capability only to authorized standard agent API tools", () => {
    const available = runnerBridgeDefinitions({ workspace: false, skills: false, api: true, mode: "standard" });
    const write = available.find(item => item.name === "write_task_document");
    expect(write).toBeTruthy();
    expect(write!.description).toContain("ONLY with key=bostan-verification");
    expect(JSON.stringify(write!.inputSchema)).toContain("json");
    expect(runnerBridgeDefinitions({ workspace: false, skills: false, api: false, mode: "standard" })
      .some(item => item.name === "write_task_document")).toBe(false);
    expect(runnerBridgeDefinitions({ workspace: false, skills: false, api: true, mode: "planning" })
      .some(item => item.name === "write_task_document")).toBe(false);
  });
});

describe("Bostan B5-13 native runner REST catalog", () => {
  it("advertises the narrow JSON report exception in real OpenAPI REST operation", async () => {
    const { runnerApiOperation } = await import("../services/native-runtime/runner-api-catalog.js");
    const operation = runnerApiOperation("PUT /api/issues/{id}/documents/{key}");
    expect(operation.description).toContain("key=bostan-verification");
    expect(JSON.stringify(operation.requestBody)).toContain("json");
    expect(JSON.stringify(operation.requestBody)).toContain("markdown");
    const source = runnerApiOperation("GET /api/companies/{companyId}/issues/{issueId}/bostan-verification/sources/{documentId}/snapshot");
    expect(source.transport).toBe("rest");
    expect(source.allowedModes).toContain("standard");
    expect(source.description).toContain("delivered distinct-agent handoff");
  });
});
