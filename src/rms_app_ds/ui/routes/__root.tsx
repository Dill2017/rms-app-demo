import { ThemeProvider } from "@/components/apx/theme-provider";
import { ModeToggle } from "@/components/apx/mode-toggle";
import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import {
  LayoutDashboard,
  Hotel,
  Building2,
  Target,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootLayout,
});

function NavLink({
  to,
  children,
  icon: Icon,
}: {
  to: string;
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const router = useRouterState();
  const isActive =
    to === "/" ? router.location.pathname === "/" : router.location.pathname.startsWith(to);

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}

function RootLayout() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="apx-ui-theme">
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4 gap-4">
            <Link to="/" className="flex items-center gap-2 mr-4">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg hidden sm:block">
                Hotel RMS
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              <NavLink to="/guide" icon={BookOpen}>
                Guide
              </NavLink>
              <NavLink to="/opportunities" icon={Target}>
                Opportunities
              </NavLink>
              <NavLink to="/dashboard" icon={LayoutDashboard}>
                Dashboard
              </NavLink>
              <NavLink to="/hotels" icon={Hotel}>
                Hotels
              </NavLink>
              <NavLink to="/explore" icon={Sparkles}>
                Explore
              </NavLink>
            </nav>

            <div className="flex-1" />
            <ModeToggle />
          </div>
        </header>

        <main>
          <Outlet />
        </main>
      </div>
      <Toaster richColors />
    </ThemeProvider>
  );
}
