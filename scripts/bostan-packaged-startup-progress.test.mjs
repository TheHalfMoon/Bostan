import assert from "node:assert/strict";
import test from "node:test";
import { classifyPackagedStartupProgress } from "./bostan-packaged-startup-progress.mjs";

const now = 100_000;

test("reports recent phase advancement", () => {
  assert.equal(classifyPackagedStartupProgress({
    lastPhaseAt: now - 2_000, lastProcessActivityAt: 0,
    lastCpuActivityAt: 0, lastMemoryChangeAt: 0,
  }, now), "phase_progress_within_30s");
});

test("distinguishes sustained CPU progress from stalled phase advancement", () => {
  assert.equal(classifyPackagedStartupProgress({
    lastPhaseAt: now - 60_000, lastProcessActivityAt: now - 5_000,
    lastCpuActivityAt: now - 5_000, lastMemoryChangeAt: now - 40_000,
  }, now), "cpu_progress_without_phase_progress");
});

test("distinguishes memory change from CPU progress", () => {
  assert.equal(classifyPackagedStartupProgress({
    lastPhaseAt: now - 60_000, lastProcessActivityAt: now - 5_000,
    lastCpuActivityAt: now - 40_000, lastMemoryChangeAt: now - 5_000,
  }, now), "memory_progress_without_phase_progress");
});

test("reports process tree changes independently of CPU and memory", () => {
  assert.equal(classifyPackagedStartupProgress({
    lastPhaseAt: now - 60_000, lastProcessActivityAt: now - 5_000,
    lastCpuActivityAt: now - 40_000, lastMemoryChangeAt: now - 40_000,
    lastProcessCountChangeAt: now - 5_000,
  }, now), "process_tree_change_without_phase_progress");
});

test("reports no observed progress after the activity window", () => {
  assert.equal(classifyPackagedStartupProgress({
    lastPhaseAt: now - 60_000, lastProcessActivityAt: now - 31_000,
    lastCpuActivityAt: now - 31_000, lastMemoryChangeAt: now - 31_000,
  }, now), "no_observed_phase_or_process_progress_for_30s");
});
