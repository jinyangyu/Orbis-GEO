"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { createPortal } from "react-dom";

export const SIDEBAR_COLLAPSED_KEY = "orbis.sidebar.collapsed";

export function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect
        x="1.5"
        y="2"
        width="13"
        height="12"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <path d="M6 2.2v11.6" stroke="currentColor" strokeWidth="1.35" />
      {collapsed ? (
        <path
          d="M8.2 8h5M11.2 6.2L13 8l-1.8 1.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M13 8H8.2M10 6.2L8.2 8l1.8 1.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export type RailIconName =
  | "overview"
  | "prompts"
  | "citations"
  | "recommendations"
  | "brand-settings"
  | "research"
  | "content"
  | "reports"
  | "help"
  | "billing"
  | "reset";

function RailSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Compact stroke icons for the collapsed rail only. Expanded nav keeps existing glyphs. */
export function NavRailIcon({ name }: { name: RailIconName }) {
  switch (name) {
    case "overview":
      return (
        <RailSvg>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1z" />
        </RailSvg>
      );
    case "prompts":
      return (
        <RailSvg>
          <circle cx="12" cy="12" r="8.25" />
          <circle cx="12" cy="12" r="2.35" />
        </RailSvg>
      );
    case "citations":
      return (
        <RailSvg>
          <path d="M7 17 17 7" />
          <path d="M10 7h7v7" />
        </RailSvg>
      );
    case "recommendations":
      return (
        <RailSvg>
          <path d="M20 7 10.2 17.2 4.8 11.8" />
        </RailSvg>
      );
    case "brand-settings":
      return (
        <RailSvg>
          <circle cx="12" cy="12" r="3.1" />
          <path d="M12 3.6v1.8M12 18.6v1.8M4.9 6.3l1.3 1.3M17.8 16.4l1.3 1.3M3.6 12h1.8M18.6 12h1.8M4.9 17.7l1.3-1.3M17.8 7.6l1.3-1.3" />
        </RailSvg>
      );
    case "research":
      return (
        <RailSvg>
          <path d="M12 3.4 13.4 8l4.6.2L14.8 11l1.2 4.5L12 13.2 8 15.5 9.2 11 6 8.2 10.6 8z" />
          <path d="M18.2 14.2 19 16.8 21.4 17.2 19.6 18.8 20.2 21.2 18.2 19.8 16.2 21.2 16.8 18.8 15 17.2 17.4 16.8z" />
        </RailSvg>
      );
    case "content":
      return (
        <RailSvg>
          <path d="M13.4 5.2 18.8 10.6" />
          <path d="M16.7 3.9a1.7 1.7 0 0 1 2.4 2.4L8.2 17.2 4 18l.8-4.2z" />
        </RailSvg>
      );
    case "reports":
      return (
        <RailSvg>
          <rect x="4.4" y="4.4" width="15.2" height="15.2" rx="2" />
          <path d="M8 9.2h8M8 12.4h8M8 15.6h5.2" />
        </RailSvg>
      );
    case "help":
      return (
        <RailSvg>
          <circle cx="12" cy="12" r="8.25" />
          <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.35c-.9.4-1.3.9-1.3 1.85" />
          <path d="M12 16.7h.01" />
        </RailSvg>
      );
    case "billing":
      return (
        <RailSvg>
          <rect x="3.4" y="6.2" width="17.2" height="11.6" rx="1.8" />
          <path d="M3.4 10h17.2" />
          <path d="M7 14.2h3.4" />
        </RailSvg>
      );
    case "reset":
      return (
        <RailSvg>
          <path d="M3.8 12a8.2 8.2 0 1 0 2.1-5.5" />
          <path d="M3.8 4.6v4.2h4.2" />
        </RailSvg>
      );
    default:
      return null;
  }
}

/** Fixed tooltip portaled to body so sidebar overflow cannot clip it. */
export function RailTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const place = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.top + r.height / 2, left: r.right + 8 });
    setOpen(true);
  };

  return (
    <div
      ref={wrapRef}
      className="sidebar-rail-tip-wrap"
      onMouseEnter={place}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={place}
      onBlurCapture={() => setOpen(false)}
    >
      {children}
      {open
        ? createPortal(
            <div
              className="sidebar-rail-tooltip"
              role="tooltip"
              style={{ top: pos.top, left: pos.left }}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function BrandRailMenu({
  open,
  top,
  left,
  items,
  currentId,
  onPick,
  onClose,
}: {
  open: boolean;
  top: number;
  left: number;
  items: Array<{ id: string; label: string; domain?: string | null }>;
  currentId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const node = event.target as HTMLElement | null;
      if (menuRef.current && node && menuRef.current.contains(node)) return;
      if (node?.closest("[data-brand-rail-trigger]")) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      ref={menuRef}
      className="sidebar-brand-menu"
      role="menu"
      style={{ top, left }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={item.id === currentId ? "is-current" : ""}
          onClick={() => onPick(item.id)}
        >
          <BrandLogo className="brand-nav-logo" domain={item.domain} name={item.label} />
          <span>{item.label}</span>
          {item.id === currentId ? <em aria-hidden>✓</em> : null}
        </button>
      ))}
    </div>,
    document.body,
  );
}
