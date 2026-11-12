import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdapterExecutionTarget } from "@bostan/adapter-utils/execution-target";

const {
  ensureAdapterExecutionTargetDirectory,
  ensureAdapterExecutionTargetCommandResolvable,
  maybeRunSandboxInstallCommand,
  runAdapterExecutionTargetProcess,
  describeAdapterExecutionTarget,
  resolveAdapterExecutionTargetCwd,
  prepareAdapterExecutionTargetRuntime,
} = vi.hoisted(() => {
  const restoreWorkspace = vi.fn(async () => {});
  return {
    ensureAdapterExecutionTargetDirectory: vi.fn(async () => {}),
    ensureAdapterExecutionTargetCommandResolvable: vi.fn(async () => {}),
    maybeRunSandboxInstallCommand: vi.fn(async () => null),
    runAdapterExecutionTargetProcess: vi.fn(async () => ({
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: [
        JSON.stringify({ type: "step_start", sessionID: "session-1" }),
        JSON.stringify({ type: "text", sessionID: "session-1", part: { text: "hello" } }),
        JSON.stringify({
          type: "step_finish",
          sessionID: "session-1",
          part: { cost: 0.001, tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } } },
        }),
      ].join("\n"),
      stderr: "",
      pid: 123,
      startedAt: new Date().toISOString(),
    })),
    describeAdapterExecutionTarget: vi.fn(() => "QA Cloudflare"),
    resolveAdapterExecutionTargetCwd: vi.fn((target, configuredCwd, fallbackCwd) => {
      if (typeof configuredCwd === "string" && configuredCwd.trim().length > 0) return configuredCwd;
      if (target && typeof target === "object" && "remoteCwd" in target && typeof target.remoteCwd === "string") {
        return target.remoteCwd;
      }
      return fallbackCwd;
    }),
    prepareAdapterExecutionTargetRuntime: vi.fn(async () => ({
      target: null,
      workspaceRemoteDir: "/remote/workspace/.paperclip-runtime/runs/test/workspace",
      runtimeRootDir: "/remote/workspace/.paperclip-runtime/runs/test/workspace/.paperclip-runtime/opencode",
      assetDirs: {
        xdgConfig: "/remote/workspace/.paperclip-runtime/runs/test/workspace/.paperclip-runtime/opencode/xdgConfig",
      },
      restoreWorkspace,
    })),
  };
});

vi.mock("@bostan/adapter-utils/execution-target", async () => {
  const actual = await vi.importActual<typeof import("@bostan/adapter-utils/execution-target")>(
    "@bostan/adapter-utils/execution-target",
  );
  return {
    ...actual,
    ensureAdapterExecutionTargetDirectory,
    ensureAdapterExecutionTargetCommandResolvable,
    maybeRunSandboxInstallCommand,
    runAdapterExecutionTargetProcess,
    describeAdapterExecutionTarget,
    resolveAdapterExecutionTargetCwd,
    prepareAdapterExecutionTargetRuntime,
  };
});

import { testEnvironment } from "./test.js";
import { discoverOpenCodeModels, ensureOpenCodeModelConfiguredAndAvailable } from "./models.js";

vi.mock("./models.js", async () => ({
  ...await vi.importActual<typeof import("./models.js")>("./models.js"),
  discoverOpenCodeModels: vi.fn().mockRejectedValue(new Error("catalog should not be needed")),
  ensureOpenCodeModelConfiguredAndAvailable: vi.fn().mockRejectedValue(new Error("catalog should not be needed")),
}));

