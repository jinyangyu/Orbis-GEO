"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchNotifications,
  markNotificationsReadClient,
} from "@/lib/notifications/client";
import type { NotificationView } from "@/lib/notifications/types";

type Props = {
  workspaceId: string | null;
  refreshToken?: number;
  onOpenRecommendations?: () => void;
};

export function NotificationBell({
  workspaceId,
  refreshToken = 0,
  onOpenRecommendations,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void fetchNotifications(workspaceId, 20)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setUnread(data.unread);
      })
      .catch(() => {
        /* migration / offline: keep silent */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, refreshToken]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const markVisibleRead = async () => {
    const unreadIds = items.filter((i) => !i.read).map((i) => i.id);
    if (!unreadIds.length) return;
    try {
      await markNotificationsReadClient(unreadIds);
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  };

  const visibleItems = workspaceId ? items : [];
  const visibleUnread = workspaceId ? unread : 0;

  return (
    <div className="notify-bell" ref={rootRef}>
      <button
        type="button"
        className="notify-bell-btn"
        aria-label="通知"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void markVisibleRead();
        }}
      >
        <svg
          className="notify-bell-icon"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.3 9.2a5.7 5.7 0 0 1 11.4 0c0 3.4.86 4.86 1.8 6.2.3.42 0 1.1-.5 1.1H5c-.5 0-.8-.68-.5-1.1.94-1.34 1.8-2.8 1.8-6.2Z"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            d="M10 18.5a2 2 0 0 0 4 0"
          />
        </svg>
        {visibleUnread > 0 ? (
          <em className="notify-badge">
            {visibleUnread > 99 ? "99+" : visibleUnread}
          </em>
        ) : null}
      </button>
      {open ? (
        <div className="notify-panel" role="menu">
          <header>
            <b>通知</b>
            <button
              type="button"
              onClick={() => {
                if (!workspaceId) return;
                void fetchNotifications(workspaceId, 20)
                  .then((data) => {
                    setItems(data.items);
                    setUnread(data.unread);
                  })
                  .catch(() => undefined);
              }}
            >
              刷新
            </button>
          </header>
          {!visibleItems.length ? (
            <p className="notify-empty">暂无通知</p>
          ) : (
            <ul>
              {visibleItems.map((item) => (
                <li key={item.id} className={item.read ? "read" : "unread"}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onOpenRecommendations?.();
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                    <small>
                      {item.createdAt
                        ? String(item.createdAt).replace("T", " ").slice(0, 16)
                        : ""}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
