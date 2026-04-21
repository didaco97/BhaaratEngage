import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.02em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring/35 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/[0.12] bg-primary/10 text-primary",
        secondary: "border-white/70 bg-white/65 text-foreground",
        destructive: "border-destructive/[0.12] bg-destructive/10 text-destructive",
        outline: "border-white/70 bg-white/45 text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
