import { mkdir, readFile, writeFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const output = `const html = ${JSON.stringify(html)};

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fetchDictionaryEntry(word) {
  const endpoint = "https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(endpoint, { headers: { accept: "application/json" } });
      if (response.status === 404) return { word, entries: null };
      if (response.ok) return { word, entries: await response.json() };
      if (response.status !== 429 && response.status < 500) return { word, entries: null };
    } catch (error) {
      if (attempt === 2) return { word, entries: null, error: true };
    }
    await wait(300 * (attempt + 1));
  }
  return { word, entries: null, error: true };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/api/pronunciation") {
      const text = (url.searchParams.get("text") || "").slice(0, 160);
      const words = [...new Set((text.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || []).map(word => word.toLowerCase()))].slice(0, 10);
      if (!words.length) {
        return Response.json({ results: [] }, { status: 400 });
      }
      const results = [];
      for (const word of words) results.push(await fetchDictionaryEntry(word));
      return Response.json({ results }, {
        headers: { "cache-control": "public, max-age=86400" }
      });
    }
    if (url.pathname !== "/" && url.pathname !== "/index.html") {
      return new Response("Not Found", { status: 404 });
    }
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-cache"
      }
    });
  }
};
`;

await mkdir(new URL("../dist/server/", import.meta.url), { recursive: true });
await writeFile(new URL("../dist/server/index.js", import.meta.url), output);
