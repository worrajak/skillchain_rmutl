#!/bin/bash
# SkillChain Ops Session — DevOps + Seed + Analytics
# Usage: bash scripts/tmux-ops.sh [--no-auto]

SESSION="skillchain-ops"
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

# DevOps
tmux new-session -d -s $SESSION -n "ops" -c "$PROJECT_DIR"

# Seed & Demo (ขวา)
tmux split-window -h -t $SESSION:ops -c "$PROJECT_DIR"

# Analytics (ล่างซ้าย)
tmux select-pane -t $SESSION:ops.0
tmux split-window -v -t $SESSION:ops -c "$PROJECT_DIR"

# Launch agents
launch "$SESSION:ops.0" "agents/ops/devops.md"    "DEVOPS"
launch "$SESSION:ops.1" "agents/ops/seed-demo.md"  "SEED & DEMO"
launch "$SESSION:ops.2" "agents/ops/analytics.md"  "ANALYTICS"

tmux select-pane -t 0

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  SkillChain Ops Session Ready!                ║"
echo "║  DevOps | Seed & Demo | Analytics             ║"
if $AUTO; then
echo "║  Claude auto-launched in all panes            ║"
fi
echo "╚══════════════════════════════════════════════╝"
echo ""

tmux attach -t $SESSION
