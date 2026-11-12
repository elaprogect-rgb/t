// Cloudflare Worker: accepts a review and commits it to reviews.json in the GitHub repo.
// Secrets: GITHUB_TOKEN (fine-grained PAT, Contents: read/write on elaprogect-rgb/t only)
// Vars (optional): ALLOWED_ORIGIN (your site's origin, e.g. https://elaprogect-rgb.github.io)
const REPO = "elaprogect-rgb/t", BRANCH = "main", FILE = "reviews.json";

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

    let b;
    try { b = await req.json(); } catch { return new Response("Bad JSON", { status: 400, headers: cors }); }
    const name = String(b.name || "").trim().slice(0, 40);
    const note = String(b.note || "").trim().slice(0, 300);
    const rating = Number(b.rating);
    if (!name || !Number.isInteger(rating) || rating < 1 || rating > 5)
      return new Response("Invalid review", { status: 400, headers: cors });

    const api = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
    const h = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "ela-progect-worker", Accept: "application/vnd.github+json" };

    for (let attempt = 0; attempt < 3; attempt++) { // retry on sha conflicts
      const cur = await (await fetch(`${api}?ref=${BRANCH}`, { headers: h })).json();
      const list = JSON.parse(atob(cur.content.replace(/\n/g, "")) || "[]");
      list.push({ name, rating, note, date: new Date().toISOString() });
      const body = {
        message: `New review from ${name}`, branch: BRANCH, sha: cur.sha,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(list.slice(-200), null, 2))))
      };
      const put = await fetch(api, { method: "PUT", headers: h, body: JSON.stringify(body) });
      if (put.ok) {
        // refresh jsDelivr's cached copy
        await fetch(`https://purge.jsdelivr.net/gh/${REPO}@${BRANCH}/${FILE}`).catch(() => {});
        return new Response("ok", { headers: cors });
      }
      if (put.status !== 409) break;
    }
    return new Response("Failed to save", { status: 502, headers: cors });
  }
};
