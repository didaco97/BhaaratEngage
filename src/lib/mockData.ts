// Mock data for BharatVaani Engage

export interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  language: string;
  vertical: string;
  contactCount: number;
  completionRate: number;
  answerRate: number;
  createdAt: string;
  launchedAt?: string;
  fields: FieldDefinition[];
}

export interface FieldDefinition {
  field_key: string;
  label: string;
  prompt: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  required: boolean;
  sensitive: boolean;
  retry_limit: number;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  language: string;
  status: 'eligible' | 'opted_out' | 'suppressed' | 'dnd';
  consent: boolean;
  campaignId?: string;
  lastContactedAt?: string;
}

export interface CallRecord {
  id: string;
  campaignId: string;
  campaignName: string;
  contactName: string;
  phone: string;
  status: 'completed' | 'no_answer' | 'busy' | 'failed' | 'transferred';
  disposition: string;
  confirmed: boolean;
  duration: number;
  startedAt: string;
  language: string;
  fieldsCollected: number;
  fieldsTotal: number;
}

export interface Journey {
  id: string;
  campaignId: string;
  campaignName: string;
  sequence: string[];
  status: 'active' | 'paused' | 'completed';
  totalContacts: number;
  processed: number;
  successRate: number;
}

export const campaigns: Campaign[] = [
  {
    id: 'camp-001',
    name: 'KYC Verification Drive - Mumbai',
    status: 'active',
    language: 'Hindi',
    vertical: 'Banking',
    contactCount: 15420,
    completionRate: 67.3,
    answerRate: 82.1,
    createdAt: '2026-03-15',
    launchedAt: '2026-03-18',
    fields: [
      { field_key: 'full_name', label: 'Full Name', prompt: 'May I have your full name as per your PAN card?', type: 'text', required: true, sensitive: false, retry_limit: 3 },
      { field_key: 'pan_number', label: 'PAN Number', prompt: 'Could you please share your PAN number?', type: 'text', required: true, sensitive: true, retry_limit: 3 },
      { field_key: 'dob', label: 'Date of Birth', prompt: 'What is your date of birth?', type: 'date', required: true, sensitive: true, retry_limit: 2 },
      { field_key: 'address', label: 'Current Address', prompt: 'Can you confirm your current residential address?', type: 'text', required: true, sensitive: false, retry_limit: 2 },
    ],
  },
  {
    id: 'camp-002',
    name: 'Insurance Renewal - Tamil Nadu',
    status: 'active',
    language: 'Tamil',
    vertical: 'Insurance',
    contactCount: 8930,
    completionRate: 54.8,
    answerRate: 76.5,
    createdAt: '2026-03-20',
    launchedAt: '2026-03-22',
    fields: [
      { field_key: 'policy_number', label: 'Policy Number', prompt: 'Please share your policy number', type: 'text', required: true, sensitive: false, retry_limit: 3 },
      { field_key: 'renewal_confirm', label: 'Renewal Confirmation', prompt: 'Would you like to renew your policy?', type: 'boolean', required: true, sensitive: false, retry_limit: 2 },
    ],
  },
  {
    id: 'camp-003',
    name: 'Loan Eligibility Survey - Delhi NCR',
    status: 'paused',
    language: 'Hindi',
    vertical: 'Lending',
    contactCount: 22100,
    completionRate: 31.2,
    answerRate: 68.9,
    createdAt: '2026-03-10',
    launchedAt: '2026-03-12',
    fields: [],
  },
  {
    id: 'camp-004',
    name: 'Healthcare Appointment Reminders',
    status: 'completed',
    language: 'English',
    vertical: 'Healthcare',
    contactCount: 5600,
    completionRate: 89.4,
    answerRate: 91.2,
    createdAt: '2026-02-28',
    launchedAt: '2026-03-01',
    fields: [],
  },
  {
    id: 'camp-005',
    name: 'Credit Card Activation - Karnataka',
    status: 'draft',
    language: 'Kannada',
    vertical: 'Banking',
    contactCount: 0,
    completionRate: 0,
    answerRate: 0,
    createdAt: '2026-04-01',
    fields: [],
  },
];

