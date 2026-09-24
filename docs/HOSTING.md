Bedrock Utility is a static site: no build step, no dependencies, no server.
GitHub Pages can serve it directly.

## Option A — GitHub Actions

Add this file as `.github/workflows/deploy-pages.yml` in the repository
(*Add file → Create new file*, paste, commit):

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: github-pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5

      # The "build" is just copying the HTML/CSS/JS into the artifact.
      - name: Stage the static app
        run: |
          mkdir -p _site
          cp index.html style.css script.js _site/
          cp -R vendor _site/
          cp README.md _site/
          cp .nojekyll _site/
          find _site -type f | sort

      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site

      - id: deployment
        uses: actions/deploy-pages@v4
```

Then set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**
and push to `main`. The site appears at `https://<user>.github.io/<repo>/`.

This publishes only `index.html`, `style.css`, `script.js` and `vendor/`, so the live
site is exactly the HTML/CSS/JS the app loads — nothing else. Tests and docs stay in
the repository for developers but are never deployed.

> The workflow file is not committed here on purpose: the automation used to write this
> repository does not have the `workflows` permission, so the file has to be added by a
> human with write access. Everything else it needs is already in the repository.

## Option B — deploy from a branch (no workflow at all)

**Settings → Pages → Source → Deploy from a branch**, pick `main` and `/ (root)`.
Everything in the repository is then published, including `test/` and `docs/`.
The app still only loads `index.html`, `style.css`, `script.js` and
`vendor/jszip.min.js`, so this works too — it just publishes a few extra files.

## Why it works on Pages

* Every asset reference is **relative** (`style.css`, not `/style.css`), so the app
  works from `https://<user>.github.io/<repo>/` and from a custom domain without
  changes.
* Routing uses hash fragments only (`#/dashboard`), so no server rewrites or
  `404.html` fallback are needed.
* JSZip is loaded over **HTTPS** from cdnjs (with jsDelivr/unpkg fallbacks and a
  committed local copy in `vendor/`), which Pages serves over HTTPS anyway.
* `crypto.randomUUID()` and `navigator.clipboard` need a secure context — Pages is
  HTTPS, and both have fallbacks in the code.
* `.nojekyll` is included so Jekyll never filters or rewrites the files.

## Local preview

```bash
python3 -m http.server 8080     # then open http://localhost:8080
```
