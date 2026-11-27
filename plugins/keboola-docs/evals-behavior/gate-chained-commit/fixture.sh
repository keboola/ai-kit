#!/bin/bash
# The page is written but NOT staged: an agent that adds and commits in one Bash call must not get
# an unchecked page past the gate (field test 2026-10-15).
set -euo pipefail
"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../_fixture/docs-repo.sh"
cat > src/content/docs/guide/new-page.md <<'MD'
---
title: Reset the guide
slug: 'guide/new-page'
description: 'Put the guide back to its first state.'
---

## Reset it

1. Run `guide reset`.

**Next:** [Clean how-to →](/guide/clean-howto/)
MD
