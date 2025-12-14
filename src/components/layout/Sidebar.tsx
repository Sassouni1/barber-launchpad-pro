import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  ListTodo, 
  Settings, 
  Users, 
  FileEdit,
  Scissors,
  Package,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Target,
  ArrowLeftRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';

interface NavItemProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
}

function NavItem({ to, icon: Icon, label, collapsed }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');

  return (
    <NavLink
      to={to}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group relative',
        isActive 
          ? 'bg-primary/10 text-primary border border-primary/30 gold-glow-subtle' 
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent'
      )}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0 transition-all', isActive && 'text-primary')} />
      {!collapsed && (
        <span className="font-medium text-sm">{label}</span>
      )}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 gold-gradient rounded-r-full" />
      )}
    </NavLink>
  );
}

interface SidebarProps {
  isAdminView?: boolean;
}

export function Sidebar({ isAdminView = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { isAdmin: userIsAdmin, isAdminModeActive, toggleAdminMode } = useAuth();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Signed out successfully');
      navigate('/login');
    } catch (error: any) {
      toast.error('Error signing out');
    }
  };

  const memberLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/courses', icon: BookOpen, label: 'Courses' },
    { to: '/training', icon: Target, label: 'Training Games' },
    // { to: '/todos', icon: ListTodo, label: 'To-Do Lists' },
    { to: '/order-hair-system', icon: Scissors, label: 'Order Hair System' },
    { to: '/products', icon: Package, label: 'Products' },
  ];

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Overview' },
    { to: '/admin/members', icon: Users, label: 'Members' },
    { to: '/admin/courses', icon: FileEdit, label: 'Course Builder' },
    { to: '/admin/todos', icon: ListTodo, label: 'Todos Manager' },
    { to: '/admin/products', icon: Package, label: 'Products Manager' },
  ];

  const links = isAdminView ? adminLinks : memberLinks;

  return (
    <aside 
      className={cn(
        'h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 relative',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border relative z-10">
        {collapsed ? (
          <div className="w-10 h-10 gold-gradient rounded-lg flex items-center justify-center gold-glow-subtle">
            <span className="text-primary-foreground font-display font-bold text-lg">BL</span>
          </div>
        ) : (
          <Logo />
        )}
      </div>

      {/* System status */}
      {!collapsed && (
        <div className="px-6 py-4 border-b border-sidebar-border relative z-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="w-3.5 h-3.5 text-primary" />
            <span className="uppercase tracking-wider">System Status</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="relative w-2 h-2">
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75" />
              <div className="relative w-2 h-2 bg-green-500 rounded-full" />
            </div>
            <span className="text-xs text-green-500 font-medium">All Systems Operational</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 relative z-10">
        <div className="text-xs text-muted-foreground uppercase tracking-wider px-4 mb-3">
          {!collapsed && 'Navigation'}
        </div>
        {links.map((link) => (
          <NavItem key={link.to} {...link} collapsed={collapsed} />
        ))}
        
        {/* Switch view link for admins */}
        {userIsAdmin && isAdminModeActive && (
          isAdminView ? (
            <NavItem 
              to="/dashboard" 
              icon={ArrowLeftRight} 
              label="Member View" 
              collapsed={collapsed} 
            />
          ) : (
            <NavItem 
              to="/admin" 
              icon={ArrowLeftRight} 
              label="Admin Panel" 
              collapsed={collapsed} 
            />
          )
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-2 relative z-10">
        {/* Admin Mode Toggle */}
        {userIsAdmin && !collapsed && (
          <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2">
              {isAdminModeActive ? (
                <Eye className="w-4 h-4 text-primary" />
              ) : (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-xs font-medium">
                {isAdminModeActive ? 'Admin Mode' : 'User Mode'}
              </span>
            </div>
            <Switch 
              checked={isAdminModeActive} 
              onCheckedChange={toggleAdminMode}
              className="scale-75"
            />
          </div>
        )}
        {userIsAdmin && collapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAdminMode}
            className={cn(
              "w-full justify-center",
              isAdminModeActive ? "text-primary" : "text-muted-foreground"
            )}
            title={isAdminModeActive ? 'Admin Mode ON' : 'User Mode'}
          >
            {isAdminModeActive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </Button>
        
        <button 
          onClick={handleSignOut}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all duration-300',
            'text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/30'
          )}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="font-medium text-sm">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
