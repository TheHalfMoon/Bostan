#!/usr/bin/env node
// Private Bostan source must never rewrite its package metadata into a
// publishable artifact. Use a separately reviewed Bostan release tool if
// package ownership and release qualification are approved in the future.
await import("./bostan-release-disabled.mjs");
