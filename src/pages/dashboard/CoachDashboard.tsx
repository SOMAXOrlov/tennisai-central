// TODO: Build full coach dashboard
export default function CoachDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Coach Dashboard</h1>
        <p className="text-muted-foreground">Manage your players and teams.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["Connected Players", "Pending Requests", "Teams", "Upcoming Trainings"].map((title) => (
          <div key={title} className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <p className="mt-2 text-2xl font-bold text-foreground">—</p>
          </div>
        ))}
      </div>
    </div>
  );
}
