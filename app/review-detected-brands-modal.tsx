"use client";

import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "./dashboard/brand-logo";
import {
  acceptDetected,
  dismissDetected,
  fetchDetectedBrands,
} from "@/lib/brands/client";
import type { BrandRowView } from "@/lib/brands/service";

export default function ReviewDetectedBrandsModal({
  open,
  workspaceId,
  onClose,
  onOpenSettings,
  onChanged,
  notify,
}: {
  open: boolean;
  workspaceId: string | null;
  onClose: () => void;
  onOpenSettings: (tab: "details" | "competitors") => void;
  onChanged?: () => void;
  notify: (s: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BrandRowView[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [loading, setLoading] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await fetchDetectedBrands(workspaceId, page, 8);
      setItems(data.items);
      setTotal(data.total);
      setPageSize(data.pageSize);
    } catch (e) {
      notify(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, page, notify]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) {
      setPage(1);
      setMenuId(null);
    }
  }, [open]);

  if (!open) return null;

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="detected-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detected-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detected-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="detected-modal-head">
          <h2 id="detected-title">审核已发现品牌</h2>
          <button type="button" className="detected-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <p className="detected-lead">
          我们发现了尚未加入配置的品牌。可将它们加为竞品，或忽略。也可前往品牌详情 / 竞品设置进一步管理。
        </p>

        <div className="detected-list">
          {loading && <div className="detected-empty">加载中…</div>}
          {!loading && items.length === 0 && (
            <div className="detected-empty">暂无新发现品牌</div>
          )}
          {!loading &&
            items.map((b) => (
              <div className="detected-row" key={b.id}>
                <i>
                  <BrandLogo
                    className="detected-brand-logo"
                    domain={b.domain}
                    name={b.name}
                  />
                </i>
                <div>
                  <b>{b.name}</b>
                  <span>{b.domain}</span>
                </div>
                <div className="detected-menu-wrap">
                  <button
                    type="button"
                    className="detected-menu-btn"
                    aria-label="操作"
                    onClick={() => setMenuId(menuId === b.id ? null : b.id)}
                  >
                    ⋯
                  </button>
                  {menuId === b.id ? (
                    <div className="detected-menu">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await acceptDetected(b.id);
                            notify(`已将「${b.name}」加入竞品`);
                            setMenuId(null);
                            onChanged?.();
                            await load();
                          } catch (e) {
                            notify(e instanceof Error ? e.message : "失败");
                          }
                        }}
                      >
                        加为竞品
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await dismissDetected(b.id);
                            notify(`已忽略「${b.name}」`);
                            setMenuId(null);
                            await load();
                          } catch (e) {
                            notify(e instanceof Error ? e.message : "失败");
                          }
                        }}
                      >
                        忽略
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
        </div>

        <div className="detected-pager">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .slice(0, 6)
            .map((n) => (
              <button
                key={n}
                type="button"
                className={n === page ? "active" : ""}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            ›
          </button>
        </div>

        <div className="detected-footer">
          <h3>更多设置与管理</h3>
          <button
            type="button"
            className="detected-link-btn"
            onClick={() => {
              onClose();
              onOpenSettings("details");
            }}
          >
            品牌详情
          </button>
          <button
            type="button"
            className="detected-link-btn"
            onClick={() => {
              onClose();
              onOpenSettings("competitors");
            }}
          >
            竞品
          </button>
        </div>
      </div>
    </div>
  );
}
