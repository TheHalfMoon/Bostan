import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type CeoInspectorTab = "approvals" | "team";

const TABS: readonly CeoInspectorTab[] = ["approvals", "team"];

export function CeoInspectorTabs({
  activeTab,
  onTabChange,
  pendingApprovals,
  teamSize,
}: {
  activeTab: CeoInspectorTab;
  onTabChange: (tab: CeoInspectorTab) => void;
  pendingApprovals: number;
  teamSize: number;
}) {
  const tabRefs = useRef<Record<CeoInspectorTab, HTMLButtonElement | null>>({ approvals: null, team: null });

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, tab: CeoInspectorTab) {
    const index = TABS.indexOf(tab);
    const rtl = window.getComputedStyle(event.currentTarget).direction === "rtl";
    let nextIndex: number | null = null;
    if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = TABS.length - 1;
    else if (event.key === "ArrowRight") nextIndex = (index + (rtl ? -1 : 1) + TABS.length) % TABS.length;
    else if (event.key === "ArrowLeft") nextIndex = (index + (rtl ? 1 : -1) + TABS.length) % TABS.length;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = TABS[nextIndex]!;
    onTabChange(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  return (
    <div role="tablist" aria-label="Inspector" aria-orientation="horizontal" className="flex gap-1 border-b border-border px-3 py-2.5">
      {TABS.map((tab) => {
        const label = tab === "approvals"
          ? `Approvals${pendingApprovals ? ` · ${pendingApprovals}` : ""}`
          : `Team · ${teamSize}`;
        return (
          <button
            key={tab}
            ref={(element) => { tabRefs.current[tab] = element; }}
            type="button"
            role="tab"
            id={`ceo-tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`ceo-panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => onTabChange(tab)}
            onKeyDown={(event) => handleKeyDown(event, tab)}
            className={cn(
              "h-7 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activeTab === tab ? "nav-active" : "text-foreground hover:bg-accent",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
