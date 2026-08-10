import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  return (
    // The landing header used to sit at 60% opacity, which read as a soft edge
    // over a paper-white page. The hero beneath it is now a floodlit court, and
    // a half-transparent light bar over that turned the links low-contrast — so
    // the header is solid everywhere and the dark band starts below it.
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-border/50 backdrop-blur",
        "bg-background/95 supports-[backdrop-filter]:bg-background/80"
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center bg-primary">
            <span className="text-sm font-bold text-primary-foreground">T</span>
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">
            Tennis AI
          </span>
        </Link>

        {isLanding && (
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#pricing" className="hover:text-foreground">Access</a>
          </nav>
        )}

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Sign In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
