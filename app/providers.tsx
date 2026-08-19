"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { bootstrapSession, resetBootstrapLatch } from "@/lib/auth/client";
import { apiFetch } from "@/lib/auth/fetch";
import { AppErrorBoundary } from "./error-boundary";
import { LoginGate } from "./login-gate";

function isPublicPath(pathname: string) {
  return (
    pathname === "/help" ||
    pathname.startsWith("/help/") ||
    pathname === "/pricing" ||
    pathname.startsWith("/pricing/")
  );
}

async function fetchGateStatus(): Promise<{ required: boolean; ok: boolean }> {
  const res = await fetch("/api/auth/gate/status", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return { required: false, ok: true };
  return (await res.json()) as { required: boolean; ok: boolean };
}

async function ensureSessionAndMaybeClaim() {
  const { devOpenTenant } = await bootstrapSession();
  if (!devOpenTenant) return;
  try {
    const list = await apiFetch("/api/workspaces", { cache: "no-store" });
    if (!list.ok) return;
    const body = (await list.json()) as { items?: unknown[] };
    if ((body.items?.length ?? 0) > 0) return;
    const claim = await apiFetch("/api/workspaces/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (claim.status === 403) return;
  } catch {
    /* claim optional when flag off or tables missing */
  }
}

export function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const publicPage = isPublicPath(pathname);
  const [gateChecked, setGateChecked] = useState(false);
  const [gateRequired, setGateRequired] = useState(false);
  const [gateOk, setGateOk] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (publicPage) return;
    let cancelled = false;
    void fetchGateStatus()
      .then((s) => {
        if (cancelled) return;
        setGateRequired(s.required);
        setGateOk(s.ok);
        setGateChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setGateRequired(false);
        setGateOk(true);
        setGateChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [publicPage]);

  useEffect(() => {
    if (publicPage || !gateChecked) return;
    if (gateRequired && !gateOk) {
      setSessionReady(false);
      return;
    }
    if (sessionReady) return;
    let cancelled = false;
    void ensureSessionAndMaybeClaim()
      .then(() => {
        if (!cancelled) setSessionReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "会话初始化失败");
          setSessionReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [publicPage, gateChecked, gateRequired, gateOk, sessionReady]);

  if (!publicPage && gateChecked && gateRequired && !gateOk) {
    return (
      <AppErrorBoundary>
        <LoginGate
          onSuccess={() => {
            resetBootstrapLatch();
            setGateOk(true);
            setSessionReady(false);
            setError("");
          }}
        />
      </AppErrorBoundary>
    );
  }

  const showApp = publicPage || (gateChecked && sessionReady);

  return (
    <AppErrorBoundary>
      {!showApp ? (
        <div style={{ padding: 24, color: "#6b7280", fontSize: 13 }}>
          正在建立安全会话…
        </div>
      ) : (
        <>
          {error && !publicPage ? (
            <div
              style={{
                padding: "8px 16px",
                background: "#fef2f2",
                color: "#b91c1c",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          ) : null}
          {children}
        </>
      )}
    </AppErrorBoundary>
  );
}
