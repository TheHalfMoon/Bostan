#!/usr/bin/env bash
set -euo pipefail

# Backup the configured Bostan database to the configured backup directory.
# The CLI resolves the Bostan instance-specific default backup directory.
#
# Usage:
#   ./scripts/backup-db.sh
#   pnpm db:backup
#
# The embedded PostgreSQL must be running (start with: pnpm dev).
# Run the repository-local TypeScript CLI directly; never resolve a package
# named paperclipai from npm or a globally installed executable.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"
exec pnpm --filter bostan exec tsx src/index.ts db:backup "$@"
