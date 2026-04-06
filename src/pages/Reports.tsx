import { dashboardStats, dailyCallVolume, dispositionBreakdown } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Calendar } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

const fieldDropoff = [
  { field: 'Full Name', captured: 95, dropped: 5 },
  { field: 'PAN Number', captured: 82, dropped: 18 },
  { field: 'Date of Birth', captured: 78, dropped: 22 },
  { field: 'Address', captured: 67, dropped: 33 },
];

const providerPerformance = [
  { date: 'Mar 28', exotel: 98.2, plivo: 96.1 },
  { date: 'Mar 29', exotel: 97.8, plivo: 95.5 },
  { date: 'Mar 30', exotel: 99.1, plivo: 97.2 },
  { date: 'Mar 31', exotel: 96.5, plivo: 94.8 },
  { date: 'Apr 01', exotel: 98.8, plivo: 96.9 },
  { date: 'Apr 02', exotel: 99.2, plivo: 97.5 },
  { date: 'Apr 03', exotel: 97.9, plivo: 95.8 },
];

export default function Reports() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Operational analytics and performance insights</p>
        <div className="flex gap-2">
          <Select defaultValue="7d">
            <SelectTrigger className="w-36"><Calendar className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export Report</Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Answer Rate', value: `${dashboardStats.avgAnswerRate}%` },
          { label: 'Completion', value: `${dashboardStats.avgCompletionRate}%` },
          { label: 'Confirmation', value: `${dashboardStats.avgConfirmationRate}%` },
          { label: 'Opt-out', value: `${dashboardStats.optOutRate}%` },
          { label: 'Transfer', value: `${dashboardStats.transferRate}%` },
        ].map(kpi => (
          <Card key={kpi.label} className="p-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
            <p className="font-heading text-xl font-bold mt-1">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Field Drop-off */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Field-Level Drop-off (KYC Campaign)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fieldDropoff} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis dataKey="field" type="category" width={90} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="captured" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name="Captured %" />
                  <Bar dataKey="dropped" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} name="Dropped %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Provider Performance */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Provider Uptime (%)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={providerPerformance}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis domain={[93, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="exotel" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Exotel" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="plivo" stroke="hsl(var(--chart-3))" strokeWidth={2} name="Plivo" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Disposition full chart */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Calls by Outcome (Last 10 Days)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyCallVolume}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="calls" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Total Calls" />
                <Bar dataKey="answered" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Answered" />
                <Bar dataKey="completed" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
