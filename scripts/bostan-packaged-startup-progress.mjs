export function classifyPackagedStartupProgress(evidence, now = Date.now()) {
  if (now - evidence.lastPhaseAt <= 30_000) return "phase_progress_within_30s";
  if (now - evidence.lastProcessActivityAt > 30_000) {
    return "no_observed_phase_or_process_progress_for_30s";
  }
  const activity = [
    ["cpu", evidence.lastCpuActivityAt],
    ["memory", evidence.lastMemoryChangeAt],
    ["process", evidence.lastProcessCountChangeAt],
  ].sort((left, right) => right[1] - left[1])[0]?.[0];
  return activity === "cpu"
    ? "cpu_progress_without_phase_progress"
    : activity === "process"
      ? "process_tree_change_without_phase_progress"
      : "memory_progress_without_phase_progress";
}
