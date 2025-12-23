import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  ListTodo, 
  Scissors,
  Package,
  Target,
  LogOut,
  ArrowLeftRight,
  Users,
  FileEdit,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

function CoursesDropdown() {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname.startsWith('/courses');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex flex-col items-center justify-center gap-1 p-3 rounded-xl transition-all w-full',
            'border border-border/50',
            isActive
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground'
          )}
        >
          <div className="relative">
            <BookOpen className="w-5 h-5" />
            <ChevronDown className="w-3 h-3 absolute -right-3 -bottom-0.5" />
          </div>
          <span className="text-[10px] font-medium leading-tight text-center">Courses</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-48 bg-background border border-border z-50">
        <DropdownMenuItem 
          onClick={() => navigate('/courses/hair-system')}
          className={cn(
            'cursor-pointer',
            location.pathname === '/courses/hair-system' && 'bg-primary/10 text-primary'
          )}
        >
          <Scissors className="w-4 h-4 mr-2" />
          Hair System Training
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => navigate('/courses/business')}
          className={cn(
            'cursor-pointer',
            location.pathname === '/courses/business' && 'bg-primary/10 text-primary'
          )}
        >
          <Target className="w-4 h-4 mr-2" />
          Business Mastery
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MobileNav({ isAdminView = false }: MobileNavProps) {
  const navigate = useNavigate();
  const { isAdmin: userIsAdmin } = useAuth();

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
    { to: '/training', icon: Target, label: 'Games' },
    { to: '/order-hair-system', icon: Scissors, label: 'Order Hair' },
    { to: '/products', icon: Package, label: 'Products' },
  ];

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Overview' },
    { to: '/admin/members', icon: Users, label: 'Members' },
    { to: '/admin/courses', icon: FileEdit, label: 'Courses' },
    { to: '/admin/todos', icon: ListTodo, label: 'Todos' },
    { to: '/admin/products', icon: Package, label: 'Products' },
  ];

  const links = isAdminView ? adminLinks : memberLinks;

  return (
    <div className="md:hidden bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
      {/* Navigation Grid */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {!isAdminView && (
          <>
            <NavButton to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <CoursesDropdown />
            {memberLinks.map((link) => (
              <NavButton key={link.to} {...link} />
            ))}
          </>
        )}
        {isAdminView && adminLinks.map((link) => (
          <NavButton key={link.to} {...link} />
        ))}
      </div>

      {/* Bottom row: Admin switch + Sign out */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        {userIsAdmin && (
          isAdminView ? (
            <NavButton to="/dashboard" icon={ArrowLeftRight} label="Member View" />
          ) : (
            <NavButton to="/admin" icon={ArrowLeftRight} label="Admin Panel" />
          )
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
  );
}