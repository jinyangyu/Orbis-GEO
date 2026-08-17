"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportClientError } from "@/lib/observability/report-error";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || "未知错误",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError(error, {
      source: "AppErrorBoundary",
      componentStack: (info.componentStack || "").slice(0, 500),
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          fontFamily: "system-ui, sans-serif",
          background: "#f6f7fb",
          color: "#1f2430",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#fff",
            border: "1px solid #e6e8ef",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>页面出错了</h1>
          <p style={{ margin: "0 0 16px", color: "#5b6475", lineHeight: 1.5 }}>
            已记录错误信息。请刷新重试；若持续出现，请联系支持。
          </p>
          <pre
            style={{
              margin: "0 0 16px",
              padding: 12,
              background: "#f3f4f8",
              borderRadius: 8,
              fontSize: 12,
              overflow: "auto",
            }}
          >
            {this.state.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              borderRadius: 8,
              padding: "10px 14px",
              background: "#3f3d89",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            刷新页面
          </button>
        </div>
      </main>
    );
  }
}
