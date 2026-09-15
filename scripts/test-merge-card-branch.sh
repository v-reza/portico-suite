#!/usr/bin/env bash
# Exercise scripts/merge-card-branch.sh on throwaway repos.
# Asserts each guard fires; never touches the real portico-suite repo.
set -uo pipefail

SCRIPT_SRC="$1"
# Native Windows path: the git binary cannot chdir into MSYS /tmp/... forms.
ROOT="$(mktemp -d -p "$LOCALAPPDATA/Temp" mtest.XXXXXX)"
ROOT="$(cygpath -m "$ROOT" 2>/dev/null || echo "$ROOT")"
PASS=0; FAIL=0

ok()   { echo "  [PASS] $1"; PASS=$((PASS+1)); }
bad()  { echo "  [FAIL] $1"; echo "         $2"; FAIL=$((FAIL+1)); }

# assert <label> <expected-substring> <actual>
assert_has() {
  case "$3" in *"$2"*) ok "$1";; *) bad "$1" "wanted '$2' in: $3";; esac
}
assert_rc() { # label, expected_rc, actual_rc
  [ "$3" = "$2" ] && ok "$1" || bad "$1" "expected rc=$2 got rc=$3"
}

# --- build a repo that mimics the real layout -------------------------------
build() {
  local d="$ROOT/$1"
  mkdir -p "$d/scripts"
  cp "$SCRIPT_SRC" "$d/scripts/merge-card-branch.sh"
  git -C "$d" init -q -b master
  git -C "$d" config user.email t@t.t; git -C "$d" config user.name t
  echo base > "$d/README.md"
  git -C "$d" add -A; git -C "$d" commit -qm "base"
  echo "$d"
}

run() { # <repo> [args...]  -> sets OUT / RC
  local d="$1"; shift
  OUT="$(cd "$d" && bash scripts/merge-card-branch.sh "$@" 2>&1)"; RC=$?
}

echo "=== 1. clean fast-forward lands the work ==="
R="$(build ff)"
git -C "$R" worktree add -q "$ROOT/ff-wt" -b card/thing
echo deliverable > "$ROOT/ff-wt/report.md"
git -C "$ROOT/ff-wt" add -A; git -C "$ROOT/ff-wt" commit -qm "add report"
run "$ROOT/ff-wt"
assert_rc "exits 0" 0 "$RC"
assert_has "reports OK" "merge-card-branch: OK" "$OUT"
[ -f "$R/report.md" ] && ok "deliverable is on master" || bad "deliverable is on master" "report.md missing"
[ -z "$(git -C "$R" status --porcelain)" ] && ok "main repo still clean" || bad "main repo still clean" "$(git -C "$R" status --porcelain)"

echo "=== 2. idempotent: re-running is a no-op, not an error ==="
run "$ROOT/ff-wt"
assert_rc "exits 0" 0 "$RC"
assert_has "says up to date" "already up to date" "$OUT"

echo "=== 3. uncommitted work in the worktree is REFUSED ==="
R3="$(build dw-repo)"
git -C "$R3" worktree add -q "$ROOT/dirty-wt" -b card/dirty
echo partial > "$ROOT/dirty-wt/partial.md"
run "$ROOT/dirty-wt"
assert_rc "exits 1" 1 "$RC"
assert_has "names the cause" "uncommitted changes" "$OUT"
[ ! -f "$R3/partial.md" ] && ok "nothing landed" || bad "nothing landed" "partial.md appeared on master"

echo "=== 4. dirty MAIN repo is REFUSED ==="
R4="$(build dirty-main)"
git -C "$R4" worktree add -q "$ROOT/dirty-main-wt" -b card/ok
echo good > "$ROOT/dirty-main-wt/good.md"
git -C "$ROOT/dirty-main-wt" add -A; git -C "$ROOT/dirty-main-wt" commit -qm "add good"
echo scratch > "$R4/untracked.md"
run "$ROOT/dirty-main-wt"
assert_rc "exits 1" 1 "$RC"
assert_has "names the cause" "dirty" "$OUT"
[ ! -f "$R4/good.md" ] && ok "nothing landed" || bad "nothing landed" "good.md appeared on master"

echo "=== 5. diverged master is REFUSED, not force-merged ==="
R5="$(build diverge)"
git -C "$R5" worktree add -q "$ROOT/diverge-wt" -b card/div
echo theirs > "$ROOT/diverge-wt/theirs.md"
git -C "$ROOT/diverge-wt" add -A; git -C "$ROOT/diverge-wt" commit -qm "card work"
echo mine > "$R5/mine.md"
git -C "$R5" add -A; git -C "$R5" commit -qm "master moved on"
run "$ROOT/diverge-wt"
assert_rc "exits 1" 1 "$RC"
assert_has "explains divergence" "not fast-forwardable" "$OUT"
[ ! -f "$R5/theirs.md" ] && ok "master untouched" || bad "master untouched" "theirs.md landed"
[ -f "$R5/mine.md" ] && ok "master's own commit survives" || bad "master's own commit survives" "mine.md gone"

