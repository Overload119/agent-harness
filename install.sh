#!/usr/bin/env bash

set -euo pipefail

REPO_URL="${AGENT_HARNESS_REPO:-https://github.com/overload119/agent-harness.git}"
REPO_REF="${AGENT_HARNESS_REF:-main}"
TMP_ROOT="${AGENT_HARNESS_TMPDIR:-${TMPDIR:-/tmp}}"
BUN_INSTALL_DIR="${BUN_INSTALL:-$HOME/.bun}"

if ! command -v bun >/dev/null 2>&1; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "error: curl is required to install bun" >&2
    exit 1
  fi

  echo "bun not found; installing bun..." >&2
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$BUN_INSTALL_DIR"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

if ! command -v git >/dev/null 2>&1; then
  echo "error: git is required to install agent-harness" >&2
  exit 1
fi

if ! command -v mktemp >/dev/null 2>&1; then
  echo "error: mktemp is required to install agent-harness" >&2
  exit 1
fi

HARNESS_DIR="$(mktemp -d "${TMP_ROOT%/}/agent-harness.XXXXXX")"

cleanup() {
  rm -rf "$HARNESS_DIR"
}

trap cleanup EXIT

git clone --depth 1 --branch "$REPO_REF" "$REPO_URL" "$HARNESS_DIR" >/dev/null
"$HARNESS_DIR/bin/setup" "$@"
