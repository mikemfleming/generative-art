# Generative Art

A minimal Next.js site that exports static HTML.

```sh
nvm install
nvm use
npm ci
npm run dev
```

Open http://localhost:3000 to view the site.

The homepage is blank. Visit `/burn-after-reading/?text=Your%20message` for
the interactive fire.

Run `npm run build` to generate the static site in `out/`. Deploy that
directory to any static web host.

GitHub Actions deploys pushes to `main` to GitHub Pages at
https://mikemfleming.github.io/generative-art/. The workflow sets the base
path for Pages; local development stays at the root.
