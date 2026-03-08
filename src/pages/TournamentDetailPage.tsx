// TODO: Build tournament detail page
import { useParams } from "react-router-dom";

export default function TournamentDetailPage() {
  const { id } = useParams();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Tournament Details</h1>
      <p className="text-muted-foreground">Tournament ID: {id}</p>
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border">
        <p className="text-muted-foreground">Tournament detail view coming soon</p>
      </div>
    </div>
  );
}
