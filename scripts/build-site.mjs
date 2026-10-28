#!/usr/bin/env node
/**
 * Generate site/index.html from data/latest.json.
 * Node built-ins only; no network and no model calls.
 */
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "data", "latest.json");
const outPath = join(root, "site", "index.html");

const METRICS = [
  ["plays7d", "mPlays7d"],
  ["playsDay", "mPlaysDay"],
  ["favorites", "mFav"],
  ["ctr", "mCtr"],
];

const DRAMA_FIELDS = [
  "title",
  "launched",
  "plays7d",
  "playsDay",
  "favorites",
  "ctr",
  "revenue",
  "status",
];

const CSS = `
    :root {
      --bg: #f6f7f9;
      --card: #fff;
      --text: #1a1a1a;
      --muted: #6b7280;
      --line: #e5e7eb;
      --warn: #b45309;
      --warn-bg: #fff7ed;
      --accent: #2563eb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB",
        "Microsoft YaHei", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 16px 16px 40px;
    }
    .wrap { max-width: 960px; margin: 0 auto; }
    h1 { font-size: 1.35rem; margin: 0 0 4px; }
    .sub { color: var(--muted); font-size: 0.875rem; margin-bottom: 16px; }
    .banner {
      background: var(--warn-bg);
      color: var(--warn);
      border: 1px solid #fed7aa;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 0.9rem;
      margin-bottom: 16px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    @media (min-width: 640px) {
      .metrics { grid-template-columns: repeat(4, 1fr); }
    }
    .metric {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
    }
    .metric .v { font-size: 1.35rem; font-weight: 650; letter-spacing: -0.02em; }
    .metric .l { font-size: 0.75rem; color: var(--muted); margin-top: 2px; }
    .metric .d { font-size: 0.7rem; color: var(--muted); margin-top: 4px; }
    .metric.warn .v { color: var(--warn); }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 14px;
      overflow-x: auto;
    }
    .card h2 {
      font-size: 0.95rem;
      margin: 0 0 10px;
      font-weight: 650;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      min-width: 560px;
    }
    th, td {
      text-align: left;
      padding: 8px 6px;
      border-bottom: 1px solid var(--line);
      white-space: nowrap;
    }
    th { color: var(--muted); font-weight: 500; font-size: 0.75rem; }
    td.num, th.num { text-align: right; }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--warn-bg);
      color: var(--warn);
      font-size: 0.75rem;
    }
    .props { font-size: 0.875rem; }
    .props dt {
      color: var(--muted);
      font-size: 0.75rem;
      margin-top: 8px;
    }
    .props dd { margin: 0; }
    .bars { display: flex; flex-direction: column; gap: 10px; }
    .bar-row { display: grid; grid-template-columns: 72px 1fr 64px; gap: 8px; align-items: center; font-size: 0.8rem; }
    .bar-track { height: 10px; background: #eef2ff; border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--accent); border-radius: 999px; }
    .foot {
      color: var(--muted);
      font-size: 0.75rem;
      margin-top: 8px;
    }
`;

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fail(path) {
  throw new Error(`data/latest.json 缺少或为空：${path}`);
}

function must(value, path) {
  if (value == null || value === "") fail(path);
  return value;
}

function mustObject(value, path) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) fail(path);
  return value;
}

function mustArray(value, path, size) {
  if (!Array.isArray(value) || value.length === 0) fail(path);
  if (size != null && value.length !== size) {
    throw new Error(`data/latest.json 的 ${path} 需要 ${size} 项，实际为 ${value.length}`);
  }
  return value;
}

function htmlText(value, path) {
  return escapeHtml(must(value, path));
}

function barWidth(value, path) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`data/latest.json 的 ${path} 必须是 0 到 100 的数字，实际为 ${JSON.stringify(value)}`);
  }
  return String(n);
}

function renderMetrics(metrics) {
  const source = mustObject(metrics, "metrics");
  return METRICS.map(([key, id]) => {
    const item = mustObject(source[key], `metrics.${key}`);
    if ("warn" in item && typeof item.warn !== "boolean") {
      throw new Error(`data/latest.json 的 metrics.${key}.warn 必须是布尔值`);
    }
    const warn = item.warn === true ? " warn" : "";
    return `      <div class="metric${warn}">
        <div class="v" id="${id}">${htmlText(item.value, `metrics.${key}.value`)}</div>
        <div class="l">${htmlText(item.label, `metrics.${key}.label`)}</div>
        <div class="d">${htmlText(item.subtitle, `metrics.${key}.subtitle`)}</div>
      </div>`;
  }).join("\n");
}

function renderDramas(data) {
  const columns = mustArray(data.dramaColumns, "dramaColumns", DRAMA_FIELDS.length);
  const dramas = mustArray(data.dramas, "dramas");
  const head = columns
    .map((column, index) => {
      const numeric = index >= 2 && index <= 6;
      const cls = numeric ? ' class="num"' : "";
      return `<th${cls}>${htmlText(column, `dramaColumns[${index}]`)}</th>`;
    })
    .join("\n            ");
  const rows = dramas
    .map((row, rowIndex) => {
      const item = mustObject(row, `dramas[${rowIndex}]`);
      const cells = DRAMA_FIELDS.map((field, index) => {
        const value = htmlText(item[field], `dramas[${rowIndex}].${field}`);
        if (field === "status") return `<td><span class="pill">${value}</span></td>`;
        if (index >= 2 && index <= 6) return `<td class="num">${value}</td>`;
        return `<td>${value}</td>`;
      });
      return `          <tr>
            ${cells.join("\n            ")}
          </tr>`;
    })
    .join("\n");
  return { head, rows };
}

