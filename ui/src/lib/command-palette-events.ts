/** Window event the command palette listens for, so pointer controls can open it. */
export const OPEN_COMMAND_PALETTE_EVENT = "bostan:open-command-palette";

/** Opens the command palette from a pointer control (e.g. the title-bar search field). */
export function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
}
