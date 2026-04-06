import { useParams, Link } from 'react-router-dom';
import { campaigns, callRecords } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import StatusBadge from '@/components/StatusBadge';
import StatCard from '@/components/StatCard';
import { ArrowLeft, PhoneCall, Users, CheckCircle, Clock, Pause, Play, Shield } from 'lucide-react';

export default function CampaignDetail() {
  const { id } = useParams();
  const campaign = campaigns.find(c => c.id === id);

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Campaign not found</p>
        <Link to="/campaigns"><Button variant="outline" className="mt-4">Back to Campaigns</Button></Link>
      </div>
    );
  }

  const relatedCalls = callRecords.filter(cr => cr.campaignId === campaign.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/campaigns"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold">{campaign.name}</h2>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-sm text-muted-foreground">{campaign.language} · {campaign.vertical} · Launched {campaign.launchedAt || 'Not launched'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === 'active' && <Button variant="outline"><Pause className="mr-2 h-4 w-4" /> Pause</Button>}
          {campaign.status === 'paused' && <Button className="bg-primary text-primary-foreground"><Play className="mr-2 h-4 w-4" /> Resume</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Contacts" value={campaign.contactCount.toLocaleString()} icon={Users} variant="default" />
        <StatCard label="Answer Rate" value={`${campaign.answerRate}%`} icon={PhoneCall} variant="primary" />
        <StatCard label="Completion" value={`${campaign.completionRate}%`} icon={CheckCircle} variant="accent" />
        <StatCard label="Avg Duration" value="3m 12s" icon={Clock} variant="default" />
      </div>

      {/* Fields */}
      {campaign.fields.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Collection Fields</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {campaign.fields.map((f, idx) => (
                <div key={f.field_key} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">{idx + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{f.label}</p>
                      {f.sensitive && <Shield className="h-3 w-3 text-destructive" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{f.type} · {f.required ? 'Required' : 'Optional'}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Calls */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Recent Calls</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Confirmed</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relatedCalls.length > 0 ? relatedCalls.map(cr => (
                <TableRow key={cr.id}>
                  <TableCell className="text-sm font-medium">{cr.contactName}</TableCell>
                  <TableCell><StatusBadge status={cr.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={(cr.fieldsCollected / cr.fieldsTotal) * 100} className="h-1.5 w-12" />
                      <span className="text-xs text-muted-foreground">{cr.fieldsCollected}/{cr.fieldsTotal}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {cr.confirmed ? <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Yes</Badge> : <span className="text-xs text-muted-foreground">No</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {cr.duration > 0 ? `${Math.floor(cr.duration / 60)}m ${cr.duration % 60}s` : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{cr.startedAt}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No calls yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
