# Bundled UI Fonts

Bostan bundles its identity v3 type system so screenshots and packaged installs
render identically without relying on host font packages or a font CDN:
Outfit (display and headlines), Inter (interface) and JetBrains Mono (data).

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

## Outfit (brand display face)

- Upstream project: https://github.com/Outfitio/Outfit-Fonts
- Packaged source: `@fontsource-variable/outfit@5.3.0` (npm), files
  `outfit-latin-wght-normal.woff2` and `outfit-latin-ext-wght-normal.woff2`,
  bundled without modification under `brand/`
- SHA-256: latin `6c18d579fd87c3776be068b762cbc83fde3acb543d49eabd3ade842eb987e887`,
  latin-ext `0f53d1c03b3918d744a843b5039001ee31695ca1e255e3914188df81beb461e9`
- License: SIL Open Font License 1.1; included in `brand/Outfit-OFL.txt`

## JetBrains Mono (brand data face)

- Upstream project: https://github.com/JetBrains/JetBrainsMono
- Packaged source: `@fontsource-variable/jetbrains-mono@5.3.0` (npm), files
  `jetbrains-mono-latin-wght-normal.woff2` and
  `jetbrains-mono-latin-ext-wght-normal.woff2`, bundled without modification
  under `brand/`
- SHA-256: latin `18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e`,
  latin-ext `79bfdab9ba467e26eea4122e6f2567e188dd8a09a8c730d501fc487c4ab99c6e`
- License: SIL Open Font License 1.1; included in `brand/JetBrainsMono-OFL.txt`

JetBrains Mono is now the first family in `--font-mono`. Paper Mono stays
available through `--font-paper-mono` for the surfaces that opt into it.