function renderArchive(archive) {
  return mustArray(archive, "archive")
    .map((item, index) => {
      const row = mustObject(item, `archive[${index}]`);
      return `        <dt>${htmlText(row.label, `archive[${index}].label`)}</dt><dd>${htmlText(row.value, `archive[${index}].value`)}</dd>`;
    })
    .join("\n");
}

function renderSnapshots(snapshots) {
  const source = mustObject(snapshots, "snapshots");
  const columns = mustArray(source.columns, "snapshots.columns", 4);
  const rows = mustArray(source.rows, "snapshots.rows");
  const head = columns
    .map((column, index) => {
      const cls = index === 0 ? "" : ' class="num"';
      return `<th${cls}>${htmlText(column, `snapshots.columns[${index}]`)}</th>`;
    })
    .join("\n            ");
  const body = rows
    .map((row, index) => {
      const item = mustObject(row, `snapshots.rows[${index}]`);
      return `          <tr><td>${htmlText(item.metric, `snapshots.rows[${index}].metric`)}</td><td class="num">${htmlText(item.prev, `snapshots.rows[${index}].prev`)}</td><td class="num">${htmlText(item.current, `snapshots.rows[${index}].current`)}</td><td class="num">${htmlText(item.delta, `snapshots.rows[${index}].delta`)}</td></tr>`;
    })
    .join("\n");
  return { head, body };
}

function renderBars(retention) {
  return mustArray(retention.bars, "retention.bars")
    .map((bar, index) => {
      const item = mustObject(bar, `retention.bars[${index}]`);
      const width = barWidth(item.width, `retention.bars[${index}].width`);
      return `        <div class="bar-row">
          <span>${htmlText(item.label, `retention.bars[${index}].label`)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <span>${htmlText(item.text, `retention.bars[${index}].text`)}</span>
        </div>`;
    })
    .join("\n");
}

export function renderDashboard(data) {
  const source = mustObject(data, "(root)");
  const headings = mustObject(source.headings, "headings");
  const retention = mustObject(source.retention, "retention");
  const footerNotes = mustArray(source.footerNotes, "footerNotes");
  const dramas = renderDramas(source);
  const snapshots = renderSnapshots(source.snapshots);
  const footer = footerNotes.map((note, index) => htmlText(note, `footerNotes[${index}]`)).join(" · ");
  const title = htmlText(source.title, "title");

  return `<!DOCTYPE html>
<!-- 由 scripts/build-site.mjs 根据 data/latest.json 生成。请改 JSON，不要手改本文件。 -->
<html lang="zh-Hans">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex" />
  <title>${title}</title>
  <style>${CSS}  </style>
</head>
<body>
  <div class="wrap">
    <h1>${title}</h1>
    <p class="sub">账号「${htmlText(source.accountName, "accountName")}」· 数据更新至 <strong id="asOf">${htmlText(source.asOf, "asOf")}</strong>（${htmlText(source.asOfNote, "asOfNote")}）· ${htmlText(source.refreshNote, "refreshNote")}</p>

    <div class="banner" id="banner">
      ${htmlText(source.banner, "banner")}
    </div>

    <div class="metrics">
${renderMetrics(source.metrics)}
    </div>

    <div class="card">
      <h2>${htmlText(headings.dramas, "headings.dramas")}</h2>
      <table>
        <thead>
          <tr>
            ${dramas.head}
          </tr>
        </thead>
        <tbody id="dramaRows">
${dramas.rows}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>${htmlText(headings.archive, "headings.archive")}</h2>
      <dl class="props">
${renderArchive(source.archive)}
      </dl>
    </div>

    <div class="card">
      <h2>${htmlText(headings.snapshots, "headings.snapshots")}</h2>
      <table>
        <thead>
          <tr>
            ${snapshots.head}
          </tr>
        </thead>
        <tbody>
${snapshots.body}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>${htmlText(headings.retention, "headings.retention")}</h2>
      <div class="bars">
${renderBars(retention)}
      </div>
      <p class="foot">${htmlText(retention.note, "retention.note")}</p>
    </div>

    <p class="foot">${footer} · 页面生成时间 <span id="generatedAt">${htmlText(source.generatedAt, "generatedAt")}</span>（${htmlText(source.timezone, "timezone")}）</p>
  </div>
</body>
</html>
`;
}

export function loadDashboardData() {
  let raw;
  try {
    raw = readFileSync(dataPath, "utf8");
  } catch (err) {
    throw new Error(`无法读取 data/latest.json：${err.message}`);
  }
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`data/latest.json 不是合法 JSON：${err.message}`);
  }
}

function main() {
  const data = loadDashboardData();
  const html = renderDashboard(data);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  console.log(`已生成 ${outPath}（asOf ${data.asOf}，近7天播放 ${data.metrics?.plays7d?.value}）`);
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
}

if (isDirectRun()) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}
