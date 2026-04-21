import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  variant?: "default" | "primary" | "accent" | "warning";
}

const variantConfig = {
  default: {
    icon: "bg-white/80 text-foreground",
    halo: "from-white via-white/60 to-transparent",
  },
  primary: {
    icon: "bg-primary/[0.12] text-primary",
    halo: "from-primary/[0.16] via-primary/5 to-transparent",
  },
  accent: {
    icon: "bg-accent/[0.12] text-accent",
    halo: "from-accent/[0.16] via-accent/5 to-transparent",
  },
  warning: {
    icon: "bg-warning/[0.14] text-warning",
    halo: "from-warning/[0.18] via-warning/5 to-transparent",
  },
};

export default function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
}: StatCardProps) {
  const cfg = variantConfig[variant];

  return (
    <div className="panel-surface relative overflow-hidden rounded-[28px] p-5 sm:p-6">
      <div className={cn("absolute inset-x-0 top-0 h-20 bg-gradient-to-b opacity-90", cfg.halo)} />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="section-eyebrow">{label}</p>
          <p className="metric-value mt-4 text-4xl text-foreground sm:text-[2.5rem]">{value}</p>
          {subtitle ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p> : null}
          {trend ? (
            <p
              className={cn(
                "mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                trend.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {trend.positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {Math.abs(trend.value)}% vs last week
            </p>
          ) : null}
        </div>

        <div className={cn("liquid-ring flex h-12 w-12 items-center justify-center rounded-[18px]", cfg.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
