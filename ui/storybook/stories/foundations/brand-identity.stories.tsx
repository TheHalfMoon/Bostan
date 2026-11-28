import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { bostanBrand, bostanThemes, contrastRatio, THEMED_TOKEN_NAMES, type ThemeName } from "@/brand/tokens";
import { BostanAppIcon, BostanLockupGraphic, BostanMark, BostanTree } from "@/components/brand/BostanMark";
import { BostanLoading } from "@/components/BostanLoading";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Both themes render side by side. The --bostan-* variables are declared on
 * `.dark` itself, so a `.dark` subtree resolves them even when the document
 * is light; this story styles only with those variables.
 */
function ThemePanel({ theme, children }: { theme: ThemeName; children: ReactNode }) {
  return (
    <section
      className={theme === "dark" ? "dark" : undefined}
      style={{ background: "var(--bostan-bg)", color: "var(--bostan-ink)", padding: 24, borderRadius: 14, border: "1px solid var(--bostan-line)" }}
    >
      <p style={{ fontSize: 11, letterSpacing: "0.22em", fontWeight: 600, marginBottom: 16, color: "var(--bostan-ink-3)" }}>
        {theme === "dark" ? "DARK" : "LIGHT"}
      </p>
      {children}
    </section>
  );
}

function BothThemes({ children }: { children: (theme: ThemeName) => ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 16, padding: 16 }}>
      <ThemePanel theme="light">{children("light")}</ThemePanel>
      <ThemePanel theme="dark">{children("dark")}</ThemePanel>
    </div>
  );
}

function Palette() {
  return (
    <BothThemes>
      {(theme) => (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
          {THEMED_TOKEN_NAMES.map((name) => {
            const value = bostanThemes[theme][name];
            return (
              <div key={name} style={{ border: "1px solid var(--bostan-line)", borderRadius: 10, overflow: "hidden", background: "var(--bostan-card)" }}>
                <div style={{ height: 44, background: `var(--bostan-${name})` }} />
                <div style={{ padding: "6px 8px", fontSize: 11 }}>
                  <div style={{ fontWeight: 600 }}>{name}</div>
                  <div className="font-mono" style={{ color: "var(--bostan-ink-3)" }}>{value}</div>
                </div>
              </div>
            );
          })}
          {Object.entries(bostanBrand).map(([name, value]) => (
            <div key={name} style={{ border: "1px solid var(--bostan-line)", borderRadius: 10, overflow: "hidden", background: "var(--bostan-card)" }}>
              <div style={{ height: 44, background: `var(--bostan-${name})` }} />
              <div style={{ padding: "6px 8px", fontSize: 11 }}>
                <div style={{ fontWeight: 600 }}>{name} · brand</div>
                <div className="font-mono" style={{ color: "var(--bostan-ink-3)" }}>{value}</div>
              </div>
            </div>
          ))}
          <p style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--bostan-ink-2)" }}>
            Ink on bg {contrastRatio(bostanThemes[theme].ink, bostanThemes[theme].bg).toFixed(1)}:1 · ink-3 on card{" "}
            {contrastRatio(bostanThemes[theme]["ink-3"], bostanThemes[theme].card).toFixed(1)}:1 · accent text on bg{" "}
            {contrastRatio(bostanThemes[theme]["accent-text"], bostanThemes[theme].bg).toFixed(1)}:1
          </p>
        </div>
      )}
    </BothThemes>
  );
}

function Typography() {
  return (
    <BothThemes>
      {() => (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div className="font-serif" style={{ fontSize: 44, lineHeight: 1.05, fontWeight: 600, letterSpacing: "-0.035em" }}>Bostan</div>
            <div className="font-serif" style={{ fontSize: 22, fontStyle: "italic" }}>Coordinated AI agents for real outcomes.</div>
            <div style={{ fontSize: 11, color: "var(--bostan-ink-3)" }}>Newsreader · editorial and wordmark</div>
          </div>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 600 }}>Founder command center</h2>
            <div style={{ fontSize: 11, color: "var(--bostan-ink-3)" }}>Inter Tight · product headings (h1–h3)</div>
          </div>
          <div>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--bostan-ink-2)" }}>
              Approvals, budgets and outcomes stay visible. Every figure comes from the API; empty states replace missing data.
            </p>
            <div style={{ fontSize: 11, color: "var(--bostan-ink-3)" }}>Inter · interface text</div>
          </div>
          <div>
            <div className="font-mono" style={{ fontSize: 13 }}>
              $1,204.50 · $98.10 · 11:42:07 · 1,118 runs
            </div>
            <div style={{ fontSize: 11, color: "var(--bostan-ink-3)" }}>JetBrains Mono · data, with tabular figures</div>
          </div>
        </div>
      )}
    </BothThemes>
  );
}

function LogoSystem() {
  return (
    <BothThemes>
      {() => (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <BostanLockupGraphic style={{ height: 72, width: "auto" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
            <figure style={{ margin: 0, textAlign: "center" }}>
              <BostanTree style={{ height: 72, width: "auto" }} />
              <figcaption style={{ fontSize: 10, letterSpacing: "0.2em", marginTop: 6 }}>TREE</figcaption>
            </figure>
            <figure style={{ margin: 0, textAlign: "center" }}>
              <BostanTree tone="mono" style={{ height: 72, width: "auto" }} />
              <figcaption style={{ fontSize: 10, letterSpacing: "0.2em", marginTop: 6 }}>MONO</figcaption>
            </figure>
            <figure style={{ margin: 0, textAlign: "center" }}>
              <BostanMark style={{ height: 64, width: "auto" }} />
              <figcaption style={{ fontSize: 10, letterSpacing: "0.2em", marginTop: 6 }}>MARK</figcaption>
            </figure>
            <figure style={{ margin: 0, textAlign: "center" }}>
              <BostanAppIcon style={{ height: 72, width: 72 }} />
              <figcaption style={{ fontSize: 10, letterSpacing: "0.2em", marginTop: 6 }}>APP ICON</figcaption>
            </figure>
            <figure style={{ margin: 0, textAlign: "center" }}>
              <img src="/favicon.svg" alt="" width={16} height={16} />{" "}
              <img src="/favicon.svg" alt="" width={32} height={32} />
              <figcaption style={{ fontSize: 10, letterSpacing: "0.2em", marginTop: 6 }}>FAVICON 16 / 32</figcaption>
            </figure>
          </div>
        </div>
      )}
    </BothThemes>
  );
}

const meta = {
  id: "foundations-brand-identity",
  title: "Foundations/Brand identity",
  parameters: {
    layout: "fullscreen",
    paperclip: {
      capabilities: [],
      home: "foundations",
      exception: "Cross-product visual identity reference (tokens, type, logo system); not a feature journey.",
      status: "current",
      implementation: "production",
      boundary: "static",
      notes: "Renders the shipped token values, brand fonts and logo components in light and dark side by side.",
    },
  },
} satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;
export const ColourTokens: Story = { render: () => <Palette /> };
export const TypeSystem: Story = { render: () => <Typography /> };
export const Logos: Story = { render: () => <LogoSystem /> };
export const SplashLoading: Story = { render: () => <BostanLoading className="min-h-96" /> };
export const AppearanceControl: Story = {
  render: () => (
    <div style={{ maxWidth: 320, padding: 16 }}>
      <ThemeToggle variant="preference" />
      <div style={{ marginTop: 12 }}><ThemeToggle /></div>
    </div>
  ),
};
