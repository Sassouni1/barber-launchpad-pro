import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  ListTodo, 
  Scissors,
  Package,
  Target,
  LogOut,
  Users,
  FileEdit,
  Phone,
  Eye,
  Shield,
  Factory,
  User,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
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

interface MobileNavProps {
  isAdminView?: boolean;
}

interface NavButtonProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

function NavButton({ to, icon: Icon, label }: NavButtonProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center justify-center gap-1 p-3 rounded-xl transition-all',
          'border border-border/50',
          isActive
            ? 'bg-primary/10 text-primary border-primary/30'
            : 'bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground'
        )
      }
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium leading-tight text-center">{label}</span>
    </NavLink>
  );
}

function useMobileMembers() {
  return useQuery({
    queryKey: ['mobile-view-members'],
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

export function MobileNav({ isAdminView = false }: MobileNavProps) {
  const navigate = useNavigate();
  const { isAdmin: userIsAdmin } = useAuth();
  const [viewOpen, setViewOpen] = useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const { data: members = [], isLoading } = useMobileMembers();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Signed out successfully');
      navigate('/login');
    } catch (error: any) {
      toast.error('Error signing out');
    }
  };

  const filteredMembers = members.filter(m =>
    m.full_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const handleImpersonate = async (userId: string, name: string) => {
    setImpersonating(userId);
    try {
      const { data, error } = await supabase.functions.invoke('impersonate-user', {
        body: { target_user_id: userId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success(`Opening view as ${name}`);
        setMemberPickerOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to view as user');
    } finally {
      setImpersonating(null);
    }
  };

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Overview' },
    { to: '/admin/members', icon: Users, label: 'Members' },
    { to: '/admin/courses', icon: FileEdit, label: 'Courses' },
    { to: '/admin/todos', icon: ListTodo, label: 'Todos' },
    { to: '/admin/products', icon: Package, label: 'Products' },
  ];

  const memberLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/courses/hair-system', icon: BookOpen, label: 'Courses' },
    { to: '/training', icon: Target, label: 'Games' },
    { to: '/order-hair-system', icon: Scissors, label: 'Order Hair' },
    { to: '/products', icon: Package, label: 'Products' },
    { to: '/orders', icon: Package, label: 'Orders' },
    { to: '/schedule-call', icon: Phone, label: '1 on 1 Call' },
  ];

  const currentViewLabel = isAdminView ? 'Admin' : 'Member';

  return (
    <>
      <div className="md:hidden bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        {/* Navigation Grid */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          {!isAdminView && memberLinks.map((link) => (
            <NavButton key={link.to} {...link} />
          ))}
          {isAdminView && adminLinks.map((link) => (
            <NavButton key={link.to} {...link} />
          ))}
        </div>

        {/* Bottom row: View switcher + Sign out */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          {userIsAdmin && (
            <Popover open={viewOpen} onOpenChange={setViewOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 p-3 rounded-xl transition-all',
                    'border border-primary/30 bg-primary/10 text-primary'
                  )}
                >
                  <Eye className="w-5 h-5" />
                  <span className="text-[10px] font-medium flex items-center gap-0.5">
                    View: {currentViewLabel} <ChevronDown className="w-3 h-3" />
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-56 p-2 bg-popover border-border">
                <div className="space-y-1">
                  <button
                    onClick={() => { setViewOpen(false); navigate('/admin'); }}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all',
                      isAdminView ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    )}
                  >
                    <Shield className="w-4 h-4" />
                    <span className="font-medium">Admin</span>
                  </button>
                  <button
                    onClick={() => { setViewOpen(false); navigate('/dashboard'); }}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all',
                      !isAdminView ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    )}
                  >
                    <Users className="w-4 h-4" />
                    <span className="font-medium">Member</span>
                    <span className="text-xs text-muted-foreground ml-auto">(general)</span>
                  </button>
                  <button
                    onClick={() => { setViewOpen(false); setMemberPickerOpen(true); }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all pl-10"
                  >
                    <User className="w-4 h-4" />
                    <span className="font-medium">Specific Member</span>
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </button>
                  <div className="border-t border-border my-1" />
                  <button
                    onClick={() => { setViewOpen(false); navigate('/newtimes'); }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
                  >
                    <Factory className="w-4 h-4" />
                    <span className="font-medium">Supplier</span>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <button
            onClick={handleSignOut}
            className={cn(
              'flex flex-col items-center justify-center gap-1 p-3 rounded-xl transition-all',
              'border border-border/50 bg-card/50 text-muted-foreground',
              'hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30',
              !userIsAdmin && 'col-span-2'
            )}
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-medium">Sign Out</span>
          </button>
        </div>
      </div>

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