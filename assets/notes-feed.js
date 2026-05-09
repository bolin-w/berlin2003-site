const container = document.querySelector("#notion-articles");

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function renderArticles(articles) {
  if (!articles || articles.length === 0) {
    container.style.display = "none";
    return;
  }

  let html = "";
  for (const a of articles) {
    const date = formatDate(a.createdAt);
    html += `
      <a class="section-lab-panel" href="/notes/article/?id=${a.id}" style="text-decoration:none;color:inherit;">
        <p class="section-lab-label">${a.category}</p>
        <h2>${a.title}</h2>
        ${date ? `<p style="font-size:0.82rem;color:var(--section-muted);margin-top:8px;">${date}</p>` : ""}
      </a>`;
  }
  container.innerHTML = html;
}

async function load() {
  try {
    const res = await fetch("/api/notion/articles?public=true");
    const data = await res.json();
    if (res.ok) renderArticles(data.articles);
  } catch {
    container.style.display = "none";
  }
}

load();
