import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import Lesson from "./pages/Lesson";
import Todos from "./pages/Todos";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Members from "./pages/admin/Members";
import CourseBuilder from "./pages/admin/CourseBuilder";
import TodosManager from "./pages/admin/TodosManager";
import ProductsManager from "./pages/admin/ProductsManager";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import OrderHairSystem from "./pages/OrderHairSystem";
import Products from "./pages/Products";
import Training from "./pages/Training";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected Member Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
            <Route path="/courses/lesson/:lessonId" element={<ProtectedRoute><Lesson /></ProtectedRoute>} />
            <Route path="/todos" element={<ProtectedRoute><Todos /></ProtectedRoute>} />
            <Route path="/order-hair-system" element={<ProtectedRoute><OrderHairSystem /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
            
            {/* Protected Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/members" element={<ProtectedRoute requireAdmin><Members /></ProtectedRoute>} />
            <Route path="/admin/courses" element={<ProtectedRoute requireAdmin><CourseBuilder /></ProtectedRoute>} />
            <Route path="/admin/todos" element={<ProtectedRoute requireAdmin><TodosManager /></ProtectedRoute>} />
            <Route path="/admin/products" element={<ProtectedRoute requireAdmin><ProductsManager /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
