import { PDF_COLORS } from "./tokens";

/** Global CSS injected into document.head during export (survives html2pdf clone). */
export function buildReportCss(landscape: boolean): string {
  const pageW = landscape ? "297mm" : "210mm";
  const pageH = landscape ? "210mm" : "297mm";
  const c = PDF_COLORS;

  return `
.orbis-rp, .orbis-rp * { box-sizing: border-box; }
.orbis-rp {
  width: ${pageW};
  height: ${pageH};
  min-height: ${pageH};
  max-height: ${pageH};
  padding: 14mm 14mm 16mm;
  position: relative;
  background: ${c.white};
  color: ${c.ink};
  font-family: "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
    "Source Han Sans SC", sans-serif;
  font-size: 11px;
  line-height: 1.45;
  overflow: hidden;
}
.orbis-rp.cover, .orbis-rp.end {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 18mm 16mm;
  background-color: ${c.white};
  background-image: radial-gradient(${c.line} 1px, transparent 1px);
  background-size: 14px 14px;
}
.orbis-rp h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 10px;
  letter-spacing: -0.02em;
  color: ${c.ink};
}
.orbis-rp h2 {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 6px;
  color: ${c.ink};
}
.orbis-rp h3 {
  font-size: 13px;
  font-weight: 700;
  margin: 0 0 8px;
  color: ${c.ink};
}
.orbis-rp .lead {
  color: ${c.muted};
  font-size: 11px;
  line-height: 1.55;
  margin: 0 0 14px;
  max-width: 95%;
}
.orbis-rp .muted { color: ${c.muted}; font-size: 12px; }
.orbis-rp .soft { color: ${c.soft}; font-size: 10px; }

.orbis-rp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid ${c.line};
}
.orbis-rp-header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: ${c.ink};
  min-width: 0;
}
.orbis-rp-header-brand img {
  height: 22px;
  max-width: 80px;
  object-fit: contain;
}
.orbis-rp-header-brand .mark {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  background: ${c.ink};
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.orbis-rp-header-meta {
  color: ${c.soft};
  font-size: 10px;
  white-space: nowrap;
}

.orbis-rp-foot {
  position: absolute;
  right: 14mm;
  bottom: 8mm;
  color: ${c.soft};
  font-size: 9px;
}

.orbis-rp .wordmark {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 28px;
  letter-spacing: 0.01em;
}
.orbis-rp .wordmark em {
  color: ${c.accent};
  font-style: normal;
}
.orbis-rp .cover-logo {
  max-height: 44px;
  margin-bottom: 18px;
}
.orbis-rp .divider {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 72%;
  margin: 28px auto 16px;
  color: ${c.soft};
  font-size: 10px;
}
.orbis-rp .divider:before,
.orbis-rp .divider:after {
  content: "";
  flex: 1;
  height: 1px;
  background: ${c.line};
}
.orbis-rp .pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  max-width: 420px;
}
.orbis-rp .pill {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 12px;
  background: ${c.white};
  color: ${c.ink};
}

.orbis-rp .chart-card {
  border: 1px solid ${c.line};
  border-radius: 10px;
  padding: 10px 12px 8px;
  background: ${c.white};
  margin-bottom: 14px;
}
.orbis-rp .chart-card svg { display: block; width: 100%; height: auto; }
.orbis-rp .legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 8px;
  padding-top: 6px;
}
.orbis-rp .legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: ${c.ink};
}
.orbis-rp .legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex: none;
}

.orbis-rp .dual {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 4px;
}
.orbis-rp .list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid #f1f3f5;
  font-size: 11px;
}
.orbis-rp .list-row:last-child { border-bottom: 0; }
.orbis-rp .list-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.orbis-rp .list-left span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.orbis-rp .list-val { font-weight: 600; color: ${c.ink}; flex: none; }
.orbis-rp .dot {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  flex: none;
}

.orbis-rp table.rp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.orbis-rp table.rp-table th,
.orbis-rp table.rp-table td {
  padding: 9px 10px;
  border-bottom: 1px solid #eef0f3;
  text-align: left;
  vertical-align: middle;
}
.orbis-rp table.rp-table th {
  background: ${c.softBg};
  color: ${c.muted};
  font-weight: 600;
  font-size: 10px;
}
.orbis-rp table.rp-table tr.primary { background: #fafbff; }
.orbis-rp table.rp-table td.url {
  max-width: 280px;
  word-break: break-all;
  font-size: 10px;
}
.orbis-rp .name-cell {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.orbis-rp .sent-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${c.sentimentBg};
  color: ${c.sentimentFg};
  font-size: 10px;
  font-weight: 600;
}

.orbis-rp .kpi-line {
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 10px;
  color: ${c.ink};
}
.orbis-rp .kpi-line em {
  font-style: normal;
  color: ${c.accent};
}
.orbis-rp .top-urls {
  margin-top: 14px;
}
.orbis-rp .top-urls .list-row a,
.orbis-rp .top-urls .url-pink {
  color: ${c.link};
  text-decoration: none;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 85%;
}

.orbis-rp .bar-row {
  display: grid;
  grid-template-columns: 110px 1fr 42px;
  gap: 8px;
  align-items: center;
  margin-bottom: 7px;
  font-size: 10px;
}
.orbis-rp .bar-track {
  height: 8px;
  border-radius: 4px;
  background: #f1f3f5;
  overflow: hidden;
}
.orbis-rp .bar-fill {
  height: 100%;
  border-radius: 4px;
}
.orbis-rp .bar-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${c.ink};
}
.orbis-rp .bar-val { text-align: right; color: ${c.muted}; }

.orbis-rp .end .wordmark { margin-bottom: 18px; }
.orbis-rp .end h1 { margin-top: 8px; }
`.trim();
}
