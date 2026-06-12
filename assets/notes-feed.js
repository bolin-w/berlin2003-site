const NOTE_CATEGORIES = ["论文阅读", "模型判断", "部署记录", "页面改版"];

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function renderInto(container, articles) {
  if (!articles || articles.length === 0) {
    container.parentElement.style.display = "none";
    return;
  }
  let html = "";
  for (const a of articles) {
    const date = formatDate(a.createdAt);
    html += `
      <a class="section-lab-panel" href="/notes/article/?id=${a.id}" style="text-decoration:none;color:inherit;">
        <h2>${a.title}</h2>
        ${date ? `<p style="font-size:0.82rem;color:var(--section-muted);margin-top:8px;">${date}</p>` : ""}
      </a>`;
  }
  container.innerHTML = html;
}

async function load() {
  try {
    const res = await fetch("/api/notion/articles?public=true&module=笔记");
    const data = await res.json();
    if (!res.ok) return;

    const articles = data.articles || [];
    for (const cat of NOTE_CATEGORIES) {
      const section = document.querySelector("#notion-" + CSS.escape(cat));
      if (!section) continue;
      const grid = section.querySelector(".notion-sub-grid");
      const items = articles.filter((a) => a.category === cat);
      renderInto(grid, items);
    }
  } catch {
    // hide all sub-sections on error
    for (const cat of NOTE_CATEGORIES) {
      const section = document.querySelector("#notion-" + CSS.escape(cat));
      if (section) section.style.display = "none";
    }
  }
}

load();
