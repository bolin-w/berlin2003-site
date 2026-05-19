const container = document.querySelector("#project-articles");
if (!container) throw new Error("missing #project-articles");

const matchKeys = (container.dataset.match || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function render(articles) {
  const items = (articles || []).filter((a) => {
    const cat = String(a.category || "").toLowerCase();
    return matchKeys.some((key) => cat.includes(key));
  });

  const countEl = document.querySelector("#project-count");
  if (countEl) countEl.textContent = items.length + " 篇";

  if (!items.length) {
    container.innerHTML = `
      <div class="section-lab-panel" style="text-align:center;padding:40px 24px;">
        <p style="color:var(--section-muted);margin:0;font-size:1.04rem;">暂无导入文章。</p>
        <p style="color:var(--section-muted);margin:12px 0 0;font-size:0.92rem;">
          前往 <a href="/studio/notion/" style="color:var(--section-blue);">Notion 导入</a>，选择对应分类即可归入此页。
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="section-lab-grid two">
      ${items
        .map((article) => {
          const date = formatDate(article.createdAt);
          return `
            <a class="section-lab-card" href="/notes/article/?id=${article.id}" style="text-decoration:none;color:inherit;">
              <span>${article.category || "项目记录"}</span>
              <strong>${article.title}</strong>
              ${date ? `<p style="font-size:0.82rem;color:var(--section-muted);margin-top:10px;">${date}</p>` : ""}
            </a>
          `;
        })
        .join("")}
    </div>
  `;
}

async function load() {
  try {
    const res = await fetch("/api/notion/articles?public=true");
    const data = await res.json();
    render(res.ok ? data.articles : []);
  } catch {
    render([]);
  }
}

load();
