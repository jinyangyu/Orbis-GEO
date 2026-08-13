/**
 * Enrich monitoring layers after raw inspection import:
 * - Discover competitor brands from citation domains (+ known map)
 * - Backfill answer_brand_mentions for all workspace brands
 * - Classify citation domain_category
 * - Fill citation_competitors when cited domain matches a brand
 * - Approximate mention position from first occurrence order
 *
 * Usage: node --env-file=.env.local scripts/enrich-monitoring.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { listObservationDays, rebuildMany } from "./lib/rebuild-daily.mjs";

const COLORS = [
  "#3F3D89",
  "#FF8A22",
  "#7CB342",
  "#8D6E32",
  "#D27B7E",
  "#556B2F",
  "#4A90A4",
  "#C4782A",
  "#6B5B95",
  "#2E8B57",
];

/** root domain → display name */
const KNOWN_BRANDS = {
  "zhipin.com": "Boss直聘",
  "zhaopin.com": "智联招聘",
  "51job.com": "前程无忧",
  "lagou.com": "拉勾",
  "liepin.com": "猎聘",
  "maimai.cn": "脉脉",
  "yingjiesheng.com": "应届生求职网",
  "ke.com": "贝壳找房",
  "lianjia.com": "链家",
  "anjuke.com": "安居客",
  "ganji.com": "赶集网",
  "ziroom.com": "自如",
  "5i5j.com": "我爱我家",
  "baixing.com": "百姓网",
  "douban.com": "豆瓣",
  "zhihu.com": "知乎",
  "xiaohongshu.com": "小红书",
  "goofish.com": "闲鱼",
  "taobao.com": "淘宝",
  "indeed.com": "Indeed",
  "reed.co.uk": "Reed",
  "totaljobs.com": "Totaljobs",
  "cv-library.co.uk": "CV-Library",
  "glassdoor.com": "Glassdoor",
  "linkedin.com": "LinkedIn",
  "facebook.com": "Facebook",
  "craigslist.org": "Craigslist",
  "ebay.com": "eBay",
  "gumtree.com": "Gumtree",
  "ok.com": "OK.com",
  "kaoshibao.com": "考试宝",
  "58.com": "58同城",
};

const SKIP_ROOTS = new Set([
  "gov.cn",
  "edu.cn",
  "google.com",
  "bing.com",
  "baidu.com",
  "wikipedia.org",
  "youtube.com",
  "twitter.com",
  "x.com",
  "microsoft.com",
  "apple.com",
  "amazonaws.com",
]);

function databaseUrl() {
  const url = (process.env.DATABASE_URL ?? "").trim();
  if (!url) throw new Error("DATABASE_URL is required");
  return url;
}

function connectionOptions() {
  const parsed = new URL(databaseUrl());
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  };
}

function uuidFromKey(key) {
  const hex = createHash("sha256").update(key).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function normalizeDomain(input) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/:\d+$/, "");
}

function rootDomain(host) {
  const h = normalizeDomain(host);
  if (!h) return "";
  const parts = h.split(".").filter(Boolean);
  if (parts.length <= 2) return h;
  const last2 = parts.slice(-2).join(".");
  if (["com.cn", "co.uk", "com.au", "co.jp", "com.mx"].includes(last2)) {
    return parts.slice(-3).join(".");
  }
  return last2;
}

