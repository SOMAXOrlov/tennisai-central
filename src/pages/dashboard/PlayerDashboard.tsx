// TODO: Build full player dashboard with overview cards, calendar preview, etc.
export default function PlayerDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Player Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your overview.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["My Player ID", "Pending Requests", "Upcoming Trainings", "Tournaments"].map((title) => (
          <div key={title} className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <p className="mt-2 text-2xl font-bold text-foreground">—</p>
          </div>
        ))}
      </div>
    </div>
  );
}
