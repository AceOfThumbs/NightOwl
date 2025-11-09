# NightOwl

NightOwl is a static circadian rhythm planner built with plain HTML, CSS, and JavaScript. The `gh-pages` branch hosts the production build so it can be served directly from GitHub Pages without any additional tooling.

## Preview the site on GitHub Pages

1. Open **Settings → Pages** in the repository on GitHub.
2. Set the **Source** to `gh-pages` and the **Branch** to the root (`/`) folder, then click **Save**.
3. Wait for the automatic **pages build and deployment** workflow to finish. A green banner will appear once the deploy succeeds.
4. Visit `https://<your-username>.github.io/NightOwl/` to view the published site. Because the project is static, assets referenced with relative paths (like `nightowl.css` and `nightowl.js`) will load automatically.

> **Tip:** If you rename `index.html` or move files around, update the links in `index.html` so that they remain relative. Pages hosting uses case-sensitive URLs, so the repository name must match exactly in the published URL.

## Running the app locally

You do not need a build step to work on NightOwl. Any simple static file server will do:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/index.html` in your browser. Changes to the HTML, CSS, or JS files take effect as soon as you refresh.

## Repository layout

```
NightOwl/
├── index.html      # Main HTML entry point
├── nightowl.css    # Page styling
└── nightowl.js     # App logic and planner interactions
```

Feel free to customize the content and styling on a feature branch before merging back into `gh-pages`.
