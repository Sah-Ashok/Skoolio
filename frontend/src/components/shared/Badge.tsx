import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
};

export default function Badge({ children, tone = "neutral" }: BadgeProps) {
  return <span data-tone={tone}>{children}</span>;
}
