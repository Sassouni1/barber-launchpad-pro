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
  ChevronDown,
  Cpu,
  Target,
  ArrowLeftRight, // kept for potential future use
  Eye,
  EyeOff,
  GraduationCap,
  Briefcase,
  CalendarCheck,
  Phone,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useCourses } from '@/hooks/useCourses';
import { Level1CertModal } from '@/components/certification/Level1CertModal';
import { ViewSwitcher } from '@/components/layout/ViewSwitcher';

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

interface ExpandableNavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function ExpandableNavItem({ icon: Icon, label, collapsed, children, defaultOpen = false }: ExpandableNavItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const location = useLocation();
  const isChildActive = location.pathname.includes('/courses');

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          'flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-300 group relative',
          isChildActive 
            ? 'bg-primary/10 text-primary border border-primary/30 gold-glow-subtle' 
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent'
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className={cn('w-5 h-5 flex-shrink-0 transition-all', isChildActive && 'text-primary')} />
          {!collapsed && (
            <span className="font-medium text-sm">{label}</span>
          )}
        </div>
        {!collapsed && (
          <ChevronDown className={cn(
            'w-4 h-4 transition-transform duration-200',
            isOpen && 'rotate-180'
          )} />
        )}
        {isChildActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 gold-gradient rounded-r-full" />
        )}
      </CollapsibleTrigger>
      {!collapsed && (
        <CollapsibleContent className="pl-4 mt-1 space-y-1">
          {children}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function SubNavItem({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');

  return (
    <NavLink
      to={to}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-300 group relative',
        isActive 
          ? 'bg-primary/10 text-primary border border-primary/30' 
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent'
      )}
    >
      <Icon className={cn('w-4 h-4 flex-shrink-0 transition-all', isActive && 'text-primary')} />
      <span className="font-medium text-sm">{label}</span>
    </NavLink>
  );
}

interface SidebarProps {
  isAdminView?: boolean;
}

export function Sidebar({ isAdminView = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin: userIsAdmin, isAdminModeActive, toggleAdminMode } = useAuth();
  
  // Fetch courses to determine which categories have published content
  const { data: courses = [] } = useCourses();
  
  // Check if categories have any published courses
  const hasHairSystemCourses = courses.some(course => (course as any).category === 'hair-system');
  const hasBusinessCourses = courses.some(course => (course as any).category === 'business');

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
        {isAdminView ? (
          links.map((link) => (
            <NavItem key={link.to} {...link} collapsed={collapsed} />
          ))
        ) : (
          <>
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} />
            <ExpandableNavItem icon={BookOpen} label="Courses" collapsed={collapsed} defaultOpen>
              {hasHairSystemCourses && (
                <SubNavItem to="/courses/hair-system" icon={GraduationCap} label="Hair System Training" />
              )}
              {hasBusinessCourses && (
                <SubNavItem to="/courses/business" icon={Briefcase} label="Business Mastery" />
              )}
            </ExpandableNavItem>
            <NavItem to="/training" icon={Target} label="Training Games" collapsed={collapsed} />
            <NavItem to="/order-hair-system" icon={Scissors} label="Order Hair System" collapsed={collapsed} />
            <NavItem to="/products" icon={Package} label="Products" collapsed={collapsed} />
            <NavItem to="/orders" icon={Package} label="My Orders" collapsed={collapsed} />
            <ExpandableNavItem icon={Phone} label="Barber Launch Calls" collapsed={collapsed}>
              <SubNavItem to="/schedule-call" icon={CalendarCheck} label="Schedule Call 1 on 1" />
            </ExpandableNavItem>
            
            {/* Level 1 Cert Button */}
            <button
              onClick={() => setIsCertModalOpen(true)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group relative w-full',
                'text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent'
              )}
            >
              <Award className="w-5 h-5 flex-shrink-0 transition-all" />
              {!collapsed && (
                <span className="font-medium text-sm">Level 1 Cert</span>
              )}
            </button>
          </>
        )}
        
        {/* View Switcher for admins */}
        {userIsAdmin && isAdminModeActive && (
          <ViewSwitcher collapsed={collapsed} isAdminView={isAdminView} />
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
      
      {/* Level 1 Cert Modal */}
      <Level1CertModal 
        isOpen={isCertModalOpen} 
        onClose={() => setIsCertModalOpen(false)} 
      />
    </aside>
  );
}
