import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const SITE_ROOT = "/var/www/personal-site";

const baseInstruction = [
  "你是网站内容工作台助手。",
  "任务是帮助站点 owner 处理中文网站内容。",
  "输出要尽量克制、自然、可直接粘贴到网页里。",
  "避免 AI 腔、套话、营销话术和空洞总结。",
  "除非用户明确要求，否则优先输出中文。"
].join(" ");

const modeInstructions = {
  rewrite: "把输入内容改写成更自然、更短、更适合网站展示的版本。",
  structure: "把输入内容整理成结构化模块，适合放到网站独立页面里。",
  summarize: "把输入内容压缩成更短的摘要，保留核心信息。"
};

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function resolvePageFile(pagePath) {
  const normalized = String(pagePath || "/").trim();
  if (!normalized.startsWith("/")) {
    throw new Error("pagePath 必须以 / 开头。");
  }

  const clean = normalized.split("?")[0].split("#")[0];
  const parts = clean
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));

  for (const part of parts) {
    if (part === "." || part === ".." || part.includes("\\")) {
      throw new Error("非法页面路径。");
    }
  }

  const target = parts.length === 0
    ? path.resolve(SITE_ROOT, "index.html")
    : path.resolve(SITE_ROOT, ...parts, "index.html");

  if (!target.startsWith(path.resolve(SITE_ROOT))) {
    throw new Error("页面路径越界。");
  }

  return target;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 200_000) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chunks = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string" && content.text.trim()) {
        chunks.push(content.text.trim());
      }
    }
  }
  return chunks.join("\n\n").trim();
}

function extractChatCompletionsText(payload) {
  const choice = payload?.choices?.[0]?.message?.content;
  if (typeof choice === "string") {
    return choice.trim();
  }
  if (Array.isArray(choice)) {
    return choice
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (typeof item?.text === "string") {
          return item.text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

async function callResponsesAPI(payload) {
  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  return { response, result };
}

async function callChatCompletionsAPI({ mode, instruction, content }) {
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: [
            baseInstruction,
            modeInstructions[mode] || modeInstructions.rewrite,
            instruction
          ]
            .filter(Boolean)
            .join(" ")
        },
        {
          role: "user",
          content
        }
      ]
    })
  });
  const result = await response.json();
  return { response, result };
}

async function handleHealth(_req, res) {
  json(res, 200, {
    ok: true,
    configured: Boolean(OPENAI_API_KEY),
    model: OPENAI_MODEL,
    baseUrl: OPENAI_BASE_URL
  });
}

async function handleProcess(req, res) {
  if (!OPENAI_API_KEY) {
    json(res, 503, {
      error: "服务器还没有配置 OPENAI_API_KEY。先把 Key 写到 /etc/berlin2003-ai.env，再重启 berlin2003-ai 服务。"
    });
    return;
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    json(res, 400, { error: "请求体不是合法 JSON。" });
    return;
  }

  const content = String(body.content || "").trim();
  const instruction = String(body.instruction || "").trim();
  const mode = String(body.mode || "rewrite").trim();

  if (!content) {
    json(res, 400, { error: "content 不能为空。" });
    return;
  }

  const developerInstruction = [
    baseInstruction,
    modeInstructions[mode] || modeInstructions.rewrite,
    instruction
  ]
    .filter(Boolean)
    .join(" ");

  const payload = {
    model: OPENAI_MODEL,
    reasoning: { effort: "low" },
    input: [
      {
        role: "developer",
        content: developerInstruction
      },
      {
        role: "user",
        content: content
      }
    ]
  };

  try {
    let { response, result } = await callResponsesAPI(payload);
    let output = "";
    let apiStyle = "responses";

    if (response.ok) {
      output = extractOutputText(result);
    } else if ([400, 404, 405, 422].includes(response.status)) {
      const fallback = await callChatCompletionsAPI({ mode, instruction, content });
      response = fallback.response;
      result = fallback.result;
      apiStyle = "chat.completions";

      if (response.ok) {
        output = extractChatCompletionsText(result);
      }
    }

    if (!response.ok) {
      json(res, response.status, {
        error: result?.error?.message || "上游模型接口请求失败。",
        apiStyle
      });
      return;
    }

    json(res, 200, {
      ok: true,
      model: result.model || OPENAI_MODEL,
      output: output || "没有返回可解析的文本结果。",
      usage: result.usage || null,
      apiStyle
    });
  } catch (error) {
    json(res, 502, {
      error: `请求上游模型接口失败：${error.message}`
    });
  }
}

async function handleSave(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    json(res, 400, { error: "请求体不是合法 JSON。" });
    return;
  }

  const pagePath = String(body.pagePath || "").trim();
  const html = String(body.html || "");

  if (!pagePath) {
    json(res, 400, { error: "pagePath 不能为空。" });
    return;
  }

  if (!html || html.length < 100) {
    json(res, 400, { error: "html 内容无效。" });
    return;
  }

  if (!html.includes("<html") || !html.includes("</html>")) {
    json(res, 400, { error: "html 内容不是完整页面。" });
    return;
  }

  let filePath;
  try {
    filePath = resolvePageFile(pagePath);
  } catch (error) {
    json(res, 400, { error: error.message });
    return;
  }

  try {
    await fs.writeFile(filePath, html, "utf8");
    json(res, 200, {
      ok: true,
      saved: true,
      pagePath
    });
  } catch (error) {
    json(res, 500, {
      error: `写入页面失败：${error.message}`
    });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/api/ai/health") {
    return handleHealth(req, res);
  }

  if (req.method === "POST" && req.url === "/api/ai/process") {
    return handleProcess(req, res);
  }

  if (req.method === "POST" && req.url === "/api/editor/save") {
    return handleSave(req, res);
  }

  json(res, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`berlin2003-ai listening on http://${HOST}:${PORT}`);
});
