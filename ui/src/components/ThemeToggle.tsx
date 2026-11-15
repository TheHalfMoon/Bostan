import { useId, useRef, type KeyboardEvent } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme, type ThemePreference } from "../context/ThemeContext";

type ThemeToggleVariant = "icon" | "menu-action" | "compact-menu-action";

interface ThemeToggleProps {
  className?: string;
  /**
   * `icon` (default): compact icon button — suitable for headers,
   * floating chrome (e.g. the unauthenticated `/auth` page), and any
   * other surface that just wants a toggle affordance.
   *
   * `menu-action`: full-width row with label + description + icon —
   * suitable for explanatory menus.
   *
   * `compact-menu-action`: compact label + icon row — matches the
   * surrounding actions in `SidebarAccountMenu`.
   */
  variant?: ThemeToggleVariant;
  /**
   * Called after `toggleTheme` runs. Surfaces like a popover menu use
   * this to dismiss the menu once the user has acted.
   */
  onAfterToggle?: () => void;
}

const MENU_ACTION_DESCRIPTION = "Toggle the app appearance.";

/**
 * Canonical theme-toggle widget. Both the signed-out `/auth` chrome and
 * the in-app account menu render through this component so the label,
 * icon, and toggle behaviour stay in sync as the theme model evolves.
 */
export function ThemeToggle({ className, variant = "icon", onAfterToggle }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const Icon = isDark ? Sun : Moon;

  function handleClick() {
    toggleTheme();
    onAfterToggle?.();
  }

  if (variant === "compact-menu-action") {
    return (
      <button
        type="button"
        className={cn(
          "flex h-(--profile-popover-row-height) w-full items-center gap-(--profile-popover-row-gap) rounded-lg px-2.5 text-left text-(length:--text-compact) font-medium leading-(--profile-popover-label-line-height) text-foreground transition-colors hover:bg-accent",
          className,
        )}
        onClick={handleClick}
        aria-label={label}
      >
        <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
    );
  }

  if (variant === "menu-action") {
    return (
      <button
        type="button"
        className={cn(
          "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/60",
          className,
        )}
        onClick={handleClick}
        aria-label={label}
      >
        <span className="mt-0.5 rounded-lg border border-border bg-background/70 p-2 text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{label}</span>
          <span className="block text-xs text-muted-foreground">{MENU_ACTION_DESCRIPTION}</span>
        </span>
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={cn("text-muted-foreground", className)}
    >
      <Icon />
    </Button>
  );
}

const PREFERENCE_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/**
 * Light / Dark / System appearance selector. The choice is persisted; System
 * follows the OS `prefers-color-scheme` setting live.
 */
export function ThemePreferenceControl({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const labelId = useId();
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const checkedIndex = Math.max(0, PREFERENCE_OPTIONS.findIndex((option) => option.value === preference));

  // WAI-ARIA radio group: one tab stop (the checked radio); arrows move and select.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = PREFERENCE_OPTIONS.length - 1;
    const focused = optionRefs.current.findIndex((node) => node === document.activeElement);
    const from = focused === -1 ? checkedIndex : focused;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = from === last ? 0 : from + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = from === 0 ? last : from - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    setPreference(PREFERENCE_OPTIONS[next]!.value);
    optionRefs.current[next]?.focus();
  }

  return (
    <div className={cn("flex items-center gap-(--profile-popover-row-gap) px-2.5 py-1", className)}>
      <span id={labelId} className="min-w-0 flex-1 truncate text-(length:--text-compact) font-medium text-foreground">
        Appearance
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={handleKeyDown}
        className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5"
      >
        {PREFERENCE_OPTIONS.map(({ value, label, Icon }, index) => {
          const checked = index === checkedIndex;
          return (
            <button
              key={value}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={label}
              title={label}
              tabIndex={checked ? 0 : -1}
              onClick={() => setPreference(value)}
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                checked && "bg-card text-foreground shadow-xs",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
