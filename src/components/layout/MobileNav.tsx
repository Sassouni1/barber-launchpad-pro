import { NavLink, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

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
    { to: '/courses', icon: BookOpen, label: 'Courses' },
    { to: '/training', icon: Target, label: 'Games' },
    // { to: '/todos', icon: ListTodo, label: 'To-Dos' },
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
      {/* Navigation Grid - 3 columns */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {links.map((link) => (
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
