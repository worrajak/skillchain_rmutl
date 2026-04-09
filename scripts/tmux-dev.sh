#!/bin/bash
# SkillChain Multi-Agent Development — tmux Session
# Usage: bash scripts/tmux-dev.sh [--no-auto]
#
# สร้าง tmux session ชื่อ "skillchain" พร้อม 5 panes:
#   Lead | Backend | Frontend | QA | Smart Contract
#
# Claude จะ auto-launch ในทุก pane (ใช้ --no-auto เพื่อปิด)

SESSION="skillchain"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AUTO=true
[[ "$1" == "--no-auto" ]] && AUTO=false

# ถ้า session มีอยู่แล้ว ให้ attach เลย
tmux has-session -t $SESSION 2>/dev/null
if [ $? -eq 0 ]; then
  echo "Session '$SESSION' already exists. Attaching..."
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

# สร้าง session ใหม่ — pane แรกคือ Lead
tmux new-session -d -s $SESSION -n "dev" -c "$PROJECT_DIR"

# Split สำหรับ Backend (ด้านขวา)
tmux split-window -h -t $SESSION:dev -c "$PROJECT_DIR"

# Split สำหรับ Frontend (ด้านล่างซ้าย)
tmux select-pane -t $SESSION:dev.0
tmux split-window -v -t $SESSION:dev -c "$PROJECT_DIR"

# Split สำหรับ QA (ด้านล่างขวา)
tmux select-pane -t $SESSION:dev.1
tmux split-window -v -t $SESSION:dev -c "$PROJECT_DIR"

# สร้าง window ใหม่สำหรับ Smart Contract
tmux new-window -t $SESSION -n "contract" -c "$PROJECT_DIR"

# Launch agents ในแต่ละ pane
launch "$SESSION:dev.0"      "agents/dev/lead.md"           "LEAD"
launch "$SESSION:dev.1"      "agents/dev/backend.md"        "BACKEND"
launch "$SESSION:dev.2"      "agents/dev/frontend.md"       "FRONTEND"
launch "$SESSION:dev.3"      "agents/dev/qa.md"             "QA"
launch "$SESSION:contract.0" "agents/dev/smart-contract.md" "SMART CONTRACT"

# กลับไปที่ window แรก, pane แรก (Lead)
tmux select-window -t $SESSION:dev
tmux select-pane -t 0

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  SkillChain Dev Session Ready!                   ║"
echo "║                                                  ║"
echo "║  Window 1 (dev):      Lead | Backend             ║"
echo "║                       Frontend | QA              ║"
echo "║  Window 2 (contract): Smart Contract             ║"
echo "║                                                  ║"
if $AUTO; then
echo "║  Claude auto-launched in all panes               ║"
else
echo "║  --no-auto: type the claude command in each pane ║"
fi
echo "║                                                  ║"
echo "║  Ctrl+b arrow = switch pane                      ║"
echo "║  Ctrl+b n     = next window                      ║"
echo "║  Ctrl+b d     = detach                           ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

tmux attach -t $SESSION
