#!/bin/bash
# SkillChain Code Review Session — 3 Review Agents
# Usage: bash scripts/tmux-review.sh [--no-auto]

SESSION="skillchain-review"
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

# Security Reviewer
tmux new-session -d -s $SESSION -n "review" -c "$PROJECT_DIR"

# Performance Reviewer (ขวา)
tmux split-window -h -t $SESSION:review -c "$PROJECT_DIR"

# Test Coverage Reviewer (ล่างซ้าย)
tmux select-pane -t $SESSION:review.0
tmux split-window -v -t $SESSION:review -c "$PROJECT_DIR"

# Launch agents
launch "$SESSION:review.0" "agents/review/security.md"      "SECURITY"
launch "$SESSION:review.1" "agents/review/performance.md"    "PERFORMANCE"
launch "$SESSION:review.2" "agents/review/test-coverage.md"  "TEST COVERAGE"

tmux select-pane -t 0

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  SkillChain Review Session Ready!          ║"
echo "║  Security | Performance | Test Coverage    ║"
if $AUTO; then
echo "║  Claude auto-launched in all panes         ║"
fi
echo "╚═══════════════════════════════════════════╝"
echo ""

tmux attach -t $SESSION
