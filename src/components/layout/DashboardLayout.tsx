import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  isAdmin?: boolean;
}

export function DashboardLayout({ children, isAdmin = false }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background relative">
      {/* Cyber grid background */}
      <div className="fixed inset-0 cyber-grid-fade pointer-events-none" />
      
      {/* Ambient glow effects */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-80 h-80 bg-primary/3 rounded-full blur-[100px] pointer-events-none" />
      
      <Sidebar isAdmin={isAdmin} />
      <main className="flex-1 overflow-auto relative z-10">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
