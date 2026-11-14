# Bostan logo assets

Traced from the approved identity board (design canvas `project/Main.dc.html`,
Nov 2026). Ink `#1F1F1C`, reversed ink `#ECE9DE`, slate `#7F9EB7`, cream
`#F6F4EB`. Inside the app, prefer the React components in
`src/components/brand/BostanMark.tsx`, which follow the theme.

| File | Use | Board source |
| --- | --- | --- |
| `bostan-lockup.svg` | Full horizontal lockup on light surfaces | Primary tree + Newsreader SemiBold wordmark (logo system) |
| `bostan-lockup-reversed.svg` | Lockup on dark surfaces | Same, light ink |
| `bostan-lockup-mono.svg` | Single-colour lockup (print, embossing) | Same, ink only |
| `bostan-tree.svg` / `-reversed` / `-mono` | Primary tree mark alone | Header hero tree, also the desktop title-bar mark |
| `bostan-mark.svg` / `-reversed` | Standalone mark for small and system UI | "MARK (STANDALONE) — SMALL / SYSTEM" |
| `bostan-mark-mono.svg` | Mono full-tree mark | Icon row, sage tile |
| `bostan-app-icon.svg` | Compact app icon: cream tree on slate rounded square | "COMPACT ICON (APP, FAVICON, UI)" |
| `bostan-favicon.svg` | 16 px favicon (also `public/favicon.svg`) | Pixel-grid simplification of the compact icon |
| `bostan-tray.svg` / `-reversed` | 16 px OS tray / menu-bar mark, no tile | Same simplification, monochrome |
| `bostan-wordmark.svg` | Type-only wordmark | "WORDMARK (TYPE-ONLY)" |
| `bostan-splash.svg` / `-dark` | Splash / loading screen | Tree above wordmark on chrome colour |

`bostan-favicon.svg` and the tray marks are the only drawings not traced
directly: the board has no 16 px version, and the traced icon blurs at that
size. They keep the compact icon's tile, trunk and five-node layout on a
16-unit grid. Use `bostan-app-icon.svg` at 32 px and above.

Raster icons in `ui/public/` (`favicon.ico`, `favicon-16x16.png`,
`favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-*.png`) are
rendered from these files. Electron icons (`desktop/app/bostan.*`) belong to
the open desktop-runtime PR and should be regenerated from
`bostan-app-icon.svg` there.
