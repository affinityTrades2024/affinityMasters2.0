"use client";

export default function AdminAlert({
  type,
  message,
  onDismiss,
}: {
  type: "success" | "error";
  message: string;
  onDismiss?: () => void;
}) {
  const isSuccess = type === "success";
  return (
    <div
      role="alert"
      className={`mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={`shrink-0 rounded p-1 hover:opacity-80 ${isSuccess ? "text-emerald-600" : "text-red-600"}`}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
