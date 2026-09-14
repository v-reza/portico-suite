#!/usr/bin/env bash
# Start the Hub dev server with the monorepo .env loaded.
# Next reads .env from its own directory; the suite keeps one .env at the root,
# so we export it here instead of duplicating secrets into apps/hub/.env.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
. ../../.env
set +a
exec npx next dev -p "${PORT:-3100}"
