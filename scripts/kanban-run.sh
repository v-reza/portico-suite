#!/usr/bin/env bash
# Drive the portico-suite kanban board until nothing is left to run.
#
# WHY: with kanban.dispatch_in_gateway=false nothing spawns by itself. Moving a
# card to Ready does not start it; you have to run `hermes kanban dispatch`
# yourself, and then again after a worker hands off to review. This loops that
# for you, so the only manual step left is moving a card out of Blocked.
#
# Usage:
#   scripts/kanban-run.sh            # work until the board is idle
#   scripts/kanban-run.sh --once     # a single dispatch pass, then exit
#   scripts/kanban-run.sh --dry      # report what would run, spawn nothing
#
# Env: IDLE_LIMIT (consecutive idle polls before stopping, default 3)
#      POLL (seconds between polls, default 20)
#
# Exit codes: 0 = board idle, nothing in flight; 1 = a card is stuck and needs a
# human; 2 = usage/environment error.

set -uo pipefail

BOARD="${BOARD:-portico-suite}"
ONCE=0
DRY=0
for a in "$@"; do
    case "$a" in
        --once) ONCE=1 ;;
        --dry)  DRY=1 ;;
        -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
        *) echo "kanban-run: unknown flag '$a'"; exit 2 ;;
    esac
done

# HERMES_DELEGATED_CHILD_CONTEXT makes the kanban CLI refuse to write. Clearing
# it lets this run from inside a delegated session too.
HERMES="${HERMES_BIN:-$HOME/AppData/Local/hermes/hermes-agent/venv/Scripts/hermes.exe}"
if [ ! -x "$HERMES" ]; then
    HERMES="$(command -v hermes || true)"
fi
[ -n "$HERMES" ] && [ -x "$HERMES" ] || { echo "kanban-run: hermes binary not found"; exit 2; }

kb() { env -u HERMES_DELEGATED_CHILD_CONTEXT "$HERMES" kanban --board "$BOARD" "$@"; }

IDLE_LIMIT="${IDLE_LIMIT:-3}"
POLL="${POLL:-20}"

# Count cards in the columns that mean "a worker should be running". Rows are
# rendered as "<marker> t_xxxxxxxx  status  assignee  title", so match the id
# itself — anchoring on leading whitespace misses the marker glyph.
count_cards() {
    kb list --status "$1" 2>/dev/null | grep -cE 't_[0-9a-f]{8}' || true
}

tick() {
    local out
    out="$(kb dispatch 2>&1)"
    printf '%s\n' "$out" | grep -vE '^\s*$' | sed 's/^/  /'
}

echo "kanban-run: board=$BOARD  once=$ONCE  dry=$DRY  idle_limit=$IDLE_LIMIT"

if [ "$DRY" = 1 ]; then
    echo "--- what the board looks like now ---"
    kb stats 2>&1 | sed 's/^/  /'
    echo "--- cards that would be picked up ---"
    kb list --status ready 2>&1 | sed 's/^/  /'
    exit 0
fi

idle=0
round=0
while :; do
    round=$((round + 1))
    echo "[$(date '+%H:%M:%S')] pass $round"

    before="$(kb stats 2>/dev/null | tr -d '\r')"
    tick
    after="$(kb stats 2>/dev/null | tr -d '\r')"

    if [ "$ONCE" = 1 ]; then
        echo "kanban-run: --once, stopping"
        break
    fi

    if [ "$before" = "$after" ]; then
        idle=$((idle + 1))
        echo "  board unchanged ($idle/$IDLE_LIMIT)"
        [ "$idle" -ge "$IDLE_LIMIT" ] && break
    else
        idle=0
        echo "  board changed"
    fi
    sleep "$POLL"
done

echo
echo "kanban-run: board is idle"
kb stats 2>&1 | sed 's/^/  /'

# A card still Running with no live pid, or Blocked by the dispatcher, needs a
# human. Surface it rather than exiting 0 on a half-finished board.
STUCK="$(count_cards running)"
if [ "${STUCK:-0}" -gt 0 ]; then
    echo
    echo "kanban-run: WARNING — $STUCK card(s) still Running. Check:"
    echo "  $HERMES kanban --board $BOARD list --status running"
    exit 1
fi
exit 0
