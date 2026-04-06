import { useState } from 'react';
import { callRecords } from '@/lib/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusBadge from '@/components/StatusBadge';
import { Search, Filter, FileText, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const mockTranscript = [
  { speaker: 'Bot', text: 'Namaste! This is HDFC Bank calling. I am calling regarding your KYC verification.' },
  { speaker: 'User', text: 'Haan, boliye.' },
  { speaker: 'Bot', text: 'May I have your full name as per your PAN card?' },
  { speaker: 'User', text: 'Rajesh Kumar.' },
  { speaker: 'Bot', text: 'Thank you, Rajesh Kumar. Could you please share your PAN number?' },
  { speaker: 'User', text: 'ABCDE1234F' },
  { speaker: 'Bot', text: 'Got it. What is your date of birth?' },
  { speaker: 'User', text: '15th August 1985.' },
  { speaker: 'Bot', text: 'Thank you. Let me confirm your details: Full Name - Rajesh Kumar, PAN - ****1234F, Date of Birth - 15/08/1985. Is this correct?' },
  { speaker: 'User', text: 'Haan, sab sahi hai.' },
  { speaker: 'Bot', text: 'Thank you, Rajesh ji. Your KYC verification is complete. Have a good day!' },
];

export default function CallRecords() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = callRecords.filter(cr => {
    const matchesSearch = cr.contactName.toLowerCase().includes(search.toLowerCase()) || cr.phone.includes(search);
    const matchesStatus = statusFilter === 'all' || cr.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">View all call attempts, dispositions, and transcripts</p>
        <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by contact or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="no_answer">No Answer</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="transferred">Transferred</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Confirmed</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Transcript</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(cr => (
                <TableRow key={cr.id}>
                  <TableCell>
                    <div><p className="text-sm font-medium">{cr.contactName}</p><p className="text-xs text-muted-foreground font-mono">{cr.phone}</p></div>
                  </TableCell>
                  <TableCell className="text-sm">{cr.campaignName}</TableCell>
                  <TableCell><StatusBadge status={cr.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={(cr.fieldsCollected / cr.fieldsTotal) * 100} className="h-1.5 w-12" />
                      <span className="text-xs">{cr.fieldsCollected}/{cr.fieldsTotal}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {cr.confirmed
                      ? <Badge className="bg-success/10 text-success border-success/20 text-[10px]">✓</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {cr.duration > 0 ? `${Math.floor(cr.duration / 60)}m ${cr.duration % 60}s` : '—'}
                  </TableCell>
                  <TableCell className="text-xs">{cr.language}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{cr.startedAt}</TableCell>
                  <TableCell className="text-right">
                    {cr.status === 'completed' ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm"><FileText className="h-4 w-4" /></Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-base">Call Transcript — {cr.contactName}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 mt-4">
                            {mockTranscript.map((line, idx) => (
                              <div key={idx} className={`flex ${line.speaker === 'Bot' ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                  line.speaker === 'Bot'
                                    ? 'bg-muted text-foreground'
                                    : 'bg-primary/10 text-foreground'
                                }`}>
                                  <p className="text-[10px] font-medium text-muted-foreground mb-1">{line.speaker}</p>
                                  {line.text}
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-4">* Sensitive fields are masked in this view</p>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
