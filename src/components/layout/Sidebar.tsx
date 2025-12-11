import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  ListTodo, 
  Settings, 
  Users, 
  FileEdit,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

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
          ? 'bg-primary/10 text-primary border border-primary/20' 
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
      )}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-primary')} />
      {!collapsed && (
        <span className="font-medium">{label}</span>
      )}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 gold-gradient rounded-r-full" />
      )}
    </NavLink>
  );
}

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const memberLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/courses', icon: BookOpen, label: 'Courses' },
    { to: '/todos', icon: ListTodo, label: 'To-Do Lists' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Overview' },
    { to: '/admin/members', icon: Users, label: 'Members' },
    { to: '/admin/courses', icon: FileEdit, label: 'Course Builder' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  const links = isAdmin ? adminLinks : memberLinks;

  return (
    <aside 
      className={cn(
        'h-screen glass-card border-r border-border/30 flex flex-col transition-all duration-300',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      <div className="p-6 border-b border-border/30">
        {collapsed ? (
          <div className="w-10 h-10 gold-gradient rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-display font-bold text-lg">BL</span>
          </div>
        ) : (
          <Logo />
        )}
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {links.map((link) => (
          <NavItem key={link.to} {...link} collapsed={collapsed} />
        ))}
      </nav>

      <div className="p-4 border-t border-border/30 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </Button>
        
        <button className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all duration-300',
          'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
        )}>
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="font-medium">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
