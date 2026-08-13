# BPhO video showcase

A standalone publication of the animated opening page for the BPhO
Computational Challenge 2026 quantum mechanics project. The current stage
contains the homepage only.

## Local preview

From this directory, run:

```bash
python3 -m http.server 4186
```

Then open `http://127.0.0.1:4186/`.

The site is static, uses relative paths, and can be published directly with
GitHub Pages. Its procedural background and entrance sequence are bundled with
local, pinned browser dependencies, so the homepage makes no runtime CDN
requests.
