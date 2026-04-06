import { useState } from 'react';
import { workspaces } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Building, Users, Shield, Bell, Globe, Key } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Tabs defaultValue="workspace" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="workspace"><Building className="mr-1.5 h-3.5 w-3.5" /> Workspace</TabsTrigger>
          <TabsTrigger value="team"><Users className="mr-1.5 h-3.5 w-3.5" /> Team</TabsTrigger>
          <TabsTrigger value="security"><Shield className="mr-1.5 h-3.5 w-3.5" /> Security</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1.5 h-3.5 w-3.5" /> Notifications</TabsTrigger>
          <TabsTrigger value="api"><Key className="mr-1.5 h-3.5 w-3.5" /> API & Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace">
          <Card>
            <CardHeader><CardTitle className="text-base">Workspace Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Workspace Name</Label>
                  <Input defaultValue="HDFC Collections" />
                </div>
                <div className="space-y-2">
                  <Label>Default Language</Label>
                  <Input defaultValue="Hindi" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Default Calling Window</Label>
                <div className="flex gap-3">
                  <Input type="time" defaultValue="09:00" className="w-32" />
                  <span className="self-center text-muted-foreground">to</span>
                  <Input type="time" defaultValue="21:00" className="w-32" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Switch defaultChecked />
                <Label>Enforce DND compliance checks</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch defaultChecked />
                <Label>Enable quiet hours auto-pause</Label>
              </div>
              <Button className="bg-primary text-primary-foreground">Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Team Members</CardTitle>
                <Button size="sm" className="bg-primary text-primary-foreground">Invite Member</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: 'Ankit Mehta', email: 'ankit@hdfc.com', role: 'workspace_admin' },
                { name: 'Priya Singh', email: 'priya.s@hdfc.com', role: 'campaign_manager' },
                { name: 'Ravi Kumar', email: 'ravi.k@hdfc.com', role: 'operator' },
                { name: 'Sunita Patel', email: 'sunita@hdfc.com', role: 'reviewer' },
                { name: 'Deepak Joshi', email: 'deepak.j@hdfc.com', role: 'viewer' },
              ].map(member => (
                <div key={member.email} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{member.role.replace('_', ' ')}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader><CardTitle className="text-base">Security & Compliance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium">Sensitive field encryption</p>
                  <p className="text-xs text-muted-foreground">AES-256 encryption at rest for all sensitive data</p>
                </div>
                <Badge className="bg-success/10 text-success border-success/20">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium">CSV export masking</p>
                  <p className="text-xs text-muted-foreground">Sensitive fields are automatically masked in exports</p>
                </div>
                <Badge className="bg-success/10 text-success border-success/20">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium">Audit logging</p>
                  <p className="text-xs text-muted-foreground">All actions logged with user, timestamp, and details</p>
                </div>
                <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium">Transcript access control</p>
                  <p className="text-xs text-muted-foreground">Full transcripts restricted to admin and reviewer roles</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle className="text-base">Notification Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Campaign launched', desc: 'When a campaign starts sending calls' },
                { label: 'Campaign completed', desc: 'When all contacts have been processed' },
                { label: 'High opt-out rate alert', desc: 'When opt-out exceeds 5% threshold' },
                { label: 'Provider failure alert', desc: 'When voice provider uptime drops below 95%' },
                { label: 'Export ready', desc: 'When CSV export is ready for download' },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">{n.label}</p><p className="text-xs text-muted-foreground">{n.desc}</p></div>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader><CardTitle className="text-base">API Keys & Webhooks</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input value="bv_live_****************************k8m3" readOnly className="font-mono text-sm" />
                  <Button variant="outline">Regenerate</Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input placeholder="https://your-server.com/webhooks/bharatvaani" />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <div className="flex flex-wrap gap-2">
                  {['call.completed', 'call.failed', 'campaign.completed', 'export.ready'].map(evt => (
                    <Badge key={evt} variant="outline" className="text-xs font-mono">{evt}</Badge>
                  ))}
                </div>
              </div>
              <Button className="bg-primary text-primary-foreground">Save Webhook</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
