import type { Meta, StoryObj } from "@storybook/react-vite";
import { BostanLockup } from "@/components/BostanLockup";
import { BostanMark, BostanWordmark } from "@/components/brand/BostanMark";
import { ThemePreferenceControl, ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { BOSTAN_BRAND, BOSTAN_THEMES, contrastRatio, type BostanThemeTokens } from "@/brand/tokens";

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="paperclip-story__frame overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="paperclip-story__label">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-semibold">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const THEME_TOKENS: Array<keyof BostanThemeTokens> = [
  "bg",
  "chrome",
  "surface",
  "card",
  "muted",
  "selected",
  "ink",
  "ink-2",
  "ink-3",
  "line",
  "line-strong",
  "primary",
  "primary-fill",
  "primary-text",
  "info-bg",
  "info-text",
  "warn-bg",
  "warn-text",
  "ok-bg",
  "ok-text",
  "bad-bg",
  "bad-text",
  "cobalt",
];

const STATUS_PAIRS: Array<{ label: string; bg: string; fg: string }> = [
  { label: "Info", bg: "bg-info-bg", fg: "text-info" },
  { label: "Warning", bg: "bg-warn-bg", fg: "text-warn" },
  { label: "OK", bg: "bg-ok-bg", fg: "text-ok" },
  { label: "Problem", bg: "bg-bad-bg", fg: "text-bad" },
];

function Swatch({ name }: { name: keyof BostanThemeTokens }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
      <span aria-hidden="true" className="size-8 shrink-0 rounded-md border border-border" style={{ background: `var(--bostan-${name})` }} />
      <div className="min-w-0">
        <div className="font-mono text-xs text-foreground">--bostan-{name}</div>
        <div className="font-mono text-xs text-muted-foreground">
          {BOSTAN_THEMES.light[name]} / {BOSTAN_THEMES.dark[name]}
        </div>
      </div>
    </div>
  );
}

function BrandIdentity() {
  return (
    <div className="paperclip-story">
      <main className="paperclip-story__inner space-y-6">
        <Section eyebrow="Identity v3" title="Logo family">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <figure className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card">
              <BostanMark size={72} title="Bostan mark" />
              <figcaption className="text-xs tracking-widest text-muted-foreground">MARK · THEMED</figcaption>
            </figure>
            <figure className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl bg-brand-red">
              <BostanMark size={72} tone="reversed" title="Bostan mark, reversed" />
              <figcaption className="text-xs tracking-widest text-white">REVERSED · RED</figcaption>
            </figure>
            <figure className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl bg-brand-navy">
              <BostanMark size={72} tone="on-navy" title="Bostan mark on navy" />
              <figcaption className="text-xs tracking-widest text-brand-sky">DARK · NAVY</figcaption>
            </figure>
            <figure className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card">
              <span className="flex size-20 items-center justify-center rounded-2xl bg-brand-red">
                <BostanMark size={56} tone="reversed" />
              </span>
              <figcaption className="text-xs tracking-widest text-muted-foreground">APP ICON</figcaption>
            </figure>
            <figure className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card">
              <div className="flex items-end gap-4">
                <BostanMark size={16} />
                <BostanMark size={24} />
                <BostanMark size={32} />
              </div>
              <figcaption className="text-xs tracking-widest text-muted-foreground">16 · 24 · 32 PX (SMALL DRAWING)</figcaption>
            </figure>
            <figure className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-4">
              <BostanWordmark height={32} />
              <figcaption className="text-xs tracking-widest text-muted-foreground">WORDMARK</figcaption>
            </figure>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-6 rounded-xl border border-border bg-chrome p-4">
            <BostanLockup size={32} />
            <BostanLockup size={24} />
          </div>
        </Section>

        <Section eyebrow="Identity v3" title="Brand colour">
          <div className="grid gap-3 sm:grid-cols-4">
            {(Object.entries(BOSTAN_BRAND) as Array<[string, string]>).map(([name, hex]) => (
              <div key={name} className="overflow-hidden rounded-lg border border-border">
                <div className="h-14" style={{ background: hex }} />
                <div className="bg-card p-2 text-xs">
                  <div className="font-medium capitalize">{name}</div>
                  <div className="font-mono text-muted-foreground">{hex}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Red carries the brand: the mark's nodes, primary actions, the supergraphic. Navy, cobalt and sky belong to
            illustration and data. No cream, no clay, no orange, no serif display.
          </p>
        </Section>

        <Section eyebrow="Identity v3" title="Theme tokens (light / dark)">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {THEME_TOKENS.map((name) => (
              <Swatch key={name} name={name} />
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {STATUS_PAIRS.map(({ label, bg, fg }) => (
              <div key={label} className={`rounded-lg px-3 py-2 text-sm font-semibold ${bg} ${fg}`}>
                {label}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            White on dark-theme accent #E5382F is {contrastRatio("#FFFFFF", BOSTAN_THEMES.dark.primary).toFixed(2)}:1, so
            filled buttons keep Bostan Red ({contrastRatio("#FFFFFF", BOSTAN_THEMES.dark["primary-fill"]).toFixed(2)}:1) in
            both themes.
          </p>
        </Section>

        <Section eyebrow="Identity v3" title="Type, actions and navigation">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="font-display text-5xl font-semibold tracking-tight">Aa Outfit</div>
              <div className="text-lg font-medium">Inter: interface and body copy</div>
              <div className="font-mono text-sm">JetBrains Mono · $1,204.50 · 00:14:32 · RUN-0142</div>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button>Ask the CEO</Button>
                <Button variant="outline">New objective</Button>
                <Button variant="destructive">Stop</Button>
                <Button variant="link">Open approvals</Button>
              </div>
              <nav aria-label="Navigation sample" className="w-56 space-y-0.5 rounded-xl border border-border bg-sidebar p-2 text-sm">
                <a href="#home" aria-current="page" className="nav-active flex rounded-md px-2.5 py-1.5 font-semibold">
                  Home
                </a>
                <a href="#inbox" className="flex rounded-md px-2.5 py-1.5 hover:bg-accent">
                  Inbox
                </a>
              </nav>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <ThemePreferenceControl className="w-72 rounded-lg border border-border bg-card" />
              </div>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}

const meta = {
  id: "foundations-brand-identity",
  title: "Foundations/Brand Identity",
  component: BrandIdentity,
  parameters: {
    docs: {
      description: {
        component:
          "Bostan identity v3: the custom tree mark and wordmark, brand colour, light/dark theme tokens, type system and theme controls. Switch the toolbar theme to compare light and dark.",
      },
    },
    paperclip: {
      "capabilities": [
        "developer-labs/design"
      ],
      "implementation": "production",
      "boundary": "static",
      "notes": "Renders the shipped brand components and token layer. Token values come from src/brand/tokens.ts, which brand-tokens.test.ts keeps in sync with index.css.",
      "home": "foundations",
      "exception": "Shared foundations or contributor guide; no single business capability owns this suite."
    },
  },
} satisfies Meta<typeof BrandIdentity>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Light: Story = { globals: { theme: "light" } };
export const Dark: Story = { globals: { theme: "dark" } };