export const contacts: Contact[] = [
  { id: 'con-001', name: 'Rajesh Kumar', phone: '+91 98765 43210', email: 'rajesh@email.com', language: 'Hindi', status: 'eligible', consent: true, campaignId: 'camp-001', lastContactedAt: '2026-04-02' },
  { id: 'con-002', name: 'Priya Sharma', phone: '+91 87654 32109', language: 'Hindi', status: 'eligible', consent: true, campaignId: 'camp-001', lastContactedAt: '2026-04-01' },
  { id: 'con-003', name: 'Arun Patel', phone: '+91 76543 21098', email: 'arun.p@email.com', language: 'Gujarati', status: 'opted_out', consent: false },
  { id: 'con-004', name: 'Lakshmi Iyer', phone: '+91 65432 10987', language: 'Tamil', status: 'eligible', consent: true, campaignId: 'camp-002' },
  { id: 'con-005', name: 'Mohammed Farooq', phone: '+91 54321 09876', email: 'farooq@email.com', language: 'Urdu', status: 'dnd', consent: false },
  { id: 'con-006', name: 'Sneha Reddy', phone: '+91 43210 98765', language: 'Telugu', status: 'eligible', consent: true, campaignId: 'camp-003' },
  { id: 'con-007', name: 'Vikram Singh', phone: '+91 32109 87654', language: 'Hindi', status: 'suppressed', consent: true },
  { id: 'con-008', name: 'Ananya Das', phone: '+91 21098 76543', email: 'ananya@email.com', language: 'Bengali', status: 'eligible', consent: true, campaignId: 'camp-004' },
];

export const callRecords: CallRecord[] = [
  { id: 'call-001', campaignId: 'camp-001', campaignName: 'KYC Verification Drive', contactName: 'Rajesh Kumar', phone: '+91 98765 43210', status: 'completed', disposition: 'data_collected', confirmed: true, duration: 245, startedAt: '2026-04-02 10:30', language: 'Hindi', fieldsCollected: 4, fieldsTotal: 4 },
  { id: 'call-002', campaignId: 'camp-001', campaignName: 'KYC Verification Drive', contactName: 'Priya Sharma', phone: '+91 87654 32109', status: 'completed', disposition: 'data_collected', confirmed: true, duration: 198, startedAt: '2026-04-02 10:35', language: 'Hindi', fieldsCollected: 4, fieldsTotal: 4 },
  { id: 'call-003', campaignId: 'camp-001', campaignName: 'KYC Verification Drive', contactName: 'Amit Verma', phone: '+91 99887 76655', status: 'no_answer', disposition: 'no_answer', confirmed: false, duration: 0, startedAt: '2026-04-02 10:40', language: 'Hindi', fieldsCollected: 0, fieldsTotal: 4 },
  { id: 'call-004', campaignId: 'camp-002', campaignName: 'Insurance Renewal', contactName: 'Lakshmi Iyer', phone: '+91 65432 10987', status: 'completed', disposition: 'data_collected', confirmed: true, duration: 156, startedAt: '2026-04-02 11:00', language: 'Tamil', fieldsCollected: 2, fieldsTotal: 2 },
  { id: 'call-005', campaignId: 'camp-002', campaignName: 'Insurance Renewal', contactName: 'Suresh M', phone: '+91 88776 65544', status: 'transferred', disposition: 'human_transfer', confirmed: false, duration: 320, startedAt: '2026-04-02 11:05', language: 'Tamil', fieldsCollected: 1, fieldsTotal: 2 },
  { id: 'call-006', campaignId: 'camp-001', campaignName: 'KYC Verification Drive', contactName: 'Deepa Nair', phone: '+91 77665 54433', status: 'failed', disposition: 'network_error', confirmed: false, duration: 12, startedAt: '2026-04-02 11:15', language: 'Hindi', fieldsCollected: 0, fieldsTotal: 4 },
  { id: 'call-007', campaignId: 'camp-003', campaignName: 'Loan Eligibility Survey', contactName: 'Sneha Reddy', phone: '+91 43210 98765', status: 'completed', disposition: 'partial_collection', confirmed: false, duration: 180, startedAt: '2026-04-01 14:20', language: 'Telugu', fieldsCollected: 2, fieldsTotal: 5 },
  { id: 'call-008', campaignId: 'camp-004', campaignName: 'Healthcare Appointments', contactName: 'Ananya Das', phone: '+91 21098 76543', status: 'busy', disposition: 'busy', confirmed: false, duration: 0, startedAt: '2026-04-01 09:00', language: 'Bengali', fieldsCollected: 0, fieldsTotal: 3 },
];

