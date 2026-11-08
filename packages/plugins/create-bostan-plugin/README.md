# @bostan/create-bostan-plugin

Private scaffolding tool for creating new Bostan plugins.

```bash
pnpm --filter @bostan/create-bostan-plugin build
node packages/plugins/create-bostan-plugin/dist/bin.js my-plugin
```

Or with options:

```bash
node packages/plugins/create-bostan-plugin/dist/bin.js @acme/my-plugin \
  --template connector \
  --category connector \
  --display-name "Acme Connector" \
  --description "Syncs Acme data into Bostan" \
  --author "Acme Inc"
```

Supported templates: `default`, `connector`, `workspace`
Supported categories: `connector`, `workspace`, `automation`, `ui`

Generates:
- typed manifest + worker entrypoint
- example UI widget using the supported `@bostan/plugin-sdk/ui` hooks
- test file using `@bostan/plugin-sdk/testing`
- `esbuild` and `rollup` config files using SDK bundler presets
- dev server script for hot-reload (`bostan-plugin-dev-server`)

The scaffold starts with plain React elements so the generated plugin stays minimal. For Bostan-native controls, import shared host components such as `MarkdownEditor`, `FileTree`, `AssigneePicker`, and `ProjectPicker` from `@bostan/plugin-sdk/ui`.

Inside this repo, the generated package uses `@bostan/plugin-sdk` via `workspace:*`.

Outside this repo, the scaffold links directly to the private `@bostan/plugin-sdk` source in your local Bostan checkout. It never runs `pnpm pack`, creates release tarballs or downloads an unpublished SDK. Build the SDK in your local checkout first; pass `--sdk-path` to choose that checkout:

```bash
node packages/plugins/create-bostan-plugin/dist/bin.js @acme/my-plugin \
  --output /absolute/path/to/plugins \
  --sdk-path /absolute/path/to/Bostan/packages/plugins/sdk
```

The generated dependency uses a local `link:` path; the Bostan SDK is private and no npm package is published.

## Workflow after scaffolding

```bash
cd my-plugin
pnpm install
pnpm dev       # watch worker + manifest + ui bundles
pnpm dev:ui    # local UI preview server with hot-reload events
pnpm test
```
