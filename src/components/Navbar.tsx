import { ThemeToggle } from "@/components/ThemeToggle";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <span className="text-lg font-bold tracking-tight text-foreground">
          TennisAI
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
