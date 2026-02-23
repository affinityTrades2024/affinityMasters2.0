import { ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "success" | "warning" | "info";

const variantStyles: Record<
  Variant,
  { icon: string; card?: string; text?: string }
> = {
  primary: {
    icon: "bg-blue-600 text-white shadow-md",
    card: "bg-white border border-gray-200",
    text: "text-gray-700",
  },
  success: {
    icon: "bg-emerald-600 text-white shadow-md",
    card: "bg-white border border-gray-200",
    text: "text-gray-700",
  },
  warning: {
    icon: "bg-amber-500 text-white shadow-md",
    card: "bg-white border border-gray-200",
    text: "text-gray-700",
  },
  info: {
    icon: "bg-sky-600 text-white shadow-md",
    card: "bg-white border border-gray-200",
    text: "text-gray-700",
  },
};

const variantBgStyles: Record<Variant, string> = {
  primary: "bg-blue-600 border-blue-600 text-white",
  success: "bg-emerald-600 border-emerald-600 text-white",
  warning: "bg-amber-500 border-amber-500 text-white",
  info: "bg-sky-600 border-sky-600 text-white",
};

export default function InfoBox({
  icon,
  title,
  linkHref,
  linkLabel,
  value,
  subValue,
  variant = "primary",
  filled = false,
}: {
  icon: ReactNode;
  title: string;
  linkHref?: string;
  linkLabel?: string;
  value: string;
  subValue?: string;
  variant?: Variant;
  filled?: boolean;
}) {
  const styles = variantStyles[variant];
  const iconBoxClass = filled ? "bg-white/20 text-white" : styles.icon;
  const cardClass = filled
    ? `rounded-xl border ${variantBgStyles[variant]} shadow-lg`
    : `rounded-xl border ${styles.card} bg-white shadow-md hover:shadow-lg transition-shadow`;

  return (
    <div className={cardClass}>
      <div className="flex flex-1 gap-4 p-5">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${iconBoxClass}`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${filled ? "text-white/90" : "text-gray-500"}`}>
            {title}
            {linkHref && (
              <Link
                href={linkHref}
                target={linkLabel ? "_blank" : undefined}
                className="ml-1 inline text-blue-600 hover:text-blue-700 hover:underline"
              >
                {linkLabel ?? "↗"}
              </Link>
            )}
          </p>
          <h3 className={`mt-0.5 text-2xl font-bold tracking-tight ${filled ? "text-white" : "text-gray-900"}`}>
            {value}
          </h3>
          {subValue && (
            <h5 className={`mt-0.5 text-sm font-medium ${filled ? "text-white/80" : "text-gray-600"}`}>
              {subValue}
            </h5>
          )}
        </div>
      </div>
    </div>
  );
}
