import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  Users,
  UserPlus,
  Wallet,
  Package,
  Bell,
  Settings,
  Brain,
  LogOut,
  Shield,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
  badge?: string;
}

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/calendar", label: "Calendar", icon: <Calendar className="h-4 w-4" /> },
  { to: "/tournaments", label: "Tournaments", icon: <Trophy className="h-4 w-4" /> },
  { to: "/connections", label: "Connections", icon: <UserPlus className="h-4 w-4" /> },
  { to: "/teams", label: "Teams", icon: <Users className="h-4 w-4" />, roles: ["coach"] },
  { to: "/finance", label: "Finance", icon: <Wallet className="h-4 w-4" />, roles: ["player", "observer"] },
  { to: "/equipment", label: "Equipment", icon: <Package className="h-4 w-4" />, roles: ["player", "coach"] },
  { to: "/ai-insights", label: "AI Insights", icon: <Brain className="h-4 w-4" />, roles: ["player", "coach"] },
  { to: "/notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
  { to: "/admin", label: "Admin", icon: <Shield className="h-4 w-4" />, roles: ["admin"] },
  { to: "/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visibleItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:block">
        <div className="flex h-14 items-center gap-2 border-b border-border px-6">
          <span className="text-lg font-bold tracking-tight text-foreground">TennisAI</span>
          {user?.role === "observer" && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" /> Read-only
            </span>
          )}
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-border p-4">
          <div className="mb-3 flex items-center gap-3 px-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs capitalize text-muted-foreground">{user?.role}</p>
            </div>
            <ThemeToggle />
          </div>
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4 md:hidden">
          <span className="text-lg font-bold text-foreground">TennisAI</span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