describe("opencode remote environment diagnostics", () => {
  const configHomes: string[] = [];
  let configHome: string;

  beforeEach(async () => {
    configHome = await mkdtemp(path.join(os.tmpdir(), "paperclip-opencode-test-config-"));
    vi.stubEnv("XDG_CONFIG_HOME", configHome);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    await rm(configHome, { recursive: true, force: true });
    await Promise.all(configHomes.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it.each(["passed", "auth_required", "timed_out", "unexpected_output"])(
    "retains catalog failure as a warning only after configured-model validation and a real hello (%s)", async outcome => {
      vi.mocked(ensureOpenCodeModelConfiguredAndAvailable).mockResolvedValueOnce([{ id: "local/fixture", label: "Fixture" }]);
      const successfulProbe = await runAdapterExecutionTargetProcess.getMockImplementation()!();
      runAdapterExecutionTargetProcess.mockResolvedValueOnce(outcome === "passed" ? successfulProbe : {
        ...successfulProbe, exitCode: outcome === "unexpected_output" ? 0 : 1,
        stdout: outcome === "unexpected_output" ? JSON.stringify({ type: "text", part: { text: "Something else" } }) : "",
        stderr: outcome === "auth_required" ? "invalid API key" : "",
        timedOut: outcome === "timed_out",
      });
      const result = await testEnvironment({ companyId: "synthetic", adapterType: "opencode_local",
        config: { cwd: configHome, model: "local/fixture", env: { XDG_CONFIG_HOME: configHome } } });
      expect(discoverOpenCodeModels).toHaveBeenCalledOnce();
      expect(ensureOpenCodeModelConfiguredAndAvailable).toHaveBeenCalledOnce();
      expect(runAdapterExecutionTargetProcess).toHaveBeenCalledOnce();
      expect(result.status).toBe(outcome === "passed" ? "warn" : "fail");
      expect(result.checks).toContainEqual(expect.objectContaining({ code: "opencode_models_discovery_failed",
        level: outcome === "passed" ? "warn" : "error", message: "catalog should not be needed" }));
      expect(result.checks).toContainEqual(expect.objectContaining({ code: `opencode_hello_probe_${outcome}` }));
    },
  );

  it("keeps catalog and configured-model rejection fatal without invoking the model", async () => {
    const result = await testEnvironment({ companyId: "synthetic", adapterType: "opencode_local",
      config: { cwd: configHome, model: "local/missing", env: { XDG_CONFIG_HOME: configHome } } });
    expect(result.status).toBe("fail");
    expect(result.checks).toContainEqual(expect.objectContaining({ code: "opencode_models_discovery_failed", level: "error" }));
    expect(result.checks).toContainEqual(expect.objectContaining({ code: "opencode_model_invalid", level: "error" }));
    expect(runAdapterExecutionTargetProcess).not.toHaveBeenCalled();
  });

  it.each(["passed", "auth_required", "model_unavailable", "timed_out"])(
    "validates a native model with the real probe path and no catalog scan (%s)", async outcome => {
      const successfulProbe = await runAdapterExecutionTargetProcess.getMockImplementation()!();
      runAdapterExecutionTargetProcess.mockResolvedValueOnce(outcome === "passed" ? successfulProbe : {
        ...successfulProbe, exitCode: 1, stdout: "", timedOut: outcome === "timed_out",
        stderr: outcome === "auth_required" ? "invalid API key" : "ProviderModelNotFoundError",
      });
      const result = await testEnvironment({ companyId: "company-1", adapterType: "paperclip_runner",
        config: { model: "openrouter/deepseek/deepseek-v4-flash-0731", env: { XDG_CONFIG_HOME: configHome } } });
      expect(discoverOpenCodeModels).not.toHaveBeenCalled();
      expect(ensureOpenCodeModelConfiguredAndAvailable).not.toHaveBeenCalled();
      expect(runAdapterExecutionTargetProcess).toHaveBeenCalledExactlyOnceWith(
        expect.any(String), null, "opencode", ["run", "--format", "json", "--model", "openrouter/deepseek/deepseek-v4-flash-0731"],
        expect.objectContaining({ stdin: "Respond with hello." }),
      );
      expect(result.status).toBe(outcome === "passed" ? "pass" : "warn");
      expect(result.checks).toContainEqual(expect.objectContaining({ code: `opencode_hello_probe_${outcome}` }));
      const call = runAdapterExecutionTargetProcess.mock.calls[0] as unknown as [unknown, unknown, unknown, unknown, { cwd: string }];
      expect(path.basename(call[4].cwd)).toMatch(/^paperclip-opencode-native-probe-/);
      await expect(stat(call[4].cwd)).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  it("fails closed with a public typed code when the free model limit is reached", async () => {
    runAdapterExecutionTargetProcess.mockResolvedValueOnce({
      exitCode: 1, signal: null, timedOut: false, stdout: "",
      stderr: "Free usage limit reached. Connect a provider or subscribe to OpenCode Go to keep going, or switch models.",
    } as Awaited<ReturnType<typeof runAdapterExecutionTargetProcess>>);
    const result = await testEnvironment({
      companyId: "synthetic", adapterType: "paperclip_runner",
      config: { model: "opencode/deepseek-v4.1-flash-free", env: { XDG_CONFIG_HOME: configHome } },
    });
    expect(result.status).toBe("fail");
    const quota = result.checks.find(check => check.code === "opencode_free_usage_limit_reached");
    expect(quota).toMatchObject({ level: "error" });
    expect(quota?.message).not.toContain("subscribe");
    expect(quota?.message).not.toContain("Connect a provider");
    expect(result.checks).not.toContainEqual(expect.objectContaining({ code: "opencode_hello_probe_failed" }));
  });

  it("distinguishes free provider usage exhaustion from missing authentication", async () => {
    vi.stubEnv("BOSTAN_OPENCODE_STANDALONE", "1");
    runAdapterExecutionTargetProcess.mockResolvedValueOnce({
      exitCode: 1, signal: null, timedOut: false, stdout: "",
      stderr: "Free tier quota exhausted.",
    } as Awaited<ReturnType<typeof runAdapterExecutionTargetProcess>>);
    const result = await testEnvironment({
      companyId: "synthetic", adapterType: "opencode_local",
      config: { model: "opencode/deepseek-v4.1-flash-free", env: { XDG_CONFIG_HOME: configHome } },
    });
    expect(result.status).toBe("fail");
    expect(result.checks.map(check => check.code)).toContain("opencode_free_usage_limit_reached");
    expect(discoverOpenCodeModels).not.toHaveBeenCalled();
  });

  it("rejects a malformed native model before starting the probe", async () => {
    const result = await testEnvironment({ companyId: "company-1", adapterType: "paperclip_runner",
      config: { model: "missing-provider", env: { XDG_CONFIG_HOME: configHome } } });
    expect(result.status).toBe("fail");
    expect(runAdapterExecutionTargetProcess).not.toHaveBeenCalled();
    expect(discoverOpenCodeModels).not.toHaveBeenCalled();
  });

  it("preserves an explicitly configured native probe directory", async () => {
    await testEnvironment({ companyId: "company-1", adapterType: "paperclip_runner",
      config: { model: "provider/model", cwd: configHome, env: { XDG_CONFIG_HOME: configHome } } });
    const call = runAdapterExecutionTargetProcess.mock.calls[0] as unknown as [unknown, unknown, unknown, unknown, { cwd: string }];
    expect(call[4].cwd).toBe(configHome);
    expect((await stat(configHome)).isDirectory()).toBe(true);
  });

  it("uses real hello validation for Bostan isolated allowlisted free QA", async () => {
    vi.stubEnv("BOSTAN_OPENCODE_STANDALONE", "1");
    const result = await testEnvironment({ companyId: "synthetic", adapterType: "opencode_local",
      config: { model: "opencode/deepseek-v4.1-flash-free", env: { XDG_CONFIG_HOME: configHome } } });
    expect(result.status).toBe("pass");
    expect(result.checks).toContainEqual(expect.objectContaining({
      code: "opencode_model_validation_via_probe", level: "info",
    }));
    expect(discoverOpenCodeModels).not.toHaveBeenCalled();
    expect(ensureOpenCodeModelConfiguredAndAvailable).not.toHaveBeenCalled();
    expect(runAdapterExecutionTargetProcess).toHaveBeenCalledOnce();
    const call = runAdapterExecutionTargetProcess.mock.calls[0] as unknown as [unknown, unknown, unknown, string[]];
    expect(call[3]).toContain("--standalone");
    const invocation = runAdapterExecutionTargetProcess.mock.calls[0] as unknown as [
      unknown, unknown, unknown, string[], { stdin: string }
    ];
    expect(invocation[4].stdin).toBe("Respond with hello.");
  });

  it("does not skip catalog validation for non-allowlisted models in source QA", async () => {
    vi.stubEnv("BOSTAN_OPENCODE_STANDALONE", "1");
    vi.mocked(discoverOpenCodeModels).mockResolvedValueOnce([{ id: "provider/paid", label: "paid" }]);
    vi.mocked(ensureOpenCodeModelConfiguredAndAvailable).mockResolvedValueOnce([
      { id: "provider/paid", label: "paid" },
    ]);
    await testEnvironment({ companyId: "synthetic", adapterType: "opencode_local",
      config: { model: "provider/paid", env: { XDG_CONFIG_HOME: configHome } } });
    expect(discoverOpenCodeModels).toHaveBeenCalledOnce();
    expect(ensureOpenCodeModelConfiguredAndAvailable).toHaveBeenCalledOnce();
  });

  it("keeps catalog validation for the legacy local adapter", async () => {
    vi.mocked(discoverOpenCodeModels).mockResolvedValueOnce([{ id: "provider/model", label: "Model" }]);
    vi.mocked(ensureOpenCodeModelConfiguredAndAvailable).mockResolvedValueOnce([{ id: "provider/model", label: "Model" }]);
    const result = await testEnvironment({ companyId: "company-1", adapterType: "opencode_local",
      config: { model: "provider/model", env: { XDG_CONFIG_HOME: configHome } } });
    expect(result.status).toBe("pass");
    expect(discoverOpenCodeModels).toHaveBeenCalledOnce();
    expect(ensureOpenCodeModelConfiguredAndAvailable).toHaveBeenCalledOnce();
    expect(runAdapterExecutionTargetProcess).toHaveBeenCalledOnce();
  });

  it.each([false, true])("stages remote runtime config assets for sandbox hello probes (managed=%s)", async (managed) => {
    const configHome = await mkdtemp(path.join(os.tmpdir(), "opencode-remote-test-config-"));
    configHomes.push(configHome);
    const remoteTarget: AdapterExecutionTarget = {
      kind: "remote",
      transport: "sandbox",
      providerKey: "cloudflare",
      remoteCwd: "/remote/workspace",
      runner: {
        execute: async () => ({
          exitCode: 0,
          signal: null,
          timedOut: false,
          stdout: "",
          stderr: "",
          pid: null,
          startedAt: new Date().toISOString(),
        }),
      },
    };

    const result = await testEnvironment({
      companyId: "company-1",
      adapterType: "opencode_local",
      config: {
        command: "opencode",
        model: "anthropic/claude-sonnet-4-5",
        ...(managed ? {
          managedAiConnection: { provider: "openrouter", method: "api_key" },
        } : {}),
        env: {
          XDG_CONFIG_HOME: configHome,
          ...(managed ? { OPENAI_API_KEY: "", OPENROUTER_API_KEY: "fixture", HOME: "/var/folders/qa-managed", XDG_DATA_HOME: "/var/folders/qa-managed/data" } : {}),
        },
      },
      executionTarget: remoteTarget,
      environmentName: "QA Cloudflare",
    });

    expect(result.status).toBe("pass");
    expect(prepareAdapterExecutionTargetRuntime).toHaveBeenCalledTimes(1);
    const runtimeCalls = prepareAdapterExecutionTargetRuntime.mock.calls as unknown as Array<
      [{ adapterKey: string; assets?: Array<{ key: string; localDir: string }> }]
    >;
    const runtimeInput = runtimeCalls[0]?.[0];
    expect(runtimeInput?.adapterKey).toBe("opencode");
    expect(runtimeInput?.assets).toEqual([
      expect.objectContaining({
        key: "xdgConfig",
      }),
    ]);

    const probeCall = runAdapterExecutionTargetProcess.mock.calls[0] as unknown as
      | [string, AdapterExecutionTarget, string, string[], { cwd: string; env: Record<string, string> }]
      | undefined;
    expect(probeCall?.[4].cwd).toBe("/remote/workspace/.paperclip-runtime/runs/test/workspace");
    if (managed) {
      expect(probeCall?.[4].env.HOME).toContain("/remote/workspace/.paperclip-runtime/runs/test/workspace/.paperclip-runtime/opencode/managed-auth/");
      expect(probeCall?.[4].env.XDG_DATA_HOME).toBe(`${probeCall?.[4].env.HOME}/data`);
      expect(probeCall?.[4].env.XDG_CACHE_HOME).toBe(`${probeCall?.[4].env.HOME}/cache`);
    }
    expect(probeCall?.[4].env.XDG_CONFIG_HOME).toBe(
      "/remote/workspace/.paperclip-runtime/runs/test/workspace/.paperclip-runtime/opencode/xdgConfig",
    );
  });
});
