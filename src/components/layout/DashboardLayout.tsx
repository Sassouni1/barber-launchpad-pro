import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

interface DashboardLayoutProps {
  children: React.ReactNode;
  isAdminView?: boolean;
}

export function DashboardLayout({ children, isAdminView = false }: DashboardLayoutProps) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background relative">
      {/* Cyber grid background - hidden on mobile for performance */}
      <div className="fixed inset-0 cyber-grid-fade pointer-events-none hidden md:block" />
      
      {/* Ambient glow effects - hidden on mobile for performance */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[80px] pointer-events-none hidden md:block" />
      <div className="fixed bottom-0 right-1/4 w-80 h-80 bg-primary/3 rounded-full blur-[80px] pointer-events-none hidden md:block" />
      
      {/* Mobile Navigation - shown at top on mobile */}
      <MobileNav isAdminView={isAdminView} />
      
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar isAdminView={isAdminView} />
      </div>
      
      <main className="flex-1 overflow-visible relative z-10">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
