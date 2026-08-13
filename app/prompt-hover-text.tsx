"use client";

import { useEffect, useRef, useState } from "react";

/** Truncated prompt with Otterly-style hover popover for full text. */
export default function PromptHoverText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - 360),
    });
  }, [open]);

  return (
    <>
      <span
        ref={ref}
        className={`prompt-hover-text ${className}`.trim()}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {text}
      </span>
      {open ? (
        <div
          className="prompt-hover-popover"
          style={{ top: pos.top, left: pos.left }}
          role="tooltip"
        >
          {text}
        </div>
      ) : null}
    </>
  );
}
