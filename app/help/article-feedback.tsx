"use client";

import { useEffect, useState } from "react";

function storageKey(articleId: string) {
  return `orbis_help_feedback_${articleId}`;
}

export function ArticleFeedback({ articleId }: { articleId: string }) {
  const [choice, setChoice] = useState<"yes" | "no" | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey(articleId));
      if (saved === "yes" || saved === "no") setChoice(saved);
    } catch {
      /* ignore */
    }
  }, [articleId]);

  function vote(value: "yes" | "no") {
    setChoice(value);
    try {
      window.localStorage.setItem(storageKey(articleId), value);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="help-kb-feedback" aria-label="文章反馈">
      {choice ? (
        <p className="help-kb-feedback-thanks">谢谢，我们已记下你的反馈。</p>
      ) : (
        <div className="help-kb-feedback-row">
          <p>这篇文章有帮助吗？</p>
          <div className="help-kb-feedback-btns">
            <button type="button" onClick={() => vote("yes")}>
              是
            </button>
            <button type="button" onClick={() => vote("no")}>
              否
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
