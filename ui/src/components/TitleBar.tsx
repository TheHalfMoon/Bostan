import { Bell, Search } from "lucide-react";
import { Link } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { commandPaletteShortcutLabel, openCommandPalette } from "../lib/command-palette-events";
import { cn } from "../lib/utils";
import { BostanMark, BostanWordmark } from "./brand/BostanMark";
import { CompanySwitcher } from "./CompanySwitcher";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Desktop title bar (identity v3): brand, company switcher, Ctrl/⌘K search,
 * inbox and theme toggle. Window controls stay with the native frame; this
 * component does not change Electron window chrome or IPC.
 */
export function TitleBar({ className }: { className?: string }) {
  const { selectedCompanyId } = useCompany();
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const unread = inboxBadge.inbox;
  const shortcut = commandPaletteShortcutLabel();

  return (
    <header
      data-testid="app-title-bar"
      className={cn("flex h-11 shrink-0 items-center gap-3 border-b border-border bg-chrome pl-4 pr-3", className)}
    >
      <Link
        to="/command-center"
        aria-label="Bostan home"
        className="flex shrink-0 items-center gap-2 rounded-md text-foreground no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BostanMark size={20} />
        <BostanWordmark height={13} aria-hidden="true" role={undefined} aria-label={undefined} />
      </Link>

      <CompanySwitcher variant="titlebar" />

      <div className="flex min-w-0 flex-1 justify-center">
        <button
          type="button"
          onClick={openCommandPalette}
          aria-keyshortcuts="Control+K Meta+K"
          className="flex h-7 w-full max-w-md items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-xs text-muted-foreground transition-colors hover:border-line-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Search or run a command</span>
          <kbd className="ml-auto rounded-sm border border-border px-1.5 font-mono text-(length:--text-micro) text-muted-foreground">
            {shortcut}
          </kbd>
        </button>
      </div>

      <Link
        to="/inbox"
        aria-label={unread > 0 ? `Inbox, ${unread} unread` : "Inbox"}
        title="Inbox"
        className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground no-underline hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="size-4" aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute right-1.5 top-1.5 size-2 rounded-full",
              inboxBadge.failedRuns > 0 ? "bg-brand-accent" : "bg-brand-cobalt",
            )}
          />
        ) : null}
      </Link>
      <ThemeToggle className="border border-border bg-card" />
    </header>
  );
}
