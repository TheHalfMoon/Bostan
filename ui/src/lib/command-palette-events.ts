/** Window event that asks the mounted CommandPalette to open. */
export const OPEN_COMMAND_PALETTE_EVENT = "bostan:open-command-palette";

export function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
}

/** "⌘K" on Apple platforms, "Ctrl K" elsewhere. */
export function commandPaletteShortcutLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl K";
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad/i.test(platform) ? "⌘K" : "Ctrl K";
}
