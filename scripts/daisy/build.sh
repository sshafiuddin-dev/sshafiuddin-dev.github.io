#!/bin/sh
# Rebuilds iqama/daisy.css (daisyUI components, prefixed d-). Needs Node. Run after adding a new d- class.
# Tailwind also emits a few stray utilities for plain words found in the source (hidden, table, fixed, ...); they are stripped.
set -e
cd "$(dirname "$0")"
npx --yes -p tailwindcss@4.1.13 -p @tailwindcss/cli@4.1.13 -p daisyui@5.1.32 tailwindcss -i in.css -o /tmp/daisy.min.css --minify
python3 - <<'PY'
import re
s = open('/tmp/daisy.min.css').read()
for c in ['visible', 'fixed', 'hidden', 'table', 'resize', 'shadow']:
    s = re.sub(r'\.%s\{[^{}]*\}' % c, '', s)
open('../../iqama/daisy.css', 'w').write(s)
PY
