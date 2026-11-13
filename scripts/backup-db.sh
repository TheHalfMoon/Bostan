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
# The paperclipai workspace command is a legacy internal pnpm alias; it invokes
# Bostan's db:backup handler and must not install or update an upstream package.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"
exec pnpm paperclipai db:backup "$@"
