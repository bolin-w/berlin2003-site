import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { Pool, QueryResultRow } from "pg";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8788);
const databaseUrl = process.env.DATABASE_URL;
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || "https://berlin2003.ccwu.cc").replace(/\/+$/, "");
const mediaRoot = process.env.MEDIA_ROOT || "/var/lib/berlin2003-anime/videos";
const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES || 1_500_000_000);
const execFileAsync = promisify(execFile);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 6,
  idleTimeoutMillis: 30_000
});

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info"
  },
  bodyLimit: 4_000_000
});

app.register(multipart, {
  limits: {
    fileSize: maxUploadBytes,
    files: 1,
    fields: 16
  }
});

type JsonRecord = Record<string, unknown>;

function cleanText(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function nullableText(value: unknown, max = 4000): string | null {
  const text = cleanText(value, max);
  return text ? text : null;
}

function parseDurationSeconds(value: unknown): number | null {
  const text = cleanText(value, 40);
  if (!text) {
    return null;
  }
  const parsed = Math.round(Number(text));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function sendError(reply: FastifyReply, status: number, message: string) {
  return reply.status(status).send({ error: message });
}

function slugify(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);

  return normalized || `video-${Date.now()}`;
}

function safeStoredName(fileId: number, originalName: string) {
  const ext = path.extname(originalName).toLowerCase() || ".mp4";
  return `${fileId}${ext}`;
}

async function probeDurationSeconds(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath
    ]);
    return parseDurationSeconds(stdout);
  } catch {
    return null;
  }
}

function serializeVideo(row: QueryResultRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    originalFilename: row.original_filename,
    mediaUrl: row.media_url,
    posterUrl: row.poster_url,
    sizeBytes: Number(row.size_bytes || 0),
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    isPublished: Boolean(row.is_published),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS local_videos (
      id BIGSERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL,
      media_url TEXT NOT NULL,
      poster_url TEXT,
      size_bytes BIGINT NOT NULL DEFAULT 0,
      duration_seconds INTEGER,
      is_published BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS local_videos_published_idx ON local_videos(is_published, updated_at DESC);
  `);

  await fs.mkdir(mediaRoot, { recursive: true });
}

app.get("/api/anime/health", async () => {
  await pool.query("SELECT 1");
  return {
    ok: true,
    service: "berlin2003-video-store",
    mediaRoot,
    maxUploadBytes
  };
});

app.get("/api/anime/videos", async () => {
  const result = await pool.query(
    `
      SELECT *
      FROM local_videos
      WHERE is_published = true
      ORDER BY updated_at DESC
      LIMIT 100
    `
  );

  return { items: result.rows.map(serializeVideo) };
});

app.get("/api/anime/videos/:slug", async (request: FastifyRequest<{ Params: { slug: string } }>, reply) => {
  const result = await pool.query(
    "SELECT * FROM local_videos WHERE slug = $1 AND is_published = true",
    [cleanText(request.params.slug, 120)]
  );

  if (!result.rowCount) {
    return sendError(reply, 404, "视频不存在或未发布。");
  }

  return { item: serializeVideo(result.rows[0]) };
});

app.get("/api/admin/anime/health", async () => {
  const db = await pool.query("SELECT now() AS now");
  return {
    ok: true,
    service: "berlin2003-video-store",
    databaseTime: db.rows[0].now,
    mediaRoot,
    maxUploadBytes
  };
});

app.get("/api/admin/anime/videos", async () => {
  const result = await pool.query(
    `
      SELECT *
      FROM local_videos
      ORDER BY updated_at DESC
      LIMIT 100
    `
  );

  return { items: result.rows.map(serializeVideo) };
});

app.post("/api/admin/anime/videos", async (request, reply) => {
  const parts = request.parts();
  const fields: Record<string, string> = {};
  let uploaded:
    | {
        filename: string;
        mimetype: string;
        tempPath: string;
        bytes: number;
      }
    | null = null;

  await fs.mkdir(mediaRoot, { recursive: true });
  const tempPath = path.join(mediaRoot, `.upload-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  try {
    for await (const part of parts) {
      if (part.type === "file") {
        if (uploaded) {
          return sendError(reply, 400, "一次只能上传一个视频文件。");
        }
        if (!/\.mp4$/i.test(part.filename)) {
          return sendError(reply, 400, "网站只接受 MP4。MKV 请先用本地脚本转成已压字幕 MP4。");
        }
        await pipeline(part.file, createWriteStream(tempPath));
        const stat = await fs.stat(tempPath);
        uploaded = {
          filename: part.filename || "video.mp4",
          mimetype: part.mimetype,
          tempPath,
          bytes: stat.size
        };
      } else {
        fields[part.fieldname] = cleanText(part.value, 4000);
      }
    }

    if (!uploaded) {
      return sendError(reply, 400, "请上传视频文件。");
    }

    const title = cleanText(fields.title || path.basename(uploaded.filename, path.extname(uploaded.filename)), 180);
    if (!title) {
      return sendError(reply, 400, "标题不能为空。");
    }

    const baseSlug = slugify(fields.slug || title);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let slug = baseSlug;
      for (let i = 2; i < 200; i += 1) {
        const exists = await client.query("SELECT 1 FROM local_videos WHERE slug = $1", [slug]);
        if (!exists.rowCount) {
          break;
        }
        slug = `${baseSlug}-${i}`;
      }

      const inserted = await client.query(
        `
          INSERT INTO local_videos(
            slug, title, description, original_filename,
            stored_filename, media_url, poster_url, size_bytes, duration_seconds, is_published
          )
          VALUES ($1, $2, $3, $4, '', '', $5, $6, $7, $8)
          RETURNING *
        `,
        [
          slug,
          title,
          nullableText(fields.description),
          uploaded.filename,
          nullableText(fields.posterUrl, 1000),
          uploaded.bytes,
          parseDurationSeconds(fields.durationSeconds),
          fields.isPublished !== "false"
        ]
      );

      const id = Number(inserted.rows[0].id);
      const storedFilename = safeStoredName(id, uploaded.filename);
      const finalPath = path.join(mediaRoot, storedFilename);
      await fs.rename(uploaded.tempPath, finalPath);
      uploaded = null;

      const mediaUrl = `/media/anime/${storedFilename}`;
      const updated = await client.query(
        `
          UPDATE local_videos
          SET stored_filename = $2, media_url = $3, updated_at = now()
          WHERE id = $1
          RETURNING *
        `,
        [id, storedFilename, mediaUrl]
      );

      await client.query("COMMIT");
      return reply.status(201).send({ item: serializeVideo(updated.rows[0]) });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (uploaded) {
      await fs.rm(uploaded.tempPath, { force: true }).catch(() => {});
    }
  }
});

