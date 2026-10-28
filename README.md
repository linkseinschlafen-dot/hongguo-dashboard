# 红果漫剧看板

公开静态看板（GitHub Pages），供微信等场景无登录查看。

线上地址：<https://linkseinschlafen-dot.github.io/hongguo-dashboard/>

## 如何更新数字

改看板不需要 AI，也不要手改 `site/index.html`。

1. 编辑 `data/latest.json`。播放、收藏、点击率、剧目表、快照对比、续看率、页脚说明和 `generatedAt` 都在这个文件里。
2. 提交并推送到 `main`。
3. GitHub Actions（`.github/workflows/pages.yml`）检出代码后执行 `node scripts/build-site.mjs`，用 JSON 生成 `site/index.html`，再上传 `site` 并部署 Pages。

只改 JSON 并推送，线上数字就会更新。构建是普通 Node 脚本，没有 npm 依赖，也不调用大模型。

本地先看效果：

```bash
node scripts/build-site.mjs
```

然后打开 `site/index.html`。仓库里保留一份与该命令输出一致的 `site/index.html`；线上始终以 Actions 当场生成的页面为准，所以即使忘了在本地重建，推送 JSON 也会更新公开页。

## `data/latest.json` 结构

页面按字段值原样显示，请自己写好千分位和百分号（例如 `16,378`、`6.56%`）。中文写在字段值里，脚本会做 HTML 转义。

- `title`：页面标题。
- `accountName`：账号名。`asOf` 是数据截止日期，`asOfNote` 是日期后的说明，`refreshNote` 是副标题末句。
- `banner`：顶部提示条全文。
- `metrics`：四个头条指标 `plays7d`、`playsDay`、`favorites`、`ctr`。每项含 `value`、`label`、`subtitle`。`warn: true` 时数字用提醒色（当前是当日播放）。
- `headings`：四个板块标题。
- `dramaColumns`：在播漫剧表的 8 列表头，顺序对应 `dramas[]` 的 `title`、`launched`、`plays7d`、`playsDay`、`favorites`、`ctr`、`revenue`、`status`。
- `archive`：剧目档案，每项 `label` + `value`。
- `snapshots.columns`：对比表 4 列表头（含两期日期）。`snapshots.rows[]` 为 `metric`、`prev`、`current`、`delta`。
- `retention.bars[]`：续看条。`label` 是集数，`width` 是 0–100 的条长，`text` 是右侧文案。`retention.note` 是该板块底部说明。
- `footerNotes`：页脚说明（字符串数组，用间隔号连接）。`generatedAt` 是页面生成日期，`timezone` 写 `Asia/Shanghai`。
