#!/bin/bash
# SkillChain Agent Launcher — เลือก mode ได้จากคำสั่งเดียว
#
# Usage:
#   bash scripts/agents.sh              # interactive menu
#   bash scripts/agents.sh dev          # launch dev mode (auto-start Claude)
#   bash scripts/agents.sh review       # launch review mode
#   bash scripts/agents.sh debug        # launch debug mode
#   bash scripts/agents.sh docs         # launch docs mode
#   bash scripts/agents.sh migrate      # launch DB migration (single agent)
#   bash scripts/agents.sh ops          # launch ops mode (DevOps+Seed+Analytics)
#   bash scripts/agents.sh extract      # launch extract + migrator
#   bash scripts/agents.sh i18n         # launch i18n agent (single)
#   bash scripts/agents.sh audit        # launch contract auditor (single)
#   bash scripts/agents.sh single <agent-file>  # launch any single agent
#   bash scripts/agents.sh list         # list all agents
#   bash scripts/agents.sh kill         # kill all skillchain sessions
#
# เพิ่ม --no-auto ท้ายคำสั่งเพื่อไม่ให้ auto-launch Claude
#   bash scripts/agents.sh dev --no-auto

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# สีสำหรับ output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

show_menu() {
  echo ""
  echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}   SkillChain Multi-Agent Launcher              ${CYAN}║${NC}"
  echo -e "${CYAN}╠═══════════════════════════════════════════════╣${NC}"
  echo -e "${CYAN}║${NC}                                               ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   ${GREEN}1)${NC} dev      — Lead+Backend+Frontend+QA+SC   ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   ${GREEN}2)${NC} review   — Security+Perf+Coverage+Audit  ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   ${GREEN}3)${NC} debug    — 3 Bug Hunters (Hypothesis)    ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   ${GREEN}4)${NC} docs     — API+Student+Employer docs     ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   ${GREEN}5)${NC} ops      — DevOps+Seed+Analytics         ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   ${GREEN}6)${NC} migrate  — DB Migration (single)         ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   ${GREEN}7)${NC} extract  — Extract + Migrator            ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   ${GREEN}8)${NC} i18n     — Internationalization (single) ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   ${GREEN}9)${NC} audit    — Contract Auditor (single)     ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}                                                ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   ${YELLOW}l)${NC} list     — list all 22 agents            ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   ${YELLOW}s)${NC} status   — show active sessions          ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   ${RED}k)${NC} kill     — kill all sessions             ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   ${RED}q)${NC} quit                                    ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}                                                ${CYAN}║${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -n "เลือก (1-9, l/s/k/q): "
  read -r choice
  case "$choice" in
    1|dev)      mode_dev "$@" ;;
    2|review)   mode_review "$@" ;;
    3|debug)    mode_debug "$@" ;;
    4|docs)     mode_docs "$@" ;;
    5|ops)      mode_ops "$@" ;;
    6|migrate)  mode_migrate ;;
    7|extract)  mode_extract ;;
    8|i18n)     mode_i18n ;;
    9|audit)    mode_audit ;;
    l|list)     list_agents ;;
    s|status)   show_status ;;
    k|kill)     kill_sessions ;;
    q|quit)     exit 0 ;;
    *)          echo "ไม่รู้จักคำสั่ง: $choice"; show_menu ;;
  esac
}

mode_dev()     { bash "$SCRIPT_DIR/tmux-dev.sh" "$@"; }
mode_review()  { bash "$SCRIPT_DIR/tmux-review.sh" "$@"; }
mode_debug()   { bash "$SCRIPT_DIR/tmux-debug.sh" "$@"; }
mode_docs()    { bash "$SCRIPT_DIR/tmux-docs.sh" "$@"; }
mode_ops()     { bash "$SCRIPT_DIR/tmux-ops.sh" "$@"; }

mode_migrate() {
  echo -e "${GREEN}Starting DB Migration agent...${NC}"
  cd "$PROJECT_DIR" && claude --system-prompt agents/docs/db-migration.md
}

mode_i18n() {
  echo -e "${GREEN}Starting i18n agent...${NC}"
  cd "$PROJECT_DIR" && claude --system-prompt agents/dev/i18n.md
}

mode_audit() {
  echo -e "${GREEN}Starting Contract Auditor agent...${NC}"
  cd "$PROJECT_DIR" && claude --system-prompt agents/review/contract-auditor.md
}

