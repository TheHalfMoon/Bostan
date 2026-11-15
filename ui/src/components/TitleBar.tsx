import { Search } from "lucide-react";
import { BostanTree } from "./brand/BostanMark";
import { SidebarCompanyMenu } from "./SidebarCompanyMenu";
import { openCommandPalette } from "@/lib/command-palette-events";
import { ThemeToggle } from "./ThemeToggle";

function shortcutLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl K";
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘ K" : "Ctrl K";
}

/**
 * Desktop title bar (Desktop-Home artboard): Bostan mark, organization
 * switcher, the Ctrl/⌘ K search field that opens the command palette, and the
 * theme toggle. Desktop widths only; mobile keeps the drawer header.
 */
export function TitleBar() {
  const shortcut = shortcutLabel();
  return (
    <header
      data-testid="app-title-bar"
      className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-chrome px-4 text-foreground"
    >
      <span className="flex shrink-0 items-center gap-2 font-display text-sm font-semibold tracking-tight">
        <BostanTree title="" className="h-5 w-auto" />
        Bostan
      </span>
      <SidebarCompanyMenu placement="titlebar" />
      <div className="flex min-w-0 flex-1 justify-center">
        <button
          type="button"
          onClick={openCommandPalette}
          aria-keyshortcuts="Control+K Meta+K"
          className="flex h-7 w-full max-w-md items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-xs text-muted-foreground transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Search aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">Search or run a command</span>
          <kbd className="ml-auto rounded-sm border border-line-strong px-1.5 font-mono text-(length:--text-nano)">{shortcut}</kbd>
        </button>
      </div>
      <ThemeToggle />
    </header>
  );
}
