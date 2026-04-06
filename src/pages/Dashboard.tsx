import {
  PhoneCall, Users, Megaphone, CheckCircle, TrendingUp, Clock,
  ArrowUpRight, AlertTriangle
} from 'lucide-react';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { dashboardStats, campaigns, dailyCallVolume, dispositionBreakdown, callRecords } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Campaigns"
          value={dashboardStats.activeCampaigns}
          subtitle={`${dashboardStats.totalCampaigns} total`}
          icon={Megaphone}
          variant="primary"
          trend={{ value: 12, positive: true }}
        />
        <StatCard
          label="Total Contacts"
          value={dashboardStats.totalContacts.toLocaleString()}
          subtitle="Across all campaigns"
          icon={Users}
          variant="default"
        />
        <StatCard
          label="Answer Rate"
          value={`${dashboardStats.avgAnswerRate}%`}
          subtitle="7-day average"
          icon={PhoneCall}
          variant="accent"
          trend={{ value: 3.2, positive: true }}
        />
        <StatCard
          label="Completion Rate"
          value={`${dashboardStats.avgCompletionRate}%`}
          subtitle="Data fully collected"
          icon={CheckCircle}
          variant="default"
          trend={{ value: 1.5, positive: true }}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Call Volume (Last 10 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyCallVolume}>
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="calls" stroke="hsl(var(--chart-1))" fill="url(#colorCalls)" strokeWidth={2} />
                  <Area type="monotone" dataKey="completed" stroke="hsl(var(--chart-2))" fill="url(#colorCompleted)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Dispositions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dispositionBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {dispositionBreakdown.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value}%`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              {dispositionBreakdown.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: d.fill }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-medium">{d.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Campaigns */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Link to="/campaigns">
              <Button variant="ghost" size="sm" className="text-xs text-primary">
                View All <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {campaigns.filter(c => c.status === 'active').map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.language} · {c.contactCount.toLocaleString()} contacts</p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-lg font-bold text-primary">{c.completionRate}%</p>
                    <p className="text-[10px] text-muted-foreground">completion</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Calls */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recent Calls</CardTitle>
            <Link to="/call-records">
              <Button variant="ghost" size="sm" className="text-xs text-primary">
                View All <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Contact</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callRecords.slice(0, 5).map(cr => (
                  <TableRow key={cr.id}>
                    <TableCell className="text-sm">{cr.contactName}</TableCell>
                    <TableCell><StatusBadge status={cr.status} /></TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {cr.duration > 0 ? `${Math.floor(cr.duration / 60)}m ${cr.duration % 60}s` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex items-center gap-3 py-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-medium">2 campaigns approaching quiet hours</p>
            <p className="text-xs text-muted-foreground">KYC Verification Drive and Loan Eligibility Survey will pause at 9:00 PM IST</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
