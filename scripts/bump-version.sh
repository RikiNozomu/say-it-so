#!/usr/bin/env bash
# bump-version.sh — update code version across all package.json files
#
# Usage:
#   bash scripts/bump-version.sh           # minor bump (X.Y.Z → X.Y+1.0)
#   bash scripts/bump-version.sh --major   # major bump (X.Y.Z → X+1.0.0)
#   bash scripts/bump-version.sh --set 1.3 # set explicit version (stored as 1.3.0)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PKGS=(
  "$ROOT/package.json"
  "$ROOT/apps/web/package.json"
  "$ROOT/packages/core/package.json"
)

# Read current version from root package.json (strip patch if present)
current=$(node -p "require('$ROOT/package.json').version")
# Normalize: strip trailing .0 so display is X.Y
display=$(echo "$current" | sed 's/\.0$//')

IFS='.' read -r major minor _patch <<< "$current"
minor=${minor:-0}

mode="${1:-}"

case "$mode" in
  --major)
    major=$((major + 1))
    minor=0
    ;;
  --set)
    if [[ -z "${2:-}" ]]; then
      echo "Error: --set requires a version argument (e.g. --set 1.3)" >&2
      exit 1
    fi
    IFS='.' read -r major minor _rest <<< "$2"
    minor=${minor:-0}
    ;;
  ""|--minor)
    minor=$((minor + 1))
    ;;
  *)
    echo "Usage: $0 [--minor|--major|--set X.Y]" >&2
    exit 1
    ;;
esac

# Always store full semver (X.Y.0) for pnpm workspace compatibility
new_version="$major.$minor.0"
new_display="$major.$minor"

echo "Bumping: $display → $new_display  (stored as $new_version)"

for pkg in "${PKGS[@]}"; do
  if [[ ! -f "$pkg" ]]; then
    echo "Warning: $pkg not found, skipping" >&2
    continue
  fi
  node - "$pkg" "$new_version" <<'EOF'
const fs = require('fs');
const [,, file, ver] = process.argv;
const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
obj.version = ver;
fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
console.log('Updated', file);
EOF
done

echo "Done. New version: $new_display"
echo "Remember to git commit the package.json changes before pushing."