echo "=== 6. missing branch is reported, no crash ==="
R6="$(build nobranch)"
run "$R6" card/does-not-exist
assert_rc "exits 1" 1 "$RC"
assert_has "says not found" "not found" "$OUT"

echo "=== 7. merging the target into itself is refused ==="
R7="$(build self)"
run "$R7" master
assert_rc "exits 1" 1 "$RC"
assert_has "explains why" "already checked out" "$OUT"

echo "=== 8. works from a nested subdirectory of the worktree ==="
R8="$(build nested)"
git -C "$R8" worktree add -q "$ROOT/nested-wt" -b card/nested
mkdir -p "$ROOT/nested-wt/deep/inner"
echo deep > "$ROOT/nested-wt/deep/inner/x.md"
git -C "$ROOT/nested-wt" add -A; git -C "$ROOT/nested-wt" commit -qm "deep file"
OUT="$(cd "$ROOT/nested-wt/deep/inner" && bash "$ROOT/nested-wt/scripts/merge-card-branch.sh" 2>&1)"; RC=$?
assert_rc "exits 0" 0 "$RC"
[ -f "$R8/deep/inner/x.md" ] && ok "deep file landed on master" || bad "deep file landed on master" "missing"

build_remote() { # <name> -> repo path whose 'origin' is a bare repo beside it
  local d o
  o="$ROOT/$1-origin.git"
  git init -q --bare "$o"
  d="$(build "$1")"
  git -C "$d" remote add origin "$o"
  git -C "$d" push -q origin master 2>/dev/null
  echo "$d"
}

echo "=== 9. push: the merged commit reaches origin ==="
R9="$(build_remote push)"
git -C "$R9" worktree add -q "$ROOT/push-wt" -b card/push
echo shipped > "$ROOT/push-wt/ship.md"
git -C "$ROOT/push-wt" add -A; git -C "$ROOT/push-wt" commit -qm "ship it"
run "$ROOT/push-wt"
assert_rc "exits 0" 0 "$RC"
assert_has "says pushed" "pushed : origin/master" "$OUT"
[ "$(git -C "$ROOT/push-origin.git" rev-parse master)" = "$(git -C "$R9" rev-parse master)" ] \
  && ok "origin/master matches local master" || bad "origin/master matches local master" "SHAs differ"
git -C "$ROOT/push-origin.git" cat-file -e master:ship.md 2>/dev/null \
  && ok "file really exists in origin" || bad "file really exists in origin" "ship.md absent"

echo "=== 10. --no-push merges locally, leaves origin alone ==="
R10="$(build_remote nopush)"
git -C "$R10" worktree add -q "$ROOT/nopush-wt" -b card/np
echo local > "$ROOT/nopush-wt/local.md"
git -C "$ROOT/nopush-wt" add -A; git -C "$ROOT/nopush-wt" commit -qm "local only"
BEFORE_R="$(git -C "$ROOT/nopush-origin.git" rev-parse master)"
run "$ROOT/nopush-wt" --no-push
assert_rc "exits 0" 0 "$RC"
assert_has "says no-push" "pushed : (--no-push)" "$OUT"
[ -f "$R10/local.md" ] && ok "merged locally anyway" || bad "merged locally anyway" "missing"
[ "$BEFORE_R" = "$(git -C "$ROOT/nopush-origin.git" rev-parse master)" ] \
  && ok "origin untouched" || bad "origin untouched" "origin moved"

echo "=== 11. push failure -> rc=3, and the merge is KEPT ==="
R11="$(build pushfail)"
git -C "$R11" remote add origin "$ROOT/does-not-exist.git"
git -C "$R11" worktree add -q "$ROOT/pushfail-wt" -b card/pf
echo pf > "$ROOT/pushfail-wt/pf.md"
git -C "$ROOT/pushfail-wt" add -A; git -C "$ROOT/pushfail-wt" commit -qm "pf"
run "$ROOT/pushfail-wt"
assert_rc "exits 3, not 0" 3 "$RC"
assert_has "explains the push failed" "PUSH FAILED" "$OUT"
[ -f "$R11/pf.md" ] && ok "merge kept locally (no work lost)" || bad "merge kept locally (no work lost)" "merge rolled back"

echo "=== 12. no remote configured -> merges, warns, still exits 0 ==="
R12="$(build noremote)"
git -C "$R12" worktree add -q "$ROOT/noremote-wt" -b card/nr
echo nr > "$ROOT/noremote-wt/nr.md"
git -C "$ROOT/noremote-wt" add -A; git -C "$ROOT/noremote-wt" commit -qm "nr"
run "$ROOT/noremote-wt"
assert_rc "exits 0" 0 "$RC"
assert_has "warns about the missing remote" "no 'origin' remote" "$OUT"
[ -f "$R12/nr.md" ] && ok "still merged" || bad "still merged" "missing"

echo "=== 13. an unknown flag is rejected, not ignored ==="
run "$R12" --bogus
assert_rc "exits 1" 1 "$RC"
assert_has "names the flag" "unknown flag" "$OUT"

echo
echo "============================================================"
echo "$PASS passed, $FAIL failed"
rm -rf "$ROOT"
[ "$FAIL" = 0 ] || exit 1
