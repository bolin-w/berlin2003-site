const container = document.querySelector("#project-articles");
if (!container) throw new Error("missing #project-articles");

const categoryKey = (container.dataset.category || "").trim();
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render(articles) {
  const items = (articles || []).filter((a) => {
    if (categoryKey && a.module === "项目" && a.category === categoryKey) {
      return true;
    }

    if (categoryKey && a.module === "项目") {
      return false;
    }

    const haystack = [
      a.category,
      a.title,
      a.summary,
      a.description,
      ...(Array.isArray(a.tags) ? a.tags : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchKeys.some((key) => haystack.includes(key));
  });

  const countEl = document.querySelector("#project-count");
  if (countEl) countEl.textContent = items.length + " 篇";

  if (!items.length) {
    container.innerHTML = `
      <div class="hx-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 5h16v14H4z"></path>
          <path d="M8 9h8M8 13h5"></path>
        </svg>
        <h3>暂无导入文章</h3>
        <p>前往 <a href="/studio/notion/">Notion 导入</a>，选择对应分类即可归入此页。</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="hx-articles-grid">
      ${items
        .map((article) => {
          const date = formatDate(article.createdAt);
          const tags = Array.isArray(article.tags) ? article.tags.slice(0, 4) : [];
          const summary = article.summary || article.description || "";
          return `
            <a class="hx-article-card" href="/notes/article/?id=${encodeURIComponent(article.id)}">
              <div class="hx-article-meta">
                ${date ? `<span class="hx-article-date">${escapeHtml(date)}</span>` : ""}
                <span class="hx-article-cat">${escapeHtml(article.category || "项目记录")}</span>
              </div>
              <h3>${escapeHtml(article.title || "未命名文章")}</h3>
              ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
              ${tags.length ? `<div class="hx-article-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
            </a>
          `;
        })
        .join("")}
    </div>
  `;
}

async function load() {
  try {
    const query = categoryKey
      ? `/api/notion/articles?public=true&module=${encodeURIComponent("项目")}&category=${encodeURIComponent(categoryKey)}`
      : "/api/notion/articles?public=true";
    const res = await fetch(query);
    const data = await res.json();
    render(res.ok ? data.articles : []);
  } catch {
    render([]);
  }
}

load();
