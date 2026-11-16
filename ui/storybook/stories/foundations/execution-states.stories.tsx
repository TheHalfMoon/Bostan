import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExecutionStateBadge } from "@/components/ExecutionStateBadge";
import { EXECUTION_STATES } from "@/lib/execution-state";

function ExecutionStates() {
  return (
    <div className="paperclip-story">
      <main className="paperclip-story__inner space-y-6">
        <section className="paperclip-story__frame overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="paperclip-story__label">Identity v3</div>
            <h2 className="mt-1 text-xl font-semibold">Nine states, never blurred together</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Each state has its own shape, label and tone, so nothing depends on colour alone. Completed means the work
              finished; Verified means a check or a person confirmed the outcome. Outcome unknown means the runner
              stopped without a definitive result.
            </p>
          </div>
          <div className="grid gap-2.5 p-5 sm:grid-cols-3">
            {EXECUTION_STATES.map((state) => (
              <ExecutionStateBadge key={state} state={state} variant="card" />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border p-5">
            {EXECUTION_STATES.map((state) => (
              <ExecutionStateBadge key={state} state={state} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

const meta = {
  id: "foundations-execution-states",
  title: "Foundations/Execution States",
  component: ExecutionStates,
  parameters: {
    docs: {
      description: {
        component:
          "The nine execution states of the v3 desktop shell (Requested, Approved, Queued, Running, Completed, Verified, Failed, Blocked, Outcome unknown) as cards and pills. Mapping from run, task, approval and agent statuses lives in src/lib/execution-state.ts.",
      },
    },
    paperclip: {
      "capabilities": [
        "developer-labs/design"
      ],
      "implementation": "production",
      "boundary": "static",
      "notes": "Renders the shipped ExecutionStateBadge for every state; no product data.",
      "home": "foundations",
      "exception": "Shared foundations or contributor guide; no single business capability owns this suite."
    },
  },
} satisfies Meta<typeof ExecutionStates>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Light: Story = { globals: { theme: "light" } };
export const Dark: Story = { globals: { theme: "dark" } };
