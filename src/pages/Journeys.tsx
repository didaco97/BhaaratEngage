import { journeys } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import StatusBadge from '@/components/StatusBadge';
import { ArrowRight, Phone, MessageSquare, MessageCircle } from 'lucide-react';

const channelIcons: Record<string, React.ElementType> = {
  Voice: Phone,
  SMS: MessageSquare,
  WhatsApp: MessageCircle,
};

function getChannelIcon(step: string) {
  for (const [key, Icon] of Object.entries(channelIcons)) {
    if (step.includes(key)) return Icon;
  }
  return Phone;
}

export default function Journeys() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Orchestrated multi-channel sequences for each campaign</p>

      <div className="space-y-4">
        {journeys.map(j => (
          <Card key={j.id} className="animate-fade-in">
            <CardContent className="py-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-base font-semibold">{j.campaignName}</h3>
                    <StatusBadge status={j.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{j.totalContacts.toLocaleString()} contacts · {j.processed.toLocaleString()} processed</p>
                </div>
                <div className="text-right">
                  <p className="font-heading text-2xl font-bold text-primary">{j.successRate}%</p>
                  <p className="text-[10px] text-muted-foreground">success rate</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-xs text-muted-foreground">Progress</span>
                </div>
                <Progress value={(j.processed / j.totalContacts) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{Math.round((j.processed / j.totalContacts) * 100)}% complete</p>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {j.sequence.map((step, idx) => {
                  const Icon = getChannelIcon(step);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{step}</span>
                      </div>
                      {idx < j.sequence.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