mode_extract() {
  SESSION="skillchain-extract"
  tmux has-session -t $SESSION 2>/dev/null
  if [ $? -eq 0 ]; then
    tmux attach -t $SESSION
    return
  fi

  tmux new-session -d -s $SESSION -n "extract" -c "$PROJECT_DIR"
  tmux split-window -h -t $SESSION:extract -c "$PROJECT_DIR"

  tmux send-keys -t "$SESSION:extract.0" "claude --system-prompt agents/extract/extractor.md" Enter
  tmux send-keys -t "$SESSION:extract.1" "claude --system-prompt agents/extract/migrator.md" Enter

  echo -e "${GREEN}Extract session ready! (Extractor | Migrator)${NC}"
  tmux attach -t $SESSION
}

mode_single() {
  local agent_file="$1"
  if [ -z "$agent_file" ]; then
    echo -e "${RED}Usage: bash scripts/agents.sh single <agent-file>${NC}"
    echo "Example: bash scripts/agents.sh single agents/dev/backend.md"
    exit 1
  fi
  if [ ! -f "$PROJECT_DIR/$agent_file" ]; then
    echo -e "${RED}Agent file not found: $agent_file${NC}"
    exit 1
  fi
  cd "$PROJECT_DIR" && claude --system-prompt "$agent_file"
}

list_agents() {
  echo ""
  echo -e "${CYAN}=== SkillChain Agents (22) ===${NC}"
  echo ""
  echo -e "${GREEN}Development (6):${NC}"
  echo "  1. Lead             agents/dev/lead.md"
  echo "  2. Backend          agents/dev/backend.md"
  echo "  3. Frontend         agents/dev/frontend.md"
  echo "  4. QA               agents/dev/qa.md"
  echo "  5. Smart Contract   agents/dev/smart-contract.md"
  echo "  6. i18n             agents/dev/i18n.md"
  echo ""
  echo -e "${GREEN}Code Review (4):${NC}"
  echo "  7. Security         agents/review/security.md"
  echo "  8. Performance      agents/review/performance.md"
  echo "  9. Test Coverage    agents/review/test-coverage.md"
  echo " 10. Contract Auditor agents/review/contract-auditor.md"
  echo ""
  echo -e "${GREEN}Documentation (4):${NC}"
  echo " 11. DB Migration     agents/docs/db-migration.md"
  echo " 12. API Doc Writer   agents/docs/writer-api.md"
  echo " 13. Student Manual   agents/docs/writer-student.md"
  echo " 14. Employer Manual  agents/docs/writer-employer.md"
  echo ""
  echo -e "${GREEN}Debug (3):${NC}"
  echo " 15. Bug Hunter FE    agents/debug/bug-hunter-frontend.md"
  echo " 16. Bug Hunter BE    agents/debug/bug-hunter-backend.md"
  echo " 17. Bug Hunter BC    agents/debug/bug-hunter-blockchain.md"
  echo ""
  echo -e "${GREEN}Ops (3):${NC}"
  echo " 18. DevOps           agents/ops/devops.md"
  echo " 19. Seed & Demo      agents/ops/seed-demo.md"
  echo " 20. Analytics        agents/ops/analytics.md"
  echo ""
  echo -e "${GREEN}Extract (2):${NC}"
  echo " 21. Extractor        agents/extract/extractor.md"
  echo " 22. Migrator         agents/extract/migrator.md"
  echo ""
}

show_status() {
  echo ""
  echo -e "${CYAN}Active tmux sessions:${NC}"
  tmux ls 2>/dev/null || echo "  (no active sessions)"
  echo ""
}

kill_sessions() {
  echo -e "${YELLOW}Killing all skillchain tmux sessions...${NC}"
  for s in skillchain skillchain-review skillchain-debug skillchain-docs skillchain-ops skillchain-extract; do
    tmux kill-session -t "$s" 2>/dev/null && echo -e "  ${RED}killed${NC} $s"
  done
  echo -e "${GREEN}Done.${NC}"
}

# --- Main ---
case "${1:-}" in
  dev)      shift; mode_dev "$@" ;;
  review)   shift; mode_review "$@" ;;
  debug)    shift; mode_debug "$@" ;;
  docs)     shift; mode_docs "$@" ;;
  ops)      shift; mode_ops "$@" ;;
  migrate)  mode_migrate ;;
  extract)  mode_extract ;;
  i18n)     mode_i18n ;;
  audit)    mode_audit ;;
  single)   shift; mode_single "$@" ;;
  list)     list_agents ;;
  status)   show_status ;;
  kill)     kill_sessions ;;
  "")       show_menu ;;
  *)        echo "Unknown mode: $1"; echo "Usage: bash scripts/agents.sh [dev|review|debug|docs|ops|migrate|extract|i18n|audit|single|list|status|kill]"; exit 1 ;;
esac
