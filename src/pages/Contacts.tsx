import { useState } from 'react';
import { contacts } from '@/lib/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusBadge from '@/components/StatusBadge';
import { Search, Upload, Filter, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function Contacts() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = contacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage contact lists, consent, and suppression</p>
        <div className="flex gap-2">
          <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export</Button>
          <Button className="bg-primary text-primary-foreground"><Upload className="mr-2 h-4 w-4" /> Upload CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="font-heading text-2xl font-bold mt-1">{contacts.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Eligible</p><p className="font-heading text-2xl font-bold mt-1 text-success">{contacts.filter(c => c.status === 'eligible').length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Opted Out</p><p className="font-heading text-2xl font-bold mt-1 text-destructive">{contacts.filter(c => c.status === 'opted_out').length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">DND</p><p className="font-heading text-2xl font-bold mt-1 text-warning">{contacts.filter(c => c.status === 'dnd').length}</p></Card>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="eligible">Eligible</SelectItem>
            <SelectItem value="opted_out">Opted Out</SelectItem>
            <SelectItem value="suppressed">Suppressed</SelectItem>
            <SelectItem value="dnd">DND</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Consent</TableHead>
                <TableHead>Last Contacted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell><div><p className="text-sm font-medium">{c.name}</p>{c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}</div></TableCell>
                  <TableCell className="text-sm font-mono">{c.phone}</TableCell>
                  <TableCell className="text-sm">{c.language}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell>
                    {c.consent
                      ? <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Given</Badge>
                      : <Badge variant="outline" className="text-[10px]">Pending</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.lastContactedAt || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
