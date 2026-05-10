const container = document.querySelector("#notion-articles");
const categoryMap = [
  { id: "notes-category-reading", title: "札记一：论文阅读", key: "论文阅读", match: ["论文阅读", "paper", "research", "reading"] },
  { id: "notes-category-model", title: "札记二：模型判断", key: "模型判断", match: ["模型判断", "judgement", "judgment", "model"] },
  { id: "notes-category-deploy", title: "札记三：部署记录", key: "部署记录", match: ["部署记录", "deploy", "deployment", "ops"] },
  { id: "notes-category-design", title: "札记四：页面改版", key: "页面改版", match: ["页面改版", "ui", "页面", "design"] },
  { id: "notes-category-projects", title: "项目：推进记录", key: "项目记录", match: ["项目", "项目记录", "project", "milestone", "roadmap"] },
  { id: "notes-category-others", title: "其余札记", key: "其余札记", match: [] }
];

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

  const groups = categoryMap.map((group) => ({ ...group, items: [] }));

  for (const article of articles) {
    const category = String(article.category || "").toLowerCase();
    const target =
      groups.find((group) => group.match.some((key) => category.includes(key.toLowerCase()))) ||
      groups[groups.length - 1];
    target.items.push(article);
  }

  const visibleGroups = groups.filter((group) => group.items.length > 0);
  if (!visibleGroups.length) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  container.innerHTML = visibleGroups
    .map((group) => `
      <section id="${group.id}" class="section-lab-panel">
        <p class="section-lab-label">${group.key}</p>
        <h2>${group.title}</h2>
        <div class="section-lab-grid two" style="margin-top:18px;">
          ${group.items
            .map((article) => {
              const date = formatDate(article.createdAt);
              return `
                <a class="section-lab-card" href="/notes/article/?id=${article.id}" style="text-decoration:none;color:inherit;">
                  <span>${article.category || "笔记"}</span>
                  <strong>${article.title}</strong>
                  ${date ? `<p style="font-size:0.82rem;color:var(--section-muted);margin-top:10px;">${date}</p>` : ""}
                </a>
              `;
            })
            .join("")}
        </div>
      </section>
    `)
    .join("");
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
