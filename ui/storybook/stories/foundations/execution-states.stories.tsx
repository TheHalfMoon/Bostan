import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExecutionStateBadge } from "@/components/ExecutionStateBadge";
import { EXECUTION_STATES } from "@/lib/execution-state";

function StatePanel({ dark }: { dark: boolean }) {
  return (
    <section
      className={dark ? "dark" : undefined}
      style={{ background: "var(--bostan-bg)", color: "var(--bostan-ink)", padding: 24, borderRadius: 14, border: "1px solid var(--bostan-line)" }}
    >
      <p style={{ fontSize: 11, letterSpacing: "0.22em", fontWeight: 600, marginBottom: 12, color: "var(--bostan-ink-3)" }}>
        {dark ? "DARK" : "LIGHT"}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {EXECUTION_STATES.map((state) => (
          <ExecutionStateBadge key={state} state={state} variant="tile" />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        {EXECUTION_STATES.map((state) => (
          <ExecutionStateBadge key={state} state={state} />
        ))}
      </div>
    </section>
  );
}

const meta = {
  id: "foundations-execution-states",
  title: "Foundations/Execution states",
  parameters: {
    layout: "fullscreen",
    paperclip: {
      capabilities: [],
      home: "foundations",
      exception: "Shared status vocabulary used across runs, tasks, approvals and agents; not a single feature journey.",
      status: "current",
      implementation: "production",
      boundary: "static",
      notes: "The nine System-board states as tiles and chips, light and dark side by side. Each state has its own shape, so state never depends on colour alone.",
    },
  },
} satisfies Meta;
export default meta;

export const AllStates: StoryObj<typeof meta> = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 560px), 1fr))", gap: 16, padding: 16 }}>
      <StatePanel dark={false} />
      <StatePanel dark />
    </div>
  ),
};
