# Bostan identity v3 logo set

Generated from `ui/src/brand/geometry.json` by:

```sh
node ui/scripts/generate-brand-assets.mjs
```

Do not hand-edit these files; change the geometry or the generator and rerun.
`ui/src/brand/brand-assets.test.ts` fails if a file drifts from the geometry or
reintroduces a retired colour.

The mark and wordmark are custom-drawn and original. Abridge's geometric
wordmark was a style reference only; no third-party typeface is used.

| File | Use |
| --- | --- |
| `bostan-lockup.svg` | Mark + wordmark, ink strokes, red nodes. Light backgrounds. |
| `bostan-lockup-light.svg` | Same, white strokes. Dark UI backgrounds. |
| `bostan-lockup-reversed.svg` | All white on a Bostan Red field. |
| `bostan-lockup-dark.svg` | White strokes, #FF5A52 nodes on a navy field. |
| `bostan-mark*.svg` | The tree mark alone, same four treatments. |
| `bostan-mark-small.svg` | 16–32 px drawing: no ground line, heavier stroke, larger nodes. |
| `bostan-wordmark*.svg` | The BOSTAN wordmark alone; the T carries two red nodes. |
| `bostan-app-icon.svg` | White mark on a red rounded square. |
| `bostan-favicon.svg` | App icon using the small drawing (also `ui/public/favicon.svg`). |
| `bostan-tray-{16,32}[-light].svg` | Tray/menu-bar marks; `-light` for dark menu bars. |
| `png/bostan-app-icon-{16…1024}.png` | App icon rasters. |
| `png/bostan-tray-*.png` | Tray rasters, with `@2x` variants. |
| `bostan.ico` | Windows icon: 16, 24, 32, 48, 64, 256. |
| `bostan.icns` | macOS icon: 16–1024 including @2x slots. |

Desktop packaging (`desktop/`) is owned by the Electron runtime/installer
work and is not changed here; it can point its icon configuration at
`bostan.ico`, `bostan.icns` and the tray PNGs in this folder.

## Colours

- Bostan Red `#D91F26` (5.0:1 on white): mark nodes, primary actions, supergraphic.
- Ink `#111214`, Paper `#FFFFFF`, Mist `#F2F4F7`.
- Navy `#17245A`, Cobalt `#2F5BEA`, Sky `#C7D8F8`: illustration and data only.
- No cream, no clay, no orange, no serif display.
