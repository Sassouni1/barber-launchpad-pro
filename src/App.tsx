import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/lesson/:lessonId" element={<Lesson />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/order-hair-system" element={<OrderHairSystem />} />
          <Route path="/products" element={<Products />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/members" element={<Members />} />
          <Route path="/admin/courses" element={<CourseBuilder />} />
          <Route path="/admin/todos" element={<TodosManager />} />
          
          <Route path="/admin/products" element={<ProductsManager />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
