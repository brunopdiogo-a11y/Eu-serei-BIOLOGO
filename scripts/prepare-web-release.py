#!/usr/bin/env python3
"""Publish GitHub Pages with versioned local assets (preserves browser data)."""
import os
import re
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / "www"
dest = root / "_site"
commit = os.environ.get("GITHUB_SHA", "local-dev")[:12]
if dest.exists():
    shutil.rmtree(dest)
shutil.copytree(source, dest)

# Version CSS/JS dependencies and HTML document routes. This ensures a new
# JavaScript module graph for each release rather than using Chrome's cache.
js_import = re.compile(
    r"""(?P<prefix>\bfrom\s*|(?:\bimport\s*\(\s*))(?P<quote>['"])(?P<path>\.{1,2}/[^'"]+\.js)(?P=quote)"""
)
html_asset = re.compile(
    r"""(?P<prefix>\b(?:src|href)=)(?P<quote>['"])(?P<path>(?:\./)?(?:js/[\w./-]+\.js|styles\.css|index\.html|ecologia-privada\.html))(?P=quote)"""
)
def version_import(match):
    return f"{match['prefix']}{match['quote']}{match['path']}?v={commit}{match['quote']}"
def version_html(match):
    return f"{match['prefix']}{match['quote']}{match['path']}?v={commit}{match['quote']}"

for path in dest.rglob("*"):
    if not path.is_file() or path.suffix not in {".js", ".html"}:
        continue
    text = path.read_text(encoding="utf-8")
    text = js_import.sub(version_import, text)
    if path.suffix == ".html":
        text = html_asset.sub(version_html, text)
    # This literal navigation exists in app.js; it is not an HTML attribute.
    if path.name == "app.js":
        text = text.replace("'./ecologia-privada.html'", f"'./ecologia-privada.html?v={commit}'")
    path.write_text(text, encoding="utf-8")

print(f"Prepared {dest} with web release version {commit}")
