import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Shield, Users, Factory, ChevronDown, User, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';

interface ViewSwitcherProps {
  collapsed: boolean;
  isAdminView: boolean;
}

function useMembersList() {
  return useQuery({
    queryKey: ['view-switcher-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function ViewSwitcher({ collapsed, isAdminView }: ViewSwitcherProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const { data: members = [], isLoading } = useMembersList();

  const currentView = isAdminView ? 'admin' : 'member';

  const filteredMembers = members.filter(m =>
    m.full_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const handleViewChange = (view: 'admin' | 'member' | 'supplier') => {
    setOpen(false);
    if (view === 'admin') {
      navigate('/admin');
    } else if (view === 'member') {
      navigate('/dashboard');
    } else if (view === 'supplier') {
      navigate('/newtimes');
    }
  };

  const handleMemberSelect = () => {
    setOpen(false);
    setMemberPickerOpen(true);
  };

  const handleImpersonate = async (userId: string, name: string) => {
    setImpersonating(userId);
    try {
      const { data, error } = await supabase.functions.invoke('impersonate-user', {
        body: { target_user_id: userId },
      });
      if (error) throw error;
      if (!data?.access_token || !data?.refresh_token) {
        throw new Error(data?.error || 'Invalid response from server');
      }

      // Set the new session directly
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw sessionError;

      toast.success(`Switching to ${name}...`);
      setMemberPickerOpen(false);

      // Full reload to pick up the new session everywhere
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast.error(err.message || 'Failed to view as user');
      setImpersonating(null);
    }
  };

  const viewLabel = currentView === 'admin' ? 'Admin' : 'Member';
  const ViewIcon = currentView === 'admin' ? Shield : Users;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 w-full',
              'text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent hover:border-primary/20'
            )}
          >
            <Eye className="w-5 h-5 flex-shrink-0 text-primary" />
            {!collapsed && (
              <>
                <span className="font-medium text-sm flex-1 text-left">View: {viewLabel}</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          className="w-56 p-2 bg-popover border-border"
        >
          <div className="space-y-1">
            <button
              onClick={() => handleViewChange('admin')}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all',
                currentView === 'admin'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              <Shield className="w-4 h-4" />
              <span className="font-medium">Admin</span>
            </button>

            <button
              onClick={() => handleViewChange('member')}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all',
                currentView === 'member'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              <Users className="w-4 h-4" />
              <span className="font-medium">Member</span>
              <span className="text-xs text-muted-foreground ml-auto">(general)</span>
            </button>

            <button
              onClick={handleMemberSelect}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all pl-10"
            >
              <User className="w-4 h-4" />
              <span className="font-medium">Specific Member</span>
              <ExternalLink className="w-3 h-3 ml-auto" />
            </button>

            <div className="border-t border-border my-1" />

            <button
              onClick={() => handleViewChange('supplier')}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
            >
              <Factory className="w-4 h-4" />
              <span className="font-medium">Supplier</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Member Picker Dialog */}
      <Dialog open={memberPickerOpen} onOpenChange={setMemberPickerOpen}>
        <DialogContent className="glass-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">View as Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search by name or email..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="bg-secondary/50"
            />
            <ScrollArea className="h-72">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Loading members...</p>
              ) : filteredMembers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No members found</p>
              ) : (
                <div className="space-y-1">
                  {filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleImpersonate(member.id, member.full_name || member.email || 'User')}
                      disabled={impersonating === member.id}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary/50 transition-all disabled:opacity-50"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={member.avatar_url || ''} />
                        <AvatarFallback className="text-xs">
                          {member.full_name?.charAt(0) || member.email?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left flex-1 min-w-0">
                        <p className="font-medium truncate">{member.full_name || 'No Name'}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
