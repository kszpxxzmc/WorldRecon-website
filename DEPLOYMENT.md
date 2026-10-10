# GitHub Pages Deployment

Repository: `kszpxxzmc/WorldRecon-website`

1. In the GitHub repository, open **Settings > Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main`. The **Deploy WorldRecon to GitHub Pages** workflow installs
   dependencies, builds with Vite, and publishes only `dist/`.
4. Open the deployment URL shown in the completed workflow.

Expected project URL, unless a custom domain is configured:
`https://kszpxxzmc.github.io/WorldRecon-website/`

Do not publish the source repository directly from a branch. The source
`index.html` requires Vite processing; the built HTML uses relative asset paths
and works under the repository subpath.

`dist/`, `node_modules/`, and `render-work/` remain ignored. The final images,
GIFs, videos, and PDF under `assets/` must be committed. Local provenance tests
that depend on ignored JSON files are not part of this deployment workflow.

The lockfile uses public npm download URLs so hosted GitHub runners do not need
access to the development machine's internal npm mirror.

## Local Production Preview

```bash
npm ci
npm run build
npm run preview -- --port 4180
```

Forward port 4180 when using VS Code Remote SSH.
