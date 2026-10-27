# little shop frontend

React JavaScript, Vite, React Router, Recharts and Lucide icons. Fonts are bundled
locally. Configuration and complete setup instructions are in [the project README](../README.md).

```bash
npm ci
npm run dev
npm run lint
npm run build
```

The development and preview servers proxy `/api` to the local FastAPI server on
port 8000. Set `VITE_API_BASE_URL` when hosting the frontend separately.
