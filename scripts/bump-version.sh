#!/usr/bin/env bash
# bump-version.sh — update code version across all package.json files
#
# Usage:
#   bash scripts/bump-version.sh           # minor bump (X.Y → X.Y+1)
#   bash scripts/bump-version.sh --major   # major bump (X.Y → X+1.0)
#   bash scripts/bump-version.sh --set 1.3 # set explicit version

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PKGS=(
  "$ROOT/package.json"
  "$ROOT/apps/web/package.json"
  "$ROOT/packages/core/package.json"
)

# Read current version from root package.json
current=$(node -p "require('$ROOT/package.json').version")

IFS='.' read -r major minor <<< "$current"

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
    IFS='.' read -r major minor <<< "$2"
    ;;
  ""|--minor)
    minor=$((minor + 1))
    ;;
  *)
    echo "Usage: $0 [--minor|--major|--set X.Y]" >&2
    exit 1
    ;;
esac

new_version="$major.$minor"

echo "Bumping: $current → $new_version"

for pkg in "${PKGS[@]}"; do
  if [[ ! -f "$pkg" ]]; then
    echo "Warning: $pkg not found, skipping" >&2
    continue
  fi
  # Use node to rewrite version field safely (preserves formatting via JSON.stringify with indent)
  node - "$pkg" "$new_version" <<'EOF'
const fs = require('fs');
const [,, file, ver] = process.argv;
const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
obj.version = ver;
fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
console.log('Updated', file);
EOF
done

echo "Done. New version: $new_version"
echo "Remember to git commit the package.json changes before pushing."
