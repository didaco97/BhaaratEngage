import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, GripVertical, ArrowLeft, Shield, Save } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { FieldDefinition } from '@/lib/mockData';

export default function CampaignBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [fields, setFields] = useState<FieldDefinition[]>([
    { field_key: '', label: '', prompt: '', type: 'text', required: true, sensitive: false, retry_limit: 3 },
  ]);

  const addField = () => {
    setFields([...fields, { field_key: '', label: '', prompt: '', type: 'text', required: true, sensitive: false, retry_limit: 3 }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<FieldDefinition>) => {
    setFields(fields.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/campaigns">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h2 className="font-heading text-xl font-bold">Create Campaign</h2>
          <p className="text-sm text-muted-foreground">Step {step} of 3</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2">
        {[1, 2, 3].map(s => (
          <button key={s} onClick={() => setStep(s)}
            className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Campaign Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input placeholder="e.g., KYC Verification Drive - Mumbai" />
              </div>
              <div className="space-y-2">
                <Label>Vertical</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select vertical" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banking">Banking</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="lending">Lending</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="telecom">Telecom</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hindi">Hindi</SelectItem>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="tamil">Tamil</SelectItem>
                    <SelectItem value="telugu">Telugu</SelectItem>
                    <SelectItem value="kannada">Kannada</SelectItem>
                    <SelectItem value="bengali">Bengali</SelectItem>
                    <SelectItem value="marathi">Marathi</SelectItem>
                    <SelectItem value="gujarati">Gujarati</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Caller Identity</Label>
                <Input placeholder="e.g., HDFC Bank" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Intro Script</Label>
              <Textarea placeholder="Hello, this is [Caller Identity]. I'm calling regarding..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Purpose Statement</Label>
              <Textarea placeholder="The purpose of this call is to..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Calling Window Start</Label>
                <Input type="time" defaultValue="09:00" />
              </div>
              <div className="space-y-2">
                <Label>Calling Window End</Label>
                <Input type="time" defaultValue="21:00" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch id="transfer" />
              <Label htmlFor="transfer">Enable human transfer</Label>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} className="bg-primary text-primary-foreground">
                Next: Define Fields →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Data Collection Fields</CardTitle>
              <Button onClick={addField} variant="outline" size="sm">
                <Plus className="mr-1 h-3 w-3" /> Add Field
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, idx) => (
              <div key={idx} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <Badge variant="outline" className="text-xs">Field {idx + 1}</Badge>
                    {field.sensitive && (
                      <Badge className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                        <Shield className="mr-1 h-2.5 w-2.5" /> Sensitive
                      </Badge>
                    )}
                  </div>
                  {fields.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeField(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Field Key</Label>
                    <Input placeholder="e.g., pan_number" className="text-sm" value={field.field_key}
                      onChange={(e) => updateField(idx, { field_key: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Label</Label>
                    <Input placeholder="e.g., PAN Number" className="text-sm" value={field.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Voice Prompt</Label>
                  <Textarea placeholder="What the bot will say to collect this field..." rows={2} className="text-sm" value={field.prompt}
                    onChange={(e) => updateField(idx, { prompt: e.target.value })} />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select value={field.type} onValueChange={(v) => updateField(idx, { type: v as FieldDefinition['type'] })}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="boolean">Yes/No</SelectItem>
                        <SelectItem value="select">Select</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Retries</Label>
                    <Input type="number" min={1} max={5} value={field.retry_limit} className="text-sm"
                      onChange={(e) => updateField(idx, { retry_limit: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div className="flex items-end gap-2 pb-0.5">
                    <Switch checked={field.required} onCheckedChange={(v) => updateField(idx, { required: v })} />
                    <Label className="text-xs">Required</Label>
                  </div>
                  <div className="flex items-end gap-2 pb-0.5">
                    <Switch checked={field.sensitive} onCheckedChange={(v) => updateField(idx, { sensitive: v })} />
                    <Label className="text-xs text-destructive">Sensitive</Label>
                  </div>
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)} className="bg-primary text-primary-foreground">
                Next: Journey Settings →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Journey Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Primary Channel</Label>
              <Select defaultValue="voice">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="voice">Voice Call</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>If Unanswered</Label>
              <Select defaultValue="sms">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">Send SMS</SelectItem>
                  <SelectItem value="whatsapp">Send WhatsApp</SelectItem>
                  <SelectItem value="retry">Retry Voice</SelectItem>
                  <SelectItem value="none">No follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>If Partial Collection</Label>
              <Select defaultValue="whatsapp">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">Send WhatsApp Summary</SelectItem>
                  <SelectItem value="sms">Send SMS Reminder</SelectItem>
                  <SelectItem value="retry">Retry Voice</SelectItem>
                  <SelectItem value="none">No follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Retry Window (hours)</Label>
                <Input type="number" defaultValue={4} />
              </div>
              <div className="space-y-2">
                <Label>Max Retries</Label>
                <Input type="number" defaultValue={3} />
              </div>
              <div className="space-y-2">
                <Label>Concurrency Limit</Label>
                <Input type="number" defaultValue={50} />
              </div>
              <div className="space-y-2">
                <Label>Pacing (calls/min)</Label>
                <Input type="number" defaultValue={20} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>CSV Upload Source</Label>
              <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">Drag & drop your contact CSV here, or click to browse</p>
                <Button variant="outline" className="mt-3" size="sm">Choose File</Button>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/campaigns')}>
                  <Save className="mr-2 h-4 w-4" /> Save as Draft
                </Button>
                <Button className="bg-primary text-primary-foreground" onClick={() => navigate('/campaigns')}>
                  Launch Campaign 🚀
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
