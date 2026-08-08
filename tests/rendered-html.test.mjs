import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Chiaro calculator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="it"/i);
  assert.match(html, /<title>Chiaro — Calcolo stipendio netto 2026<\/title>/i);
  assert.match(html, /Dal costo azienda/);
  assert.match(html, /Dati del dipendente/);
  assert.match(html, /Parametri utilizzati/);
  assert.match(html, /Costa all/);
  assert.match(html, /Non tutti i mesi sono uguali/);
  assert.match(html, /Dove finisce ogni euro/);
  assert.match(html, /Quanto rende l/);
  assert.match(html, /La trappola dei 23\.000/);
  assert.match(html, /Metodo di calcolo/);
  assert.match(html, /Sources/);

  // Le fonti normative sono nel markup servito, non caricate a runtime.
  assert.match(html, /TUIR art\. 13/);
  assert.match(html, /L\. 207\/2024/);
  assert.match(html, /Codice civile art\. 2120/);

  // Il grafico dell'aliquota marginale è SVG server-rendered, senza librerie.
  assert.match(html, /<svg[^>]*class="marginal-chart"/);
  assert.match(html, /class="chart-line"/);
  assert.doesNotMatch(html, /Milano · 2026|Calcola il netto|Apri impostazioni avanzate/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
