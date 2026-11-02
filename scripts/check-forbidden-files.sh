#!/bin/sh
# Fails if the git index contains files that must never be published from this
# public repository: AI assistant configuration and secrets.
set -eu

ai='(^|/)(AGENTS\.md|CLAUDE\.md|GEMINI\.md|SKILL\.md|\.mcp\.json|\.cursorrules|\.windsurfrules)$|^(\.claude|\.cursor|\.harness|\.windsurf|\.codex|\.continue)/|^\.aider|^\.github/copilot-instructions\.md$'
secret='(^|/)\.env($|\.)|\.pem$|\.key$|\.p12$|\.pfx$|(^|/)id_(rsa|ed25519|ecdsa)(\.pub)?$'

status=0
found=$(git ls-files | grep -E "$ai" || true)
if [ -n "$found" ]; then
  echo "::error::AI assistant configuration files are not allowed in this repository:"
  echo "$found"
  status=1
fi
found=$(git ls-files | grep -Ei "$secret" | grep -Ev '\.env\.example$' || true)
if [ -n "$found" ]; then
  echo "::error::Secret-like files are not allowed in this repository:"
  echo "$found"
  status=1
fi
for f in $(git ls-files | grep -E '(^|/)\.npmrc$' || true); do
  if grep -Eiq '_authToken|_auth[[:space:]]*=|_password' "$f"; then
    echo "::error::$f contains registry credentials."
    status=1
  fi
done
[ "$status" -eq 0 ] && echo "No forbidden files found."
exit "$status"
