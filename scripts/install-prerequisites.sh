#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
print_help() {
    cat <<'EOF'
Usage: install.sh [options]

Verifies required dependencies (git, python3, node, databricks) and installs
any that are missing. By default, the script will NOT install Homebrew, will
NOT upgrade unrelated packages on your system, and will NOT touch tools you
already have on PATH.

Options:
  --no-brew      Never use Homebrew. Missing tools must be installed by you,
                 or (for the Databricks CLI) via the official installer.
  --use-brew     Allow Homebrew for installing missing tools on macOS. Will
                 NOT install Homebrew itself and will NOT run `brew upgrade`
                 on unrelated packages.
  --dry-run      Print what would happen without installing anything.
  -h, --help     Show this help and exit.

Default behavior: --no-brew on Linux, prompt-free detect-only on macOS unless
--use-brew is passed. The Databricks CLI falls back to the official installer
script when Homebrew is unavailable or disabled.
EOF
}

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
USE_BREW=0
NO_BREW=0
DRY_RUN=0

for arg in "$@"; do
    case "$arg" in
        --no-brew)  NO_BREW=1 ;;
        --use-brew) USE_BREW=1 ;;
        --dry-run)  DRY_RUN=1 ;;
        -h|--help)  print_help; exit 0 ;;
        *) error "Unknown option: $arg (try --help)" ;;
    esac
done

if [[ $USE_BREW -eq 1 && $NO_BREW -eq 1 ]]; then
    error "--use-brew and --no-brew are mutually exclusive."
fi

# Default: do not use brew unless the caller explicitly opts in.
if [[ $USE_BREW -eq 0 ]]; then
    NO_BREW=1
fi

run() {
    if [[ $DRY_RUN -eq 1 ]]; then
        echo "  + $*"
    else
        eval "$@"
    fi
}

# ---------------------------------------------------------------------------
# Homebrew (optional, opt-in only)
# ---------------------------------------------------------------------------
BREW_AVAILABLE=0
if [[ $NO_BREW -eq 0 ]]; then
    if command -v brew &>/dev/null; then
        BREW_AVAILABLE=1
        info "Homebrew detected ($(brew --version | head -1)). Will use it for missing tools."
    else
        warn "--use-brew was set but Homebrew is not installed."
        warn "This script will NOT install Homebrew for you. Install it from https://brew.sh"
        warn "Falling back to vendor installers / detect-only behavior."
    fi
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
brew_install_if_missing() {
    local formula="$1"
    if brew list --formula 2>/dev/null | grep -q "^${formula}\$"; then
        info "${formula} already installed via brew."
    else
        info "Installing ${formula} via brew..."
        run "brew install \"$formula\""
    fi
}

require_tool() {
    # require_tool <command> <friendly-name> <install-hint>
    local cmd="$1" name="$2" hint="$3"
    if command -v "$cmd" &>/dev/null; then
        info "${name} found: $($cmd --version 2>&1 | head -1)"
        return 0
    fi
    error "${name} is required but was not found on PATH.
  How to install:
${hint}
  Re-run this script after installing."
}

# ---------------------------------------------------------------------------
# Core tools — detect first, never silently replace
# ---------------------------------------------------------------------------
require_tool git "git" "    - macOS:  xcode-select --install
    - Linux:  use your package manager (apt/yum/dnf/pacman)
    - Other:  https://git-scm.com/downloads"

require_tool python3 "Python 3" "    - macOS:  brew install python@3.12  OR  https://www.python.org/downloads/
    - Linux:  use your package manager (e.g. apt install python3)
    - Recommended: pyenv (https://github.com/pyenv/pyenv) for version management"

require_tool node "Node.js" "    - Recommended: nvm (https://github.com/nvm-sh/nvm)
                  fnm (https://github.com/Schniz/fnm)
                  volta (https://volta.sh)
    - Direct:      https://nodejs.org/en/download"

# ---------------------------------------------------------------------------
# Databricks CLI — install only if missing
# ---------------------------------------------------------------------------
if command -v databricks &>/dev/null; then
    info "Databricks CLI found: $(databricks --version 2>&1 | head -1)"
else
    info "Databricks CLI not found — installing..."
    if [[ $BREW_AVAILABLE -eq 1 ]]; then
        if ! brew tap 2>/dev/null | grep -q "^databricks/tap\$"; then
            run "brew tap databricks/tap"
        fi
        brew_install_if_missing databricks
    else
        info "Using the official Databricks CLI installer (no Homebrew required)."
        run "curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh"
    fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
info "Setup complete. Detected versions:"
echo "  git        : $(git --version 2>/dev/null || echo 'missing')"
echo "  python3    : $(python3 --version 2>/dev/null || echo 'missing')"
echo "  node       : $(node --version 2>/dev/null || echo 'missing')"
echo "  databricks : $(databricks --version 2>/dev/null || echo 'check your PATH')"
echo ""

if [[ $DRY_RUN -eq 1 ]]; then
    warn "Dry-run mode: no changes were made."
fi

info "Done."
