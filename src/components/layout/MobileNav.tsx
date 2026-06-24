import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Bot, CreditCard, Menu, ChevronDown, ChevronRight } from 'lucide-react';
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
  Megaphone,
  Eye,
  Shield,
  Factory,
  User,
  ExternalLink,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useIsNewAccount } from '@/hooks/useIsNewAccount';
import { useTrainingGamesUnlocked } from '@/hooks/useTrainingGamesUnlocked';
import { useChecklistLists } from '@/hooks/useChecklistLists';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Logo } from '@/components/ui/Logo';

interface MobileNavProps {
  isAdminView?: boolean;
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

function NavRow({ to, icon: Icon, label, onClick }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all text-sm font-medium',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
        )
      }
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </NavLink>
  );
}

export function MobileNav({ isAdminView = false }: MobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin: userIsAdmin, isManufacturer } = useAuth();
  const isNewAccount = useIsNewAccount();
  const { unlocked: allQuizzesPassed } = useTrainingGamesUnlocked();
  const restrictNav = isNewAccount && !allQuizzesPassed;
  const hideStartHere = !isNewAccount;

  
  const isManufacturerView = location.pathname === '/newtimes' || (isManufacturer && !userIsAdmin);
  const [viewOpen, setViewOpen] = useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const { data: members = [], isLoading } = useMobileMembers();
  const [menuOpen, setMenuOpen] = useState(false);

  const [checklistsOpen, setChecklistsOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [marketingOpen, setMarketingOpen] = useState(false);
  const { data: checklistLists = [] } = useChecklistLists();

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

  const closeMenu = () => setMenuOpen(false);

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Overview' },
    { to: '/admin/members', icon: Users, label: 'Members' },
    { to: '/admin/courses', icon: FileEdit, label: 'Courses' },
    { to: '/admin/todos', icon: ListTodo, label: 'Todos' },
    { to: '/admin/products', icon: Package, label: 'Products' },
  ];

  const currentViewLabel = isAdminView ? 'Admin' : 'Member';

  // Manufacturer-only (non-admin): show minimal top bar
  if (isManufacturerView) {
    return (
      <>
        <div className="md:hidden bg-background/95 backdrop-blur-sm border-b border-border px-4 h-14 flex items-center justify-between">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                <Menu className="w-6 h-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle className="text-left">
                  <Logo size="sm" />
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-auto p-4 space-y-2">
                <NavRow to="/newtimes" icon={Package} label="Orders" onClick={closeMenu} />
                {userIsAdmin && (
                  <>
                    <div className="border-t border-border my-2" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">Switch View</p>
                    <button
                      onClick={() => { closeMenu(); navigate('/admin'); }}
                      className="flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    >
                      <Shield className="w-5 h-5" />
                      <span>Admin</span>
                    </button>
                    <button
                      onClick={() => { closeMenu(); navigate('/dashboard'); }}
                      className="flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    >
                      <Users className="w-5 h-5" />
                      <span>Member</span>
                    </button>
                  </>
                )}
              </div>
              <div className="p-4 border-t border-border">
                <button
                  onClick={() => { closeMenu(); handleSignOut(); }}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
          <Logo size="sm" />
          <div className="w-10" />
        </div>

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

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-background/95 backdrop-blur-sm border-b border-border px-4 h-14 flex items-center justify-between sticky top-0 z-40">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="p-2 -ml-2 rounded-lg hover:bg-secondary/50 transition-colors">
              <Menu className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[340px] p-0 flex flex-col">
            <SheetHeader className="p-4 border-b border-border">
              <SheetTitle className="text-left">
                <Logo size="sm" />
              </SheetTitle>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-1">
                {!isAdminView && (
                  <>
                    {/* Member Links */}
                    {!hideStartHere && (
                      <NavRow to="/start-here" icon={Sparkles} label="Start Here" onClick={closeMenu} />
                    )}
                    <NavRow to="/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={closeMenu} />
                    {!restrictNav && (
                      <>
                        <NavRow to="/courses/hair-system" icon={BookOpen} label="Courses" onClick={closeMenu} />
                        <NavRow to="/training" icon={Target} label="Games" onClick={closeMenu} />
                      </>
                    )}

                    {/* Checklists */}
                    <Collapsible open={checklistsOpen} onOpenChange={setChecklistsOpen}>
                      <CollapsibleTrigger asChild>
                        <button
                          className={cn(
                            'flex items-center justify-between w-full px-3 py-3 rounded-xl transition-all text-sm font-medium',
                            location.pathname.startsWith('/checklist')
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <ClipboardCheck className="w-5 h-5" />
                            <span>Checklists</span>
                          </div>
                          <ChevronDown className={cn('w-4 h-4 transition-transform', checklistsOpen && 'rotate-180')} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4 space-y-1 mt-1">
                        {checklistLists.filter(list => !list.title.toLowerCase().includes('consultation')).map((list) => (
                          <NavLink
                            key={list.id}
                            to={`/checklist/${list.id}`}
                            onClick={closeMenu}
                            className={({ isActive }) => cn(
                              'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all',
                              isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                            )}
                          >
                            <ClipboardCheck className="w-4 h-4" />
                            <span className="font-medium">{list.title.replace(' Checklist', '')}</span>
                          </NavLink>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Order Hair & Products */}
                    <Collapsible open={productsOpen} onOpenChange={setProductsOpen}>
                      <CollapsibleTrigger asChild>
                        <button
                          className={cn(
                            'flex items-center justify-between w-full px-3 py-3 rounded-xl transition-all text-sm font-medium',
                            ['/products', '/order-hair-system', '/orders'].includes(location.pathname)
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Package className="w-5 h-5" />
                            <span>Order Hair & Products</span>
                          </div>
                          <ChevronDown className={cn('w-4 h-4 transition-transform', productsOpen && 'rotate-180')} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4 space-y-1 mt-1">
                        <NavLink to="/order-hair-system" onClick={closeMenu} className={({ isActive }) => cn('flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50')}>
                          <Scissors className="w-4 h-4" />
                          <span className="font-medium">Order Hair System</span>
                        </NavLink>
                        <NavLink to="/products" onClick={closeMenu} className={({ isActive }) => cn('flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50')}>
                          <Package className="w-4 h-4" />
                          <span className="font-medium">Browse Products</span>
                        </NavLink>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Marketing */}
                    {!restrictNav && (
                      <Collapsible open={marketingOpen} onOpenChange={setMarketingOpen}>
                        <CollapsibleTrigger asChild>
                          <button
                            className={cn(
                              'flex items-center justify-between w-full px-3 py-3 rounded-xl transition-all text-sm font-medium',
                              ['/marketing', '/aion', '/business-card', '/social-media-post'].some(p => location.pathname.startsWith(p))
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Megaphone className="w-5 h-5" />
                              <span>Marketing</span>
                            </div>
                            <ChevronDown className={cn('w-4 h-4 transition-transform', marketingOpen && 'rotate-180')} />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4 space-y-1 mt-1">
                          <NavLink to="/aion" onClick={closeMenu} className={({ isActive }) => cn('flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50')}>
                            <Bot className="w-4 h-4" />
                            <span className="font-medium">Ask Aion AI</span>
                          </NavLink>
                          <NavLink to="/marketing" onClick={closeMenu} className={({ isActive }) => cn('flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50')}>
                            <Megaphone className="w-4 h-4" />
                            <span className="font-medium">AI Social Media</span>
                          </NavLink>
                          <NavLink to="/social-media-post" onClick={closeMenu} className={({ isActive }) => cn('flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50')}>
                            <Megaphone className="w-4 h-4" />
                            <span className="font-medium">Hair System Content</span>
                          </NavLink>
                          <NavLink to="/business-card" onClick={closeMenu} className={({ isActive }) => cn('flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50')}>
                            <CreditCard className="w-4 h-4" />
                            <span className="font-medium">Digital Business Card</span>
                          </NavLink>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    <NavRow to="/my-links" icon={CreditCard} label="My Links" onClick={closeMenu} />

                    <div className="border-t border-border my-2" />
                    <NavRow to="/schedule-call" icon={Phone} label="1 on 1 Call" onClick={closeMenu} />
                  </>
                )}

                {isAdminView && adminLinks.map((link) => (
                  <NavRow key={link.to} to={link.to} icon={link.icon} label={link.label} onClick={closeMenu} />
                ))}
              </div>
            </ScrollArea>

            {/* Bottom actions */}
            <div className="p-4 border-t border-border space-y-2">
              {userIsAdmin && (
                <Collapsible open={viewOpen} onOpenChange={setViewOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        'flex items-center justify-between w-full px-3 py-3 rounded-xl transition-all text-sm font-medium',
                        'border border-primary/30 bg-primary/10 text-primary'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Eye className="w-5 h-5" />
                        <span>View: {currentViewLabel}</span>
                      </div>
                      <ChevronDown className={cn('w-4 h-4 transition-transform', viewOpen && 'rotate-180')} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 space-y-1 mt-1">
                    <button
                      onClick={() => { closeMenu(); navigate('/admin'); }}
                      className={cn(
                        'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all',
                        isAdminView ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                      )}
                    >
                      <Shield className="w-4 h-4" />
                      <span className="font-medium">Admin</span>
                    </button>
                    <button
                      onClick={() => { closeMenu(); navigate('/dashboard'); }}
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
                      onClick={() => { closeMenu(); setMemberPickerOpen(true); }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all pl-10"
                    >
                      <User className="w-4 h-4" />
                      <span className="font-medium">Specific Member</span>
                      <ExternalLink className="w-3 h-3 ml-auto" />
                    </button>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => { closeMenu(); navigate('/newtimes'); }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
                    >
                      <Factory className="w-4 h-4" />
                      <span className="font-medium">Supplier</span>
                    </button>
                  </CollapsibleContent>
                </Collapsible>
              )}
              <button
                onClick={() => { closeMenu(); handleSignOut(); }}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <Logo size="sm" />

        {/* Quick actions on right - just keep it clean with nothing or a dashboard shortcut */}
        <div className="w-10" />
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
