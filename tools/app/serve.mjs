// Serves the app the way GitHub Pages will: under /brin-gym/, never at the
// root, so a URL that only works at the root fails here first.
//
//   node tools/app/serve.mjs              the app as it is on disk
//   node tools/app/serve.mjs --fixtures   with tests/fixtures/ standing in for
//                                         app/data/ and app/art/
//   node tools/app/serve.mjs --as-published   every file exactly as it is on
//                                             disk, as GitHub Pages serves it
//   node tools/app/serve.mjs --port 5000
//
// The offline file list and the build value in sw.js are worked out on each
// request from the files being served, so the service worker always matches
// what is on disk and the app needs no test-only switch. With --as-published
// they are served as written by tools/app/offline-list.mjs instead, which is
// how the pair that is about to be published gets tested (tools/publish.mjs).

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { APP_DIR, LIST_FILE, WORKER_FILE, describe, scan, serializeList, stampWorker } from "./offline-list.mjs";

const FIXTURES_DIR = fileURLToPath(new URL("../../tests/fixtures/", import.meta.url));
const INDEX_FILE = "index.html";
export const MOUNT = "/brin-gym/";
export const DEFAULT_PORT = 4173;

// The workouts and the drawings; with --fixtures they come from
// tests/fixtures/ instead.
const CONTENT_FOLDERS = ["data/", "art/"];

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2",
};

const isContent = (url) => CONTENT_FOLDERS.some((folder) => url.startsWith(folder));

// Every file the server offers, as { url, file }. Only these are ever served,
// so nothing outside the app (or the fixtures) can be reached by a crafted path.
async function served(fixtures) {
  const app = await scan(APP_DIR);
  if (!fixtures) return app;
  const content = await Promise.all(
    CONTENT_FOLDERS.map((folder) => scan(path.join(FIXTURES_DIR, folder), folder)),
  );
  return [...app.filter(({ url }) => !isContent(url)), ...content.flat()];
}

export async function startServer({ port = DEFAULT_PORT, fixtures = false, asPublished = false } = {}) {
  // The offline list on disk names the real drawings, so the worker could
  // never install over the fixtures.
  if (fixtures && asPublished) throw new Error("--fixtures and --as-published cannot be used together.");
  // Changing the salt stands in for publishing a new version: the files stay
  // the same but the build value, and so the bytes of sw.js, change.
  let buildSalt = "";

  async function body(url) {
    const entries = await served(fixtures);
    const entry = entries.find((candidate) => candidate.url === url);
    // The offline list and the worker's stamp are worked out from what is
    // being served, unless the app is served as published.
    const workedOutHere = !asPublished && (url === LIST_FILE || (url === WORKER_FILE && entry));
    if (!workedOutHere) return entry ? readFile(entry.file) : null;

    const described = await describe(entries);
    const list = { ...described, build: described.build + buildSalt };
    return url === LIST_FILE ? serializeList(list) : stampWorker(await readFile(entry.file, "utf8"), list.build);
  }

  async function respond(request, response) {
    const { pathname } = new URL(request.url, "http://localhost");
    if (pathname === "/" || pathname === MOUNT.slice(0, -1)) {
      response.writeHead(302, { Location: MOUNT }).end();
      return;
    }

    const url = pathname.startsWith(MOUNT) ? decodeURIComponent(pathname.slice(MOUNT.length)) || INDEX_FILE : null;
    const type = url && TYPES[path.extname(url)];
    const content = type ? await body(url) : null;
    if (content === null) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" }).end(content);
  }

  const server = createServer((request, response) => {
    respond(request, response).catch((error) => response.writeHead(500).end(String(error)));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    url: `http://localhost:${server.address().port}${MOUNT}`,
    publishNewVersion(salt) {
      buildSalt = salt;
    },
    // Browsers hold connections open, and close() alone would wait for them.
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: {
      fixtures: { type: "boolean", default: false },
      "as-published": { type: "boolean", default: false },
      port: { type: "string", default: String(DEFAULT_PORT) },
    },
  });
  const { url } = await startServer({
    port: Number(values.port),
    fixtures: values.fixtures,
    asPublished: values["as-published"],
  });
  console.log(`Brin Gym at ${url}${values.fixtures ? " (fixture data and drawings)" : ""}`);
}
