import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "danger" | "warning" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-zinc-800 text-white": variant === "default",
          "border-transparent bg-emerald-500/10 text-emerald-400": variant === "success",
          "border-transparent bg-red-500/10 text-red-400": variant === "danger",
          "border-transparent bg-amber-500/10 text-amber-400": variant === "warning",
          "border-zinc-700 text-zinc-400": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
