const diaryForm = document.querySelector("#life-diary-form");
const diaryTitle = document.querySelector("#diary-title");
const diaryMood = document.querySelector("#diary-mood");
const diaryTags = document.querySelector("#diary-tags");
const diaryContent = document.querySelector("#diary-content");
const diaryList = document.querySelector("#diary-list");
const diaryStatus = document.querySelector("#diary-status");
const diaryCount = document.querySelector("#diary-count");
const diaryReset = document.querySelector("#diary-reset");
const diarySubmit = document.querySelector("#diary-submit");

let diaryItems = [];
let editingId = "";

function setDiaryStatus(text, kind = "") {
  diaryStatus.textContent = text;
  diaryStatus.dataset.kind = kind;
}

async function diaryApi(path, options) {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers || {})
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败。");
  }
  return data;
}

function formatDate(value) {
  if (!value) {
    return "刚刚";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function tagsFromInput(value) {
  return String(value || "")
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function fillForm(item) {
  editingId = item.id;
  diaryTitle.value = item.title || "";
  diaryMood.value = item.mood || "";
  diaryTags.value = (item.tags || []).join(", ");
  diaryContent.value = item.content || "";
  diarySubmit.textContent = "保存修改";
  diaryReset.hidden = false;
  diaryContent.focus();
  setDiaryStatus("正在编辑一条旧记录。", "editing");
}

function resetForm() {
  editingId = "";
  diaryForm.reset();
  diarySubmit.textContent = "记下这一篇";
  diaryReset.hidden = true;
}

function renderDiary() {
  diaryCount.textContent = `${diaryItems.length} entries`;
  diaryList.innerHTML = "";

  if (!diaryItems.length) {
    diaryList.innerHTML = `
      <article class="life-diary-empty">
        <span>Empty diary</span>
        <strong>还没有日记。</strong>
        <p>在上面写下第一条记录，保存后会按时间生成卡片。</p>
      </article>
    `;
    return;
  }

  diaryItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "life-diary-card";

    const meta = document.createElement("div");
    meta.className = "life-diary-card-meta";

    const date = document.createElement("span");
    date.textContent = formatDate(item.createdAt);
    meta.appendChild(date);

    if (item.mood) {
      const mood = document.createElement("span");
      mood.textContent = item.mood;
      meta.appendChild(mood);
    }

    const title = document.createElement("h2");
    title.textContent = item.title || "未命名记录";

    const content = document.createElement("p");
    content.className = "life-diary-card-content";
    content.textContent = item.content || "";

    const tags = document.createElement("div");
    tags.className = "life-diary-card-tags";
    (item.tags || []).forEach((tag) => {
      const chip = document.createElement("span");
      chip.textContent = tag;
      tags.appendChild(chip);
    });

    const actions = document.createElement("div");
    actions.className = "life-diary-card-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "编辑";
    edit.addEventListener("click", () => fillForm(item));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "删除";
    remove.addEventListener("click", async () => {
      const ok = confirm("确定删除这条日记吗？");
      if (!ok) {
        return;
      }
      await diaryApi(`/api/editor/diary/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      await loadDiary();
      if (editingId === item.id) {
        resetForm();
      }
      setDiaryStatus("已删除一条记录。", "ok");
    });

    actions.append(edit, remove);
    card.append(meta, title, content);
    if (item.tags?.length) {
      card.appendChild(tags);
    }
    card.appendChild(actions);
    diaryList.appendChild(card);
  });
}

async function loadDiary() {
  setDiaryStatus("正在读取日记...");
  const data = await diaryApi("/api/editor/diary");
  diaryItems = data.items || [];
  renderDiary();
  setDiaryStatus("日记已同步。", "ok");
}

diaryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    title: diaryTitle.value,
    mood: diaryMood.value,
    tags: tagsFromInput(diaryTags.value),
    content: diaryContent.value
  };

  setDiaryStatus(editingId ? "正在保存修改..." : "正在保存新日记...");
  if (editingId) {
    await diaryApi(`/api/editor/diary/${encodeURIComponent(editingId)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  } else {
    await diaryApi("/api/editor/diary", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  resetForm();
  await loadDiary();
  setDiaryStatus("已保存。", "ok");
});

diaryReset.addEventListener("click", () => {
  resetForm();
  setDiaryStatus("已退出编辑模式。");
});

loadDiary().catch((error) => {
  setDiaryStatus(error.message, "warn");
});