function brandNameForDomain(domain) {
  const root = rootDomain(domain);
  if (KNOWN_BRANDS[root]) return KNOWN_BRANDS[root];
  if (KNOWN_BRANDS[domain]) return KNOWN_BRANDS[domain];
  const stem = root.split(".")[0] || domain;
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

function classifyDomain(domain, primaryRoot, competitorRoots) {
  const root = rootDomain(domain);
  if (!root) return "其他";
  if (root === primaryRoot || domain.endsWith(`.${primaryRoot}`)) {
    return "自有官网";
  }
  if (competitorRoots.has(root)) return "竞品官网";
  if (
    /\.gov(\.|$)/.test(domain) ||
    root.endsWith(".gov.cn") ||
    domain.includes(".gov.")
  ) {
    return "政府机构";
  }
  if (
    [
      "zhihu.com",
      "douban.com",
      "xiaohongshu.com",
      "reddit.com",
      "tieba.baidu.com",
      "v2ex.com",
    ].includes(root) ||
    domain.includes("reddit.com")
  ) {
    return "社区讨论";
  }
  if (
    [
      "g2.com",
      "capterra.com",
      "producthunt.com",
      "glassdoor.com",
      "trustpilot.com",
    ].includes(root)
  ) {
    return "测评平台";
  }
  if (
    [
      "techcrunch.com",
      "forbes.com",
      "medium.com",
      "36kr.com",
      "sspai.com",
    ].includes(root)
  ) {
    return "行业媒体";
  }
  return "第三方媒体";
}

function mentionedInText(content, brandName, brandDomain) {
  const text = content.toLowerCase();
  const name = brandName.trim().toLowerCase();
  const domain = brandDomain.trim().toLowerCase();
  const root = rootDomain(domain);
  if (name && text.includes(name)) return true;
  if (domain && text.includes(domain)) return true;
  if (root && root !== domain && text.includes(root)) return true;
  const bare = root.split(".")[0];
  if (bare && bare.length >= 3 && !["com", "net", "org", "www"].includes(bare)) {
    // avoid short/generic stems; require word-ish presence for latin
    if (/^[\u4e00-\u9fff]+$/.test(name)) return false;
    if (new RegExp(`(^|[^a-z0-9])${bare}([^a-z0-9]|$)`, "i").test(content)) {
      return true;
    }
  }
  return false;
}

function firstIndex(content, brandName, brandDomain) {
  const lower = content.toLowerCase();
  const candidates = [
    brandName.trim().toLowerCase(),
    brandDomain.trim().toLowerCase(),
    rootDomain(brandDomain),
  ].filter(Boolean);
  let best = -1;
  for (const c of candidates) {
    const i = lower.indexOf(c);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best;
}

async function main() {
  const conn = await mysql.createConnection(connectionOptions());
  const stats = {
    competitorsAdded: 0,
    mentionsUpserted: 0,
    citationsClassified: 0,
    citationCompetitors: 0,
  };

  try {
    // Align join keys across monitoring tables
    for (const table of [
      "answer_observations",
      "answer_brand_mentions",
      "citation_events",
      "citation_competitors",
      "workspace_brands",
      "engines",
      "prompts",
      "workspaces",
    ]) {
      await conn.query(
        `ALTER TABLE ${table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    }

    const [workspaces] = await conn.query(`
      SELECT w.id, w.slug, w.name, COUNT(o.id) AS obs
      FROM workspaces w
      JOIN answer_observations o ON o.workspace_id = w.id
      GROUP BY w.id
      HAVING obs > 0
      ORDER BY obs DESC
    `);

    for (const ws of workspaces) {
      console.log(`\nEnrich workspace ${ws.slug} (${ws.obs} obs)`);

      const [brandRows] = await conn.query(
        `SELECT id, name, domain, role FROM workspace_brands WHERE workspace_id = ?`,
        [ws.id],
      );
      let primary = brandRows.find((b) => b.role === "primary");
      if (!primary) {
        console.warn("  no primary brand, skip");
        continue;
      }
      const primaryRoot = rootDomain(primary.domain);

      const [domainCounts] = await conn.query(
        `
        SELECT ce.domain, SUM(ce.times_cited) AS cites
        FROM citation_events ce
        JOIN answer_observations o ON o.id = ce.observation_id
        WHERE o.workspace_id = ?
        GROUP BY ce.domain
        ORDER BY cites DESC
        LIMIT 80
        `,
        [ws.id],
      );

      const rootCites = new Map();
      for (const row of domainCounts) {
        const root = rootDomain(row.domain);
        if (!root || root === primaryRoot) continue;
        if (SKIP_ROOTS.has(root)) continue;
        if (root.endsWith(".gov.cn") || root.includes("gov.")) continue;
        rootCites.set(root, (rootCites.get(root) ?? 0) + Number(row.cites));
      }

      const existingByDomain = new Map(
        brandRows.map((b) => [rootDomain(b.domain) || b.domain, b]),
      );

      // Ensure known high-signal competitors even if citations are low
      const ensureRoots = new Set(
        [...rootCites.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([root]) => root),
      );
      for (const [root] of Object.entries(KNOWN_BRANDS)) {
        if (root === primaryRoot) continue;
        if (rootCites.has(root) && rootCites.get(root) >= 5) {
          ensureRoots.add(root);
        }
      }

      let sortOrder = brandRows.length;
      for (const root of ensureRoots) {
        if (existingByDomain.has(root)) continue;
        const id = uuidFromKey(`competitor:${ws.id}:${root}`);
        const name = brandNameForDomain(root);
        const color = COLORS[sortOrder % COLORS.length];
        const mark = name.slice(0, 1).toUpperCase();
        await conn.query(
          `INSERT INTO workspace_brands
            (id, workspace_id, name, domain, role, status, detected_from, aliases, market, language, mark, color, sort_order)
           VALUES (?, ?, ?, ?, 'competitor', 'detected', 'citation', JSON_ARRAY(), ?, '', ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name)`,
          [
            id,
            ws.id,
            name.slice(0, 200),
            root,
            primary.market || "",
            mark.slice(0, 8),
            color,
            sortOrder++,
          ],
        );
        existingByDomain.set(root, {
          id,
          name,
          domain: root,
          role: "competitor",
        });
        stats.competitorsAdded += 1;
      }

      const [allBrands] = await conn.query(
        `SELECT id, name, domain, role, status FROM workspace_brands WHERE workspace_id = ?`,
        [ws.id],
      );
      const competitorRoots = new Set(
        allBrands
          .filter((b) => b.role === "competitor" && (b.status ?? "active") === "active")
          .map((b) => rootDomain(b.domain)),
      );

      // Classify citation domains (batch by distinct domain)
      const [distinctDomains] = await conn.query(
        `
        SELECT DISTINCT ce.domain
        FROM citation_events ce
        JOIN answer_observations o ON o.id = ce.observation_id
        WHERE o.workspace_id = ?
        `,
        [ws.id],
      );
      for (const row of distinctDomains) {
        const cat = classifyDomain(row.domain, primaryRoot, competitorRoots);
        const [result] = await conn.query(
          `
          UPDATE citation_events ce
          JOIN answer_observations o ON o.id = ce.observation_id
          SET ce.domain_category = ?
          WHERE o.workspace_id = ? AND ce.domain = ?
          `,
          [cat, ws.id, row.domain],
        );
        stats.citationsClassified += result.affectedRows ?? 0;
      }

      // citation_competitors: cited root matches competitor brand
      await conn.query(
        `
        DELETE cc FROM citation_competitors cc
        JOIN citation_events ce ON ce.id = cc.event_id
        JOIN answer_observations o ON o.id = ce.observation_id
        WHERE o.workspace_id = ?
        `,
        [ws.id],
      );
      for (const brand of allBrands.filter(
        (b) => b.role === "competitor" && (b.status ?? "active") === "active",
      )) {
        const root = rootDomain(brand.domain);
        const [events] = await conn.query(
          `
          SELECT ce.id
          FROM citation_events ce
          JOIN answer_observations o ON o.id = ce.observation_id
          WHERE o.workspace_id = ?
            AND (ce.domain = ? OR ce.domain LIKE ?)
          `,
          [ws.id, root, `%.${root}`],
        );
        for (const ev of events) {
          await conn.query(
            `INSERT IGNORE INTO citation_competitors (event_id, brand_id) VALUES (?, ?)`,
            [ev.id, brand.id],
          );
          stats.citationCompetitors += 1;
        }
      }

      // Mentions for all brands from answer_text
      const [obsRows] = await conn.query(
        `SELECT id, answer_text FROM answer_observations WHERE workspace_id = ?`,
        [ws.id],
      );

      for (const obs of obsRows) {
        const content = obs.answer_text ?? "";
        const hits = [];
        for (const brand of allBrands) {
          const mentioned = mentionedInText(content, brand.name, brand.domain);
          const idx = mentioned
            ? firstIndex(content, brand.name, brand.domain)
            : -1;
          hits.push({ brand, mentioned, idx });
        }
        const ordered = hits
          .filter((h) => h.mentioned && h.idx >= 0)
          .sort((a, b) => a.idx - b.idx);
        const positionMap = new Map();
        ordered.forEach((h, i) => positionMap.set(h.brand.id, i + 1));

        for (const h of hits) {
          await conn.query(
            `INSERT INTO answer_brand_mentions
              (id, observation_id, brand_id, mentioned, position, sentiment)
             VALUES (?, ?, ?, ?, ?, NULL)
             ON DUPLICATE KEY UPDATE
               mentioned = VALUES(mentioned),
               position = VALUES(position)`,
            [
              randomUUID(),
              obs.id,
              h.brand.id,
              h.mentioned ? 1 : 0,
              positionMap.get(h.brand.id) ?? null,
            ],
          );
          stats.mentionsUpserted += 1;
        }
      }

      console.log(
        `  brands=${allBrands.length} competitors=${competitorRoots.size}`,
      );
    }

    console.log("\nRebuilding L3 daily rollups…");
    const pairs = await listObservationDays(conn);
    const dailyStats = await rebuildMany(conn, pairs, (i, n) => {
      if (i % 30 === 0 || i === n) console.log(`  daily ${i}/${n}`);
    });
    console.log("L3 rebuild", dailyStats);

    console.log("\nDone.", stats);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
