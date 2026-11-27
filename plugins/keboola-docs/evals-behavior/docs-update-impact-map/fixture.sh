#!/bin/bash
set -euo pipefail
"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../_fixture/docs-repo.sh"
P=src/content/docs/guide/clean-howto.md
perl -0pi -e 's/\*\*Next:\*\*/Click **Open App** in the header to see the guide.\n\n![The header with the Open App button](\/guide\/open-app.png)\n\n**Next:**/' "$P"
: > public/guide/open-app.png
git add -A && git commit -q -m "page with the Open App button"
