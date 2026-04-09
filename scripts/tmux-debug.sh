#!/bin/bash
# SkillChain Bug Hunter Session — Hypothesis Challenge (3 Agents)
# Usage: bash scripts/tmux-debug.sh [--no-auto]

SESSION="skillchain-debug"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AUTO=true
[[ "$1" == "--no-auto" ]] && AUTO=false

tmux has-session -t $SESSION 2>/dev/null
if [ $? -eq 0 ]; then
  tmux attach -t $SESSION
  exit 0
fi

launch() {
  local pane_target="$1" agent_file="$2" label="$3"
  if $AUTO; then
    tmux send-keys -t "$pane_target" "claude --system-prompt $agent_file" Enter
  else
    tmux send-keys -t "$pane_target" "echo '$label — พิมพ์: claude --system-prompt $agent_file'" Enter
  fi
}

# Bug Hunter A: Frontend
tmux new-session -d -s $SESSION -n "debug" -c "$PROJECT_DIR"

# Bug Hunter B: Backend (ขวา)
tmux split-window -h -t $SESSION:debug -c "$PROJECT_DIR"

# Bug Hunter C: Blockchain (ล่างซ้าย)
tmux select-pane -t $SESSION:debug.0
tmux split-window -v -t $SESSION:debug -c "$PROJECT_DIR"

# Launch agents
launch "$SESSION:debug.0" "agents/debug/bug-hunter-frontend.md"   "BUG HUNTER Frontend"
launch "$SESSION:debug.1" "agents/debug/bug-hunter-backend.md"    "BUG HUNTER Backend"
launch "$SESSION:debug.2" "agents/debug/bug-hunter-blockchain.md" "BUG HUNTER Blockchain"

tmux select-pane -t 0

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  SkillChain Debug Session Ready!              ║"
echo "║  Frontend | Backend | Blockchain              ║"
if $AUTO; then
echo "║  Claude auto-launched in all panes            ║"
fi
echo "╚══════════════════════════════════════════════╝"
echo ""

tmux attach -t $SESSION
