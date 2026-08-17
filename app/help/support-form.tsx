"use client";

import { useState } from "react";

export function SupportForm() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  if (sent) {
    return <p className="help-doc-note">已记录到本机（演示）。正式环境将发送至 support@orbis.example。</p>;
  }
  return (
    <form
      className="help-support-form"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const prev = JSON.parse(window.localStorage.getItem("orbis_support_tickets") || "[]") as unknown[];
          prev.push({ name, email, message, at: new Date().toISOString() });
          window.localStorage.setItem("orbis_support_tickets", JSON.stringify(prev));
        } catch {
          /* ignore */
        }
        setSent(true);
      }}
    >
      <label>
        称呼
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        邮箱
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        问题描述
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} />
      </label>
      <button type="submit" className="primary-button">
        提交
      </button>
    </form>
  );
}
