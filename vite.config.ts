import { defineConfig } from 'vite';

// Served from `/` everywhere (dev, `vite preview`, a custom domain) unless a
// deploy target says otherwise. GitHub Pages serves a project repo from a
// subpath, so its workflow sets PAGES_BASE=/Flux/. Moving to a custom domain,
// which serves at root, means dropping that one env line from the workflow.
const base = process.env.PAGES_BASE ?? '/';

export default defineConfig({
  base,
  server: {
    host: 'localhost',
    port: 5173,
  },
});
