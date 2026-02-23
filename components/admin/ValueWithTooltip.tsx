"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export default function ValueWithTooltip({
  display,
  tooltip,
  className = "",
}: {
  display: string;
  tooltip: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    setCoords({
      left: rect.left,
      top: rect.top - 8,
    });
  }, [visible]);

  const show = () => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
    setVisible(true);
  };

  const hide = () => {
    hideTimeout.current = setTimeout(() => setVisible(false), 150);
  };

  const tooltipEl =
    visible && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed z-50 max-w-xs rounded-lg border border-slate-200 bg-slate-800 px-3 py-2 text-sm font-medium text-white shadow-lg"
            style={{
              left: coords.left,
              top: coords.top,
              transform: "translateY(-100%)",
            }}
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            {tooltip}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <span
        ref={ref}
        role="text"
        className={`cursor-help border-b border-dotted border-slate-400 ${className}`}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {display}
      </span>
      {tooltipEl}
    </>
  );
}
