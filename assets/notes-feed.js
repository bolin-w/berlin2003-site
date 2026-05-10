const container = document.querySelector("#notion-articles");
const categoryMap = [
  { title: "札记一：论文阅读", key: "论文阅读", match: ["论文阅读", "paper", "research", "reading"] },
  { title: "札记二：模型判断", key: "模型判断", match: ["模型判断", "judgement", "judgment", "model"] },
  { title: "札记三：部署记录", key: "部署记录", match: ["部署记录", "deploy", "deployment", "ops"] },
  { title: "札记四：页面改版", key: "页面改版", match: ["页面改版", "ui", "页面", "design"] },
  { title: "其余札记", key: "其余札记", match: [] }
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

  container.innerHTML = groups
    .filter((group) => group.items.length > 0)
    .map((group) => `
      <section class="section-lab-panel">
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
