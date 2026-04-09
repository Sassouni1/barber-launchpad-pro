import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import Lesson from "./pages/Lesson";
import LessonLegacyRedirect from "./pages/LessonLegacyRedirect";
import Todos from "./pages/Todos";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Members from "./pages/admin/Members";
import CourseBuilder from "./pages/admin/CourseBuilder";
import TodosManager from "./pages/admin/TodosManager";
import ProductsManager from "./pages/admin/ProductsManager";
import TemplateSubmissions from "./pages/admin/TemplateSubmissions";
import Feedback from "./pages/admin/Feedback";
import AionPage from "./pages/AionPage";
import Login from "./pages/Login";
import SignIn from "./pages/SignIn";
import CreateAccount from "./pages/CreateAccount";
import NotFound from "./pages/NotFound";
import OrderHairSystem from "./pages/OrderHairSystem";
import Products from "./pages/Products";
import Training from "./pages/Training";
import LiveCalls from "./pages/LiveCalls";
import Agreement from "./pages/Agreement";
import ScheduleCall from "./pages/ScheduleCall";
import Orders from "./pages/Orders";
import ManufacturerOrders from "./pages/ManufacturerOrders";
import Marketing from "./pages/Marketing";

import Rewards from "./pages/Rewards";
import RewardsJoin from "./pages/RewardsJoin";
import QRRedirect from "./pages/QRRedirect";
import CardView from "./pages/CardView";
import BusinessCardSetup from "./pages/BusinessCardSetup";
import HairSystemChecklist from "./pages/HairSystemChecklist";
import GHLCallback from "./pages/GHLCallback";
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
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/create" element={<CreateAccount />} />
            <Route path="/agreement" element={<ProtectedRoute skipAgreementCheck><Agreement /></ProtectedRoute>} />
            <Route path="/auth" element={<Navigate to="/login" replace />} />
            
            {/* Protected Member Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/courses" element={<Navigate to="/courses/hair-system" replace />} />
            <Route path="/courses/hair-system" element={<ProtectedRoute><Courses courseType="hair-system" /></ProtectedRoute>} />
            <Route path="/courses/business" element={<ProtectedRoute><Courses courseType="business" /></ProtectedRoute>} />
            <Route path="/courses/:courseType/lesson/:lessonId" element={<ProtectedRoute><Lesson /></ProtectedRoute>} />
            <Route path="/courses/lesson/:lessonId" element={<ProtectedRoute><Lesson /></ProtectedRoute>} />
            <Route path="/lesson/:lessonId" element={<ProtectedRoute><LessonLegacyRedirect /></ProtectedRoute>} />
            <Route path="/todos" element={<ProtectedRoute><Todos /></ProtectedRoute>} />
            <Route path="/order-hair-system" element={<ProtectedRoute><OrderHairSystem /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
            <Route path="/live-calls" element={<ProtectedRoute><LiveCalls /></ProtectedRoute>} />
            <Route path="/schedule-call" element={<ProtectedRoute><ScheduleCall /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/marketing" element={<ProtectedRoute><Marketing /></ProtectedRoute>} />
            <Route path="/aion" element={<ProtectedRoute><AionPage /></ProtectedRoute>} />
            
            <Route path="/rewards" element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
            <Route path="/checklist" element={<ProtectedRoute><HairSystemChecklist /></ProtectedRoute>} />
            <Route path="/checklist/:listId" element={<ProtectedRoute><HairSystemChecklist /></ProtectedRoute>} />
            <Route path="/rewards/join/:userId" element={<RewardsJoin />} />
            <Route path="/r/:shortCode" element={<QRRedirect />} />
            <Route path="/integrations/ghl/callback" element={<GHLCallback />} />
            <Route path="/card/:shortCode" element={<CardView />} />
            <Route path="/business-card" element={<ProtectedRoute><BusinessCardSetup /></ProtectedRoute>} />
            <Route path="/newtimes" element={<ProtectedRoute requireManufacturer><ManufacturerOrders /></ProtectedRoute>} />
            
            {/* Protected Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/members" element={<ProtectedRoute requireAdmin><Members /></ProtectedRoute>} />
            <Route path="/admin/courses" element={<ProtectedRoute requireAdmin><CourseBuilder /></ProtectedRoute>} />
            <Route path="/admin/todos" element={<ProtectedRoute requireAdmin><TodosManager /></ProtectedRoute>} />
            <Route path="/admin/products" element={<ProtectedRoute requireAdmin><ProductsManager /></ProtectedRoute>} />
            <Route path="/admin/templates" element={<ProtectedRoute requireAdmin><TemplateSubmissions /></ProtectedRoute>} />
            <Route path="/admin/feedback" element={<ProtectedRoute requireAdmin><Feedback /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
