#!/bin/bash
# SkillChain Documentation Session — 3 Doc Writers
# Usage: bash scripts/tmux-docs.sh [--no-auto]

SESSION="skillchain-docs"
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

# API Doc Writer
tmux new-session -d -s $SESSION -n "docs" -c "$PROJECT_DIR"

# Student Manual (ขวา)
tmux split-window -h -t $SESSION:docs -c "$PROJECT_DIR"

# Employer Manual (ล่างซ้าย)
tmux select-pane -t $SESSION:docs.0
tmux split-window -v -t $SESSION:docs -c "$PROJECT_DIR"

# Launch agents
launch "$SESSION:docs.0" "agents/docs/writer-api.md"      "API DOC"
launch "$SESSION:docs.1" "agents/docs/writer-student.md"   "STUDENT MANUAL"
launch "$SESSION:docs.2" "agents/docs/writer-employer.md"  "EMPLOYER MANUAL"

tmux select-pane -t 0

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  SkillChain Docs Session Ready!               ║"
echo "║  API Doc | Student Manual | Employer Manual   ║"
if $AUTO; then
echo "║  Claude auto-launched in all panes            ║"
fi
echo "╚══════════════════════════════════════════════╝"
echo ""

tmux attach -t $SESSION
