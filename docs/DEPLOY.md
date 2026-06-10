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

## Hosted options (gated — approval required)

Per company tooling policy, **do not deploy to third-party services where
there is no company account** (Netlify, Vercel, etc.) and do not publish
without explicit approval. Candidates to evaluate *with* approval:

- **GitLab Pages on the company GitLab** — the natural fit: CI builds
  `dist/`, Pages serves it over HTTPS on an internal URL.
- An internal static bucket/CDN already operated by the company.

Nothing in this repository pushes anywhere; deployment is a deliberate,
human-approved step.