export const journeys: Journey[] = [
  { id: 'jrn-001', campaignId: 'camp-001', campaignName: 'KYC Verification Drive', sequence: ['Voice', 'SMS (if unanswered)', 'WhatsApp (if partial)'], status: 'active', totalContacts: 15420, processed: 10382, successRate: 67.3 },
  { id: 'jrn-002', campaignId: 'camp-002', campaignName: 'Insurance Renewal', sequence: ['Voice', 'WhatsApp reminder'], status: 'active', totalContacts: 8930, processed: 4891, successRate: 54.8 },
  { id: 'jrn-003', campaignId: 'camp-003', campaignName: 'Loan Eligibility Survey', sequence: ['Voice', 'SMS reminder', 'WhatsApp summary'], status: 'paused', totalContacts: 22100, processed: 6893, successRate: 31.2 },
  { id: 'jrn-004', campaignId: 'camp-004', campaignName: 'Healthcare Appointments', sequence: ['Voice', 'SMS confirmation'], status: 'completed', totalContacts: 5600, processed: 5600, successRate: 89.4 },
];

export const dashboardStats = {
  totalCampaigns: 5,
  activeCampaigns: 2,
  totalContacts: 52050,
  totalCalls: 38420,
  avgAnswerRate: 79.7,
  avgCompletionRate: 60.7,
  avgConfirmationRate: 72.3,
  optOutRate: 3.2,
  transferRate: 5.8,
  avgHandlingTime: 185,
};

export const dailyCallVolume = [
  { date: 'Mar 28', calls: 1200, answered: 980, completed: 720 },
  { date: 'Mar 29', calls: 1450, answered: 1180, completed: 890 },
  { date: 'Mar 30', calls: 1100, answered: 890, completed: 650 },
  { date: 'Mar 31', calls: 1680, answered: 1390, completed: 1050 },
  { date: 'Apr 01', calls: 1520, answered: 1240, completed: 920 },
  { date: 'Apr 02', calls: 1750, answered: 1450, completed: 1100 },
  { date: 'Apr 03', calls: 1890, answered: 1560, completed: 1200 },
  { date: 'Apr 04', calls: 1620, answered: 1320, completed: 980 },
  { date: 'Apr 05', calls: 1940, answered: 1610, completed: 1280 },
  { date: 'Apr 06', calls: 980, answered: 810, completed: 620 },
];

export const dispositionBreakdown = [
  { name: 'Data Collected', value: 58, fill: 'hsl(var(--chart-1))' },
  { name: 'No Answer', value: 18, fill: 'hsl(var(--chart-3))' },
  { name: 'Partial', value: 12, fill: 'hsl(var(--chart-2))' },
  { name: 'Transferred', value: 6, fill: 'hsl(var(--chart-4))' },
  { name: 'Failed', value: 4, fill: 'hsl(var(--chart-5))' },
  { name: 'Opted Out', value: 2, fill: 'hsl(var(--muted-foreground))' },
];

export const workspaces = [
  { id: 'ws-001', name: 'HDFC Collections', plan: 'Enterprise', members: 24, campaigns: 8 },
  { id: 'ws-002', name: 'Star Health Insurance', plan: 'Business', members: 12, campaigns: 5 },
  { id: 'ws-003', name: 'Bajaj Finserv', plan: 'Enterprise', members: 31, campaigns: 15 },
];
