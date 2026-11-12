// ELA Progect rating app – vanilla JS
const CONFIG = {
  repo: "elaprogect-rgb/t",
  branch: "main",
  file: "reviews.json",
  // Paste your Cloudflare Worker URL here (see worker.js). Leave empty for local-only demo mode.
  endpoint: ""
};
const $ = id => document.getElementById(id);
let rating = 0;

// ---- stars ----
const starsEl = $("stars");
for (let i = 1; i <= 5; i++) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "star"; b.textContent = "★";
  b.setAttribute("role", "radio"); b.setAttribute("aria-label", i + " star" + (i > 1 ? "s" : ""));
  b.onclick = () => { rating = i; paint(); };
  b.onmouseenter = () => paint(i);
  starsEl.appendChild(b);
}
starsEl.onmouseleave = () => paint();
function paint(n = rating) {
  [...starsEl.children].forEach((b, i) => {
    b.classList.toggle("on", i < n);
    b.setAttribute("aria-checked", i + 1 === rating);
  });
}

// ---- reviews ----
const LOCAL = "ela_progect_local_reviews";
const localReviews = () => { try { return JSON.parse(localStorage.getItem(LOCAL)) || []; } catch { return []; } };

async function loadReviews() {
  let remote = [];
  try {
    // cache-bust so new reviews show up despite jsDelivr's branch caching (Worker also purges it)
    const url = `https://cdn.jsdelivr.net/gh/${CONFIG.repo}@${CONFIG.branch}/${CONFIG.file}?t=${Math.floor(Date.now() / 60000)}`;
    const r = await fetch(url);
    if (r.ok) remote = await r.json();
  } catch {}
  const all = [...remote, ...localReviews()].filter(x => x && x.name && x.rating >= 1 && x.rating <= 5);
  render(all.reverse());
}

function card(r) {
  const d = document.createElement("div"); d.className = "review";
  const s = document.createElement("div"); s.className = "s";
  s.textContent = "★".repeat(r.rating);
  if (r.rating < 5) { const i = document.createElement("i"); i.textContent = "★".repeat(5 - r.rating); s.appendChild(i); }
  const b = document.createElement("b"); b.textContent = r.name;
  d.append(s);
  if (r.note) { const p = document.createElement("p"); p.textContent = r.note; d.append(p); }
  d.append(b);
  return d;
}

function render(list) {
  const track = $("track"), box = $("marquee");
  track.replaceChildren();
  $("empty").hidden = list.length > 0;
  box.hidden = list.length === 0;
  if (!list.length) return;
  list.forEach(r => track.appendChild(card(r)));
  const enough = list.length >= 4;
  box.classList.toggle("static", !enough);
  if (enough) {
    [...track.children].forEach(c => track.appendChild(c.cloneNode(true))); // duplicate for seamless loop
    track.style.setProperty("--dur", Math.max(20, list.length * 6) + "s");
  }
}

// ---- submit ----
$("form").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("msg"); msg.className = "";
  if ($("website").value) return; // honeypot
  const name = $("name").value.trim(), note = $("note").value.trim();
  if (!name) return;
  if (!rating) { msg.textContent = "Please pick a star rating."; msg.className = "err"; return; }
  const review = { name, rating, note, date: new Date().toISOString() };
  const btn = $("submit"); btn.disabled = true;
  try {
    if (CONFIG.endpoint) {
      const r = await fetch(CONFIG.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(review) });
      if (!r.ok) throw new Error();
    }
    // keep a local copy so the author sees it immediately (CDN may lag behind)
    localStorage.setItem(LOCAL, JSON.stringify([...localReviews(), review].slice(-20)));
    msg.textContent = "Thanks for your rating!";
    $("form").reset(); rating = 0; paint();
    loadReviews();
  } catch {
    msg.textContent = "Couldn't submit. Please try again."; msg.className = "err";
  }
  btn.disabled = false;
});

loadReviews();
