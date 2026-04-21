import { cn } from "@/lib/utils";

const statusConfig: Record<string, { dot: string; text: string; surface: string }> = {
  active: { dot: "bg-success", text: "text-success", surface: "bg-success/10 border-success/[0.15]" },
  in_progress: { dot: "bg-primary", text: "text-primary", surface: "bg-primary/10 border-primary/[0.15]" },
  completed: { dot: "bg-info", text: "text-info", surface: "bg-info/10 border-info/[0.15]" },
  paused: { dot: "bg-warning", text: "text-warning", surface: "bg-warning/[0.12] border-warning/[0.15]" },
  draft: { dot: "bg-muted-foreground", text: "text-muted-foreground", surface: "bg-white/60 border-white/70" },
  eligible: { dot: "bg-success", text: "text-success", surface: "bg-success/10 border-success/[0.15]" },
  opted_out: { dot: "bg-destructive", text: "text-destructive", surface: "bg-destructive/10 border-destructive/[0.15]" },
  suppressed: { dot: "bg-warning", text: "text-warning", surface: "bg-warning/[0.12] border-warning/[0.15]" },
  dnd: { dot: "bg-destructive", text: "text-destructive", surface: "bg-destructive/10 border-destructive/[0.15]" },
  no_answer: { dot: "bg-muted-foreground", text: "text-muted-foreground", surface: "bg-white/60 border-white/70" },
  busy: { dot: "bg-warning", text: "text-warning", surface: "bg-warning/[0.12] border-warning/[0.15]" },
  failed: { dot: "bg-destructive", text: "text-destructive", surface: "bg-destructive/10 border-destructive/[0.15]" },
  transferred: { dot: "bg-info", text: "text-info", surface: "bg-info/10 border-info/[0.15]" },
};

export default function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.draft;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase",
        cfg.surface,
        cfg.text,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
