import { ReactNode } from "react";
import Link from "next/link";
import ValueWithTooltip from "./ValueWithTooltip";

const variants = {
  primary: "bg-blue-600 text-white shadow-md",
  success: "bg-emerald-600 text-white shadow-md",
  warning: "bg-amber-500 text-white shadow-md",
  slate: "bg-slate-600 text-white shadow-md",
} as const;

export default function AdminStatCard({
  title,
  value,
  icon,
  variant = "primary",
  href,
  subValue,
  valueTitle,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  variant?: keyof typeof variants;
  href?: string;
  subValue?: string;
  /** Optional tooltip (e.g. full value when value is abbreviated) */
  valueTitle?: string;
}) {
  const content = (
    <>
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${variants[variant]}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
          {valueTitle ? (
            <ValueWithTooltip display={value} tooltip={valueTitle} />
          ) : (
            value
          )}
        </p>
        {subValue && (
          <p className="mt-0.5 text-xs text-slate-500">{subValue}</p>
        )}
      </div>
    </>
  );

  const className =
    "group flex flex-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
