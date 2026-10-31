# @bostan/ui

Private Bostan board UI source and assets.

**Bostan is not release-qualified.** This package is an internal, unpublished development preview, not an approved public npm distribution. The private source contains the React interface and its local storybook/test fixtures; installed Windows/macOS/Linux journeys, service-worker behavior, isolation and third-party provenance still require qualification.

## Development-only workflow

Any source-level UI development must occur in an owner-authorized disposable checkout after reviewing package scripts and provider/network effects. Do not publish the package, distribute artifacts, execute paid agents or attach real customer data. The repository's root release scripts are intentionally disabled.

## Branding compatibility

The active board-chat thinking indicator uses `/bostan-thinking.svg`. The old legacy asset URL is retained for compatibility but serves the same Bostan artwork, so stale cached clients cannot display a donor symbol.

See `docs/bostan/` for current private qualification evidence and release blockers.
