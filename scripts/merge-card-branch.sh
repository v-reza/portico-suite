#!/usr/bin/env bash
# Merge a finished card's branch into the main repo's checked-out branch.
#
# WHY THIS EXISTS
# A card that reaches `done` leaves its work on its own branch. Nothing merges
# it: the dispatcher only spawns workers, and the worktree is torn down at
# completion. The deliverable then exists in the object database but is
# invisible in the main repo — the audit card's 322-line report was lost this
# way. This script is that missing step.
#
# Run it from inside your worktree, as the LAST action before kanban_complete.
#
# Usage:
#   bash scripts/merge-card-branch.sh [branch] [--no-push]
#
# `branch` defaults to the branch checked out in your worktree. The script
# always operates on the MAIN repo's working tree, even when invoked from a
# linked worktree, because a fast-forward merge has to happen where the target
# branch is checked out.
#
# The merge is pushed to `origin` by default, so the work is visible on GitHub
# without a second step. `--no-push` (or PUSH_REMOTE=somewhere) changes that.
#
# Exit codes: 0 = merged and pushed (or already up to date); 1 = refused, reason
# on stdout, nothing was changed; 3 = merged LOCALLY but the push failed.

set -uo pipefail

# Never let git block on a credential prompt. An unattended worker has no tty,
# so an unconfigured remote would hang the run until the dispatcher kills it —
# a silent stall, the worst possible failure. Fail fast and say so instead.
export GIT_TERMINAL_PROMPT=0
export GIT_ASKPASS=echo

die() { echo "merge-card-branch: REFUSED — $*"; exit 1; }

# --- resolve the main repo ---------------------------------------------------
# --git-common-dir points at the main .git even from a linked worktree. It may
# come back relative, so resolve it against the current directory.
# git and this shell disagree on path syntax on Windows: MSYS `pwd` yields
# /c/... which the native git binary cannot chdir into. Prefer the Windows form.
winpath() {
    if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1" 2>/dev/null && return; fi
    case "$1" in
        /[a-zA-Z]/*) printf '%s:/%s\n' "$(echo "${1#/}" | cut -c1)" "${1#/?/}" ;;
        *) printf '%s\n' "$1" ;;
    esac
}

COMMON="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"
if [ -z "$COMMON" ]; then
    COMMON="$(git rev-parse --git-common-dir 2>/dev/null)" || die "not inside a git repository"
    case "$COMMON" in
        /*|[A-Za-z]:*) : ;;                       # already absolute
        *) COMMON="$(pwd)/$COMMON" ;;             # relative to cwd
    esac
fi
[ -e "$COMMON" ] || die "cannot resolve the git common dir ($COMMON)"
# Do NOT `cd && pwd` here: MSYS pwd rewrites the drive into /c/... and every
# later `git -C "$MAIN"` then fails with "cannot change to".
MAIN="$(winpath "$(dirname "$COMMON")")"
[ -d "$MAIN/.git" ] || die "resolved main repo $MAIN has no .git directory"

# --- which branch are we landing? -------------------------------------------
BRANCH=""
PUSH=1
for arg in "$@"; do
    case "$arg" in
        --no-push) PUSH=0 ;;
        -*) die "unknown flag '$arg' (supported: --no-push)" ;;
        *) [ -z "$BRANCH" ] || die "more than one branch given"; BRANCH="$arg" ;;
    esac
done
REMOTE="${PUSH_REMOTE:-origin}"
if [ -z "$BRANCH" ]; then
    BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
fi
[ -n "$BRANCH" ] && [ "$BRANCH" != "HEAD" ] || die "no branch given and HEAD is detached"

TARGET="$(git -C "$MAIN" rev-parse --abbrev-ref HEAD 2>/dev/null)"
[ -n "$TARGET" ] || die "main repo has no checked-out branch"

if [ "$BRANCH" = "$TARGET" ]; then
    die "branch '$BRANCH' is already checked out in the main repo — nothing to land"
fi

# --- guard 1: your own worktree must be fully committed ---------------------
# A dirty worktree means work is about to be left behind. Committing is your
# job, not this script's: a merge that silently sweeps up stray files would
# hide the omission instead of surfacing it.
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    die "your worktree has uncommitted changes — commit them first:
$(git status --short | sed 's/^/    /')"
fi

# --- guard 2: the main repo must be clean -----------------------------------
DIRTY="$(git -C "$MAIN" status --porcelain 2>/dev/null)"
if [ -n "$DIRTY" ]; then
    die "main repo ($TARGET) is dirty — $(echo "$DIRTY" | wc -l | tr -d ' ') changed path(s):
$(echo "$DIRTY" | head -5 | sed 's/^/    /')"
fi

# --- guard 3: the branch must exist and be ahead of the target ---------------
git -C "$MAIN" rev-parse --verify --quiet "$BRANCH" >/dev/null \
    || die "branch '$BRANCH' not found in the main repo"

if ! git -C "$MAIN" merge-base --is-ancestor "$TARGET" "$BRANCH"; then
    die "$TARGET has commits '$BRANCH' does not have — not fast-forwardable.
    Resolve by hand (rebase '$BRANCH' onto '$TARGET', or merge and review the
    conflict). This script never creates a merge commit."
fi

PRE="$(git -C "$MAIN" rev-parse HEAD)"

if [ "$(git -C "$MAIN" rev-parse "$BRANCH")" = "$PRE" ]; then
    echo "merge-card-branch: already up to date — '$BRANCH' is at $TARGET ($(git -C "$MAIN" rev-parse --short HEAD))"
    POST="$PRE"
else
    # --- merge --------------------------------------------------------------
    OUT="$(git -C "$MAIN" merge --ff-only "$BRANCH" 2>&1)" || die "merge failed:
$(echo "$OUT" | sed 's/^/    /')"
    POST="$(git -C "$MAIN" rev-parse HEAD)"
fi

# --- push --------------------------------------------------------------------
# Pushed even on the up-to-date path: the target may already be ahead of origin
# from an earlier local-only merge, and leaving origin behind is the same
# invisible-work bug this script exists to kill.
if [ "$PUSH" = "1" ]; then
    if ! git -C "$MAIN" remote get-url "$REMOTE" >/dev/null 2>&1; then
        echo "merge-card-branch: NOTE — no '$REMOTE' remote configured, skipping push"
    else
        # A stalled network must not eat the rest of an unattended run's budget.
        if PUSH_OUT="$(timeout 120 git -C "$MAIN" push "$REMOTE" "$TARGET" 2>&1)"; then
            PUSHED=1
        else
            echo "merge-card-branch: MERGED LOCALLY, PUSH FAILED — '$REMOTE/$TARGET' is behind"
            echo "$PUSH_OUT" | sed 's/^/    /'
            echo "  local $TARGET is at $(git -C "$MAIN" rev-parse --short "$POST")"
            echo "  nothing is lost; finish it with:"
            echo "    git -C \"$MAIN\" push $REMOTE $TARGET"
            exit 3
        fi
    fi
fi

echo "merge-card-branch: OK"
echo "  branch : $BRANCH  ->  $TARGET"
echo "  before : $(git -C "$MAIN" rev-parse --short "$PRE")"
echo "  after  : $(git -C "$MAIN" rev-parse --short "$POST")"
if [ "${PUSHED:-}" = "1" ]; then
    echo "  pushed : $REMOTE/$TARGET"
elif [ "$PUSH" = "1" ]; then
    echo "  pushed : (no remote configured)"
else
    echo "  pushed : (--no-push)"
fi
echo "  files  :"
git -C "$MAIN" diff --stat "$PRE" "$POST" | sed 's/^/    /'
