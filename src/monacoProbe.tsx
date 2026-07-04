// Standalone Monaco probe page (dev-only): verifies theme + tokenization
// outside the Tauri shell. Open /monaco-probe.html on the vite dev server.
import ReactDOM from "react-dom/client";
import { MonacoPane } from "./editor/MonacoPane";

const SAMPLE = `#!/usr/bin/env ts-node
import 'dotenv/config';
import fetch from 'node-fetch';
// TMDB setup
const TMDB_API_KEY = "65f68784b70eca636435bad597ce6ce6";
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
async function fetchFromTMDB(endpoint, params = {}) {
  const url = new URL(\`\${TMDB_BASE_URL}\${endpoint}\`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(\`TMDB API error: \${res.statusText}\`);
  return (await res.json());
}
`;

window.addEventListener("error", (e) => {
  document.title = `ERR: ${e.message}`;
  console.error("PROBE-ERROR", e.message);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <div style={{ height: "100vh" }}>
    <MonacoPane path="C:\\probe\\index.js" value={SAMPLE} language="javascript" />
  </div>,
);
