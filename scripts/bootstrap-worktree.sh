#!/usr/bin/env bash
# Bootstrap a kanban worker worktree so the app can actually run there.
#
# Why this exists: the dispatcher materializes worktrees with a bare
# `git worktree add` — no install, no .env, no generated tokens. A worker that
# skips this step gets a repo where `npm run dev` cannot resolve `next`, the
# DB URL is empty, and `@portico/tokens/css` points at a file that does not
# exist. Run this once, from the worktree root, before any test command.
#
# ponytail: link each dependency instead of running `npm install` (~40s and
# 400MB per worktree saved; the lockfile is identical across worktrees of one
# commit). @portico/* is deliberately NOT linked — see step 1b.
set -uo pipefail

WT="$(pwd)"
# Native path for anything a Windows binary (node, npm) must open: MSYS would
# otherwise hand node "/c/Users/..." and it resolves to "C:\c\Users\...".
WT_WIN="$(pwd -W 2>/dev/null || pwd)"
ROOT="$(cd "$(git rev-parse --path-format=absolute --git-common-dir)/.." && pwd)"

if [ ! -f "$WT/package.json" ]; then
  echo "bootstrap: not a portico-suite worktree (no package.json in $WT)" >&2
  exit 1
fi
if [ ! -d "$ROOT/node_modules" ]; then
  echo "bootstrap: $ROOT/node_modules missing — run 'npm install' in the main repo first" >&2
  exit 1
fi

# 1. node_modules — one symlink per top-level entry.
if [ -e "$WT/node_modules" ]; then
  echo "bootstrap: node_modules already present"
else
  mkdir -p "$WT/node_modules"
  linked=0
  for entry in "$ROOT/node_modules"/* "$ROOT/node_modules"/.[!.]*; do
    [ -e "$entry" ] || continue
    name="$(basename "$entry")"
    case "$name" in
      # 1b. Workspace packages must resolve INSIDE the worktree, otherwise a
      #     worker editing packages/ui would still run the app against the main
      #     repo's copy of it. Leave @portico out; the next step wires it up.
      "@portico") continue ;;
    esac
    ln -sfn "$entry" "$WT/node_modules/$name"
    linked=$((linked + 1))
  done
  echo "bootstrap: linked $linked dependencies"
fi

# 1b. @portico/* -> this worktree's own packages/apps.
mkdir -p "$WT/node_modules/@portico"
for ws in packages/* apps/*; do
  [ -f "$ws/package.json" ] || continue
  name="$(node -p "require('$WT_WIN/$ws/package.json').name" 2>/dev/null)"
  case "$name" in @portico/*) ln -sfn "$WT/$ws" "$WT/node_modules/@portico/${name#@portico/}" ;; esac
done
echo "bootstrap: wired @portico/* -> worktree"

# 2. .env — gitignored, so every worktree starts without it.
if [ -e "$WT/.env" ]; then
  echo "bootstrap: .env already present"
elif [ -f "$ROOT/.env" ]; then
  cp "$ROOT/.env" "$WT/.env"
  echo "bootstrap: copied .env from main repo"
else
  echo "bootstrap: WARNING — no .env in $ROOT; DB-backed tests will fail" >&2
fi

# 3. generated token artifacts — dist/ is gitignored and nothing builds it on
#    checkout, so a fresh worktree has no tokens.css.
if [ -f "$WT/packages/tokens/dist/tokens.css" ]; then
  echo "bootstrap: tokens already built"
else
  node "$WT_WIN/packages/tokens/build.mjs" >/dev/null 2>&1
  if [ ! -f "$WT/packages/tokens/dist/tokens.css" ]; then
    echo "bootstrap: FAILED to build tokens — run 'node packages/tokens/build.mjs' to see why" >&2
    exit 1
  fi
  echo "bootstrap: built packages/tokens/dist"
fi

echo "bootstrap: ready"
