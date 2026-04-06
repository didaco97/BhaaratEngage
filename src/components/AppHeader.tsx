import { Bell, Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/campaigns': 'Campaigns',
  '/campaigns/new': 'New Campaign',
  '/contacts': 'Contacts',
  '/journeys': 'Journeys',
  '/call-records': 'Call Records',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export default function AppHeader() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'BharatVaani Engage';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-6">
      <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns, contacts..."
            className="w-64 pl-9 bg-muted/50 border-none text-sm"
          />
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -right-1 -top-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
            3
          </Badge>
        </Button>

        <Button variant="ghost" size="icon" className="rounded-full bg-primary/10">
          <User className="h-4 w-4 text-primary" />
        </Button>
      </div>
    </header>
  );
}
