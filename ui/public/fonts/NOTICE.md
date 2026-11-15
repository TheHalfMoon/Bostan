# Bundled UI Fonts

Bostan bundles Inter for the board UI so screenshots and packaged installs use
the same sans-serif text stack without relying on host font packages.

## Inter

- Upstream project: https://github.com/rsms/inter
- Version: v4.1
- Source files:
  - https://raw.githubusercontent.com/rsms/inter/v4.1/docs/font-files/InterVariable.woff2
  - https://raw.githubusercontent.com/rsms/inter/v4.1/docs/font-files/InterVariable-Italic.woff2
- License: SIL Open Font License 1.1
- License text: bundled verbatim in `Inter-OFL.txt`, sourced from https://github.com/rsms/inter/blob/v4.1/LICENSE.txt

Redistribution note: Inter is redistributed under the SIL Open Font License 1.1.
The bundled WOFF2 files are included unmodified from the upstream v4.1 release.

## Paper Mono

- Upstream project: https://github.com/paper-design/paper-mono
- Version: v1.000
- Release archive: https://github.com/paper-design/paper-mono/releases/download/v1.000/paper-mono-v1.000.zip
- Archive SHA-256: `8642652985dc87bf4cfd07c89942899e611c3c774fc25284c0dd4fe86a993a13`
- Source file: `fonts/webfonts/PaperMono[wght].woff2`, bundled without modification as `PaperMono-Variable.woff2`
- License: SIL Open Font License 1.1; included in `PaperMono-OFL.txt`

The refreshed task-row specimen uses this variable webfont for task identifiers.
It supports upright weights 100–800. Existing uses of the system monospace stack
remain unchanged until their design is reviewed.

## Bostan brand faces (Inter Tight, JetBrains Mono, Newsreader)

Directory: `brand/`. Variable WOFF2 subsets from the Fontsource npm packages,
bundled without modification; `ui/src/brand-fonts.css` declares them with the
packages' own `unicode-range` values so browsers fetch only needed subsets.

| Family | Package | Version | Tarball SHA-256 | Files | License |
| --- | --- | --- | --- | --- | --- |
| Inter Tight | `@fontsource-variable/inter-tight` | 5.3.0 | `f41e72c42c25f57032c2a0e76c72659df67fe92f88d6850629c77bcd9e199124` | `inter-tight-*-wght-normal.woff2` (latin, latin-ext, cyrillic, cyrillic-ext, greek, greek-ext, vietnamese) | OFL 1.1, `brand/InterTight-OFL.txt` |
| JetBrains Mono | `@fontsource-variable/jetbrains-mono` | 5.3.0 | `996fe6368a480c9ce15d4de22a2682b7c40b403718fee2b15e7272f244fd993f` | `jetbrains-mono-*-wght-normal.woff2` (latin, latin-ext, cyrillic, cyrillic-ext, greek, vietnamese) | OFL 1.1, `brand/JetBrainsMono-OFL.txt` |
| Newsreader | `@fontsource-variable/newsreader` | 5.3.0 | `4b8cfba8f4e79abe7b221b761b751d76569fd2d2303a9cace2e90b862c56630d` | `newsreader-{latin,latin-ext,vietnamese}-standard-{normal,italic}.woff2` (wght + opsz axes) | OFL 1.1, `brand/Newsreader-OFL.txt` |

Upstream projects: https://github.com/rsms/inter-tight,
https://github.com/JetBrains/JetBrainsMono,
https://github.com/productiontype/Newsreader. The Newsreader wordmark outlines
in `ui/src/brand/paths.ts` and `ui/src/assets/brand/` are derived from this
font (SemiBold, opsz 72), which the OFL permits for logos.
