import { Eye } from "lucide-react";

// TODO: Build full observer dashboard
export default function ObserverDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Observer Dashboard</h1>
          <p className="text-muted-foreground">View your connected player's progress.</p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          <Eye className="h-3 w-3" /> Read-only
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["Connected Players", "Calendar Events", "Tournaments", "Finance Summary"].map((title) => (
          <div key={title} className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <p className="mt-2 text-2xl font-bold text-foreground">—</p>
          </div>
        ))}
      </div>
    </div>
  );
}
