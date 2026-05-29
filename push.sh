#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
git remote set-url origin git@github.com:greensonrock/moonlit-tarot.git
git push -u origin main
echo "Done: https://github.com/greensonrock/moonlit-tarot"