app.patch("/api/admin/anime/videos/:id", async (request: FastifyRequest<{ Params: { id: string }; Body: JsonRecord }>, reply) => {
  const id = Number(request.params.id);
  if (!Number.isFinite(id)) {
    return sendError(reply, 400, "视频 ID 非法。");
  }

  const existing = await pool.query("SELECT * FROM local_videos WHERE id = $1", [id]);
  if (!existing.rowCount) {
    return sendError(reply, 404, "视频不存在。");
  }

  const row = existing.rows[0];
  const result = await pool.query(
    `
      UPDATE local_videos
      SET
        title = $2,
        description = $3,
        poster_url = $4,
        is_published = $5,
        updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      request.body.title === undefined ? row.title : cleanText(request.body.title, 180),
      request.body.description === undefined ? row.description : nullableText(request.body.description),
      request.body.posterUrl === undefined ? row.poster_url : nullableText(request.body.posterUrl, 1000),
      request.body.isPublished === undefined ? row.is_published : Boolean(request.body.isPublished)
    ]
  );

  return { item: serializeVideo(result.rows[0]) };
});

app.post("/api/admin/anime/videos/:id/duration", async (request: FastifyRequest<{ Params: { id: string }; Body: JsonRecord }>, reply) => {
  const id = Number(request.params.id);
  if (!Number.isFinite(id)) {
    return sendError(reply, 400, "视频 ID 非法。");
  }

  const existing = await pool.query("SELECT * FROM local_videos WHERE id = $1", [id]);
  if (!existing.rowCount) {
    return sendError(reply, 404, "视频不存在。");
  }

  const row = existing.rows[0];
  let durationSeconds = parseDurationSeconds(request.body.durationSeconds);
  if (durationSeconds === null) {
    durationSeconds = await probeDurationSeconds(path.join(mediaRoot, row.stored_filename));
  }
  if (durationSeconds === null) {
    return sendError(reply, 400, "这次没能读出时长。");
  }

  const result = await pool.query(
    `
      UPDATE local_videos
      SET duration_seconds = $2, updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [id, durationSeconds]
  );

  return { item: serializeVideo(result.rows[0]) };
});

app.delete("/api/admin/anime/videos/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const id = Number(request.params.id);
  if (!Number.isFinite(id)) {
    return sendError(reply, 400, "视频 ID 非法。");
  }

  const result = await pool.query("DELETE FROM local_videos WHERE id = $1 RETURNING *", [id]);
  if (!result.rowCount) {
    return sendError(reply, 404, "视频不存在。");
  }

  await fs.rm(path.join(mediaRoot, result.rows[0].stored_filename), { force: true }).catch(() => {});
  return { ok: true };
});

app.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    error: "Not found",
    path: request.url
  });
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  reply.status(500).send({ error: "服务内部错误。" });
});

async function main() {
  await migrate();
  await app.listen({ host, port });
}

process.on("SIGINT", async () => {
  await app.close();
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await app.close();
  await pool.end();
  process.exit(0);
});

main().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
