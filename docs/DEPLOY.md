# Deploying FLUX

FLUX builds to a fully static bundle — no backend, no runtime dependencies.
`npm run build` emits `dist/` (one HTML file, one JS bundle, one CSS file, one
blue-noise PNG; ~80 kB gzipped total), verified to serve standalone from any
plain static file server.

## Requirements

- **Secure context.** The microphone (`getUserMedia`), Web MIDI, and
  Picture-in-Picture all require **HTTPS or `localhost`**. A plain-HTTP LAN
  address will render visuals but cannot capture audio.
- **Root path.** The bundle assumes it is served from `/`. To host under a
  subpath (e.g. `https://host/flux/`), set
  [`base`](https://vite.dev/config/shared-options.html#base) in
  `vite.config.ts` and rebuild.
- No special headers, no service worker, no server-side routing — any static
  host works.

## Self-hosting options

```sh
# Local preview of the production bundle (localhost = mic works)
npm run build && npx vite preview        # serves dist/ on :4173

# Any machine with Python (e.g. a quick LAN demo; needs HTTPS for the mic)
python3 -m http.server 8000 -d dist
```

nginx:

```nginx
server {
  listen 443 ssl;
  server_name flux.example.com;
  # ssl_certificate / ssl_certificate_key ...
  root /srv/flux/dist;
  location / { try_files $uri /index.html; }
}
```

## Hosted: GitHub Pages (live)

The site deploys to **https://itshendri.github.io/Flux/** on every push to
`main`, via [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):
`npm ci` → `npm test` → `npm run build` → upload `dist/` → publish. A failing
test fails the deploy, so `main` cannot publish a broken bundle. Pages serves
HTTPS, so the mic, Web MIDI, and PiP all work.

### The `base` path

A project repo is served from a subpath (`/Flux/`), not root, so the bundle
needs that prefix baked in. `vite.config.ts` reads it from the environment:

```ts
const base = process.env.PAGES_BASE ?? '/';
```

Dev, `vite preview`, and any root-served host therefore stay at `/` with no
config; only the Pages workflow sets `PAGES_BASE=/Flux/`.

### Moving to a custom domain

A custom domain serves at **root**, so the switch is:

1. Add a `CNAME` record at the DNS provider: `flux` → `itshendri.github.io`.
2. Set the domain on the repo (Settings → Pages → Custom domain), which
   commits a `CNAME` file and provisions a free TLS certificate.
3. Delete the `env: PAGES_BASE` block from the build step in `deploy.yml`.

Step 3 is the only code change — that is what the env-driven `base` buys.

Deploys are automatic on `main` only. Nothing else in this repository pushes
anywhere.
