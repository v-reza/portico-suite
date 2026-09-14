#!/usr/bin/env bash
# Bootstrap a kanban worker worktree so the app can actually run there.
#
# Why this exists: the dispatcher materializes worktrees with a bare
# `git worktree add` — no install, no .env, no generated tokens. A worker that
# skips this step gets a repo where `npm run dev` cannot resolve `next`, the
# DB URL is empty, and `@portico/tokens/css` points at a file that does not
# exist. Run this once, from the worktree root, before any test command.
#
# ponytail: symlink node_modules instead of `npm install` (~40s and 400MB per
# worktree saved); the lockfile is identical across worktrees of one commit.
set -euo pipefail

WT="$(pwd)"
ROOT="$(git rev-parse --path-format=absolute --git-common-dir)/.."
ROOT="$(cd "$ROOT" && pwd)"

if [ ! -f "$WT/package.json" ]; then
  echo "bootstrap: not a portico-suite worktree (no package.json in $WT)" >&2
  exit 1
fi

# 1. node_modules — shared via symlink; hoisted deps + workspace links resolve
#    from any depth of the real path.
if [ ! -e "$WT/node_modules" ]; then
  if [ ! -d "$ROOT/node_modules" ]; then
    echo "bootstrap: $ROOT/node_modules missing — run 'npm install' in the main repo first" >&2
    exit 1
  fi
  ln -s "$ROOT/node_modules" "$WT/node_modules"
  echo "bootstrap: linked node_modules -> $ROOT/node_modules"
else
  echo "bootstrap: node_modules already present"
fi

# 2. .env — gitignored, so every worktree starts without it.
if [ ! -e "$WT/.env" ]; then
  if [ -f "$ROOT/.env" ]; then
    cp "$ROOT/.env" "$WT/.env"
    echo "bootstrap: copied .env from main repo"
  else
    echo "bootstrap: WARNING — no .env in $ROOT; DB-backed tests will fail" >&2
  fi
else
  echo "bootstrap: .env already present"
fi

# 3. generated token artifacts — dist/ is gitignored and nothing builds it on
#    checkout, so a fresh worktree has no tokens.css and the app cannot import
#    @portico/tokens/css.
if [ ! -f "$WT/packages/tokens/dist/tokens.css" ]; then
  node "$WT/packages/tokens/build.mjs" >/dev/null
  echo "bootstrap: built packages/tokens/dist"
else
  echo "bootstrap: tokens already built"
fi

echo "bootstrap: ready"
