import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  completed: 'bg-info/10 text-info border-info/20',
  paused: 'bg-warning/10 text-warning border-warning/20',
  draft: 'bg-muted text-muted-foreground border-border',
  eligible: 'bg-success/10 text-success border-success/20',
  opted_out: 'bg-destructive/10 text-destructive border-destructive/20',
  suppressed: 'bg-warning/10 text-warning border-warning/20',
  dnd: 'bg-destructive/10 text-destructive border-destructive/20',
  no_answer: 'bg-muted text-muted-foreground border-border',
  busy: 'bg-warning/10 text-warning border-warning/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
  transferred: 'bg-info/10 text-info border-info/20',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('text-[11px] capitalize font-medium', statusStyles[status] || '')}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
