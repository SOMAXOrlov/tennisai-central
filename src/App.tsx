import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/auth/AuthContext";
import { ConnectionProvider } from "@/store/ConnectionStore";
import { RouteGuard, GuestGuard } from "@/auth/RouteGuard";

// Layouts
import { PublicLayout } from "@/layouts/PublicLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { DashboardLayout } from "@/layouts/DashboardLayout";

// Public pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Auth pages
import LoginPage from "./pages/auth/LoginPage";
import SignUpPage from "./pages/auth/SignUpPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";

// Dashboard pages
import DashboardRedirect from "./pages/DashboardRedirect";
import PlayerDashboard from "./pages/dashboard/PlayerDashboard";
import CoachDashboard from "./pages/dashboard/CoachDashboard";
import ObserverDashboard from "./pages/dashboard/ObserverDashboard";
import AdminDashboard from "./pages/dashboard/AdminDashboard";

// Feature pages
import CalendarPage from "./pages/CalendarPage";
import TournamentsPage from "./pages/TournamentsPage";
import TournamentDetailPage from "./pages/TournamentDetailPage";
import ConnectionsPage from "./pages/ConnectionsPage";
import TeamsPage from "./pages/TeamsPage";
import FinancePage from "./pages/FinancePage";
import EquipmentPage from "./pages/EquipmentPage";
import AIInsightsPage from "./pages/AIInsightsPage";
import NotificationsPage from "./pages/NotificationsPage";
import NotificationSettingsPage from "./pages/NotificationSettingsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <ConnectionProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Index />} />
              </Route>

              {/* Auth routes (guest only) */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<GuestGuard><LoginPage /></GuestGuard>} />
                <Route path="/signup" element={<GuestGuard><SignUpPage /></GuestGuard>} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<GuestGuard><ForgotPasswordPage /></GuestGuard>} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
              </Route>

              {/* Protected dashboard routes */}
              <Route element={<RouteGuard><DashboardLayout /></RouteGuard>}>
                <Route path="/dashboard" element={<DashboardRedirect />} />
                <Route path="/dashboard/player" element={<RouteGuard allowedRoles={["player"]}><PlayerDashboard /></RouteGuard>} />
                <Route path="/dashboard/coach" element={<RouteGuard allowedRoles={["coach"]}><CoachDashboard /></RouteGuard>} />
                <Route path="/dashboard/observer" element={<RouteGuard allowedRoles={["observer"]}><ObserverDashboard /></RouteGuard>} />
                <Route path="/dashboard/admin" element={<RouteGuard allowedRoles={["admin"]}><AdminDashboard /></RouteGuard>} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/tournaments" element={<TournamentsPage />} />
                <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
                <Route path="/connections" element={<ConnectionsPage />} />
                <Route path="/teams" element={<RouteGuard allowedRoles={["coach"]}><TeamsPage /></RouteGuard>} />
                <Route path="/finance" element={<RouteGuard allowedRoles={["player", "observer"]}><FinancePage /></RouteGuard>} />
                <Route path="/equipment" element={<RouteGuard allowedRoles={["player", "coach"]}><EquipmentPage /></RouteGuard>} />
                <Route path="/ai-insights" element={<RouteGuard allowedRoles={["player", "coach"]}><AIInsightsPage /></RouteGuard>} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/notifications/settings" element={<NotificationSettingsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/admin" element={<RouteGuard allowedRoles={["admin"]}><AdminPage /></RouteGuard>} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </TooltipProvider>
        </ConnectionProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
