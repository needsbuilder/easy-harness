import type { ReactNode } from "react";

const styles = {
  model: "bg-surface-gold-tint text-txt-primary",
  account: "border border-line text-txt-secondary",
  pricing: "bg-surface-card-hover text-status-success border border-line",
  recommended: "bg-gold-gradient text-txt-on-brand",
  warning: "border border-status-warning text-status-warning",
} as const;

export function Badge({ variant, children }: { variant: keyof typeof styles; children: ReactNode }) {
  return (
    <span className={`rounded-badge px-2.5 py-1 text-badge font-semibold ${styles[variant]}`}>
      {children}
    </span>
  );
}
