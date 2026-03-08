// TODO: Integrate with GET /api/profile endpoint
import { useAuth } from "@/auth/AuthContext";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { RoleBadge } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PUBLIC_ID_MAP: Record<string, string> = {
  p1: "TAI-P-001",
  c1: "TAI-C-001",
  o1: "TAI-F-001",
  a1: "TAI-A-001",
};

export default function ProfilePage() {
  const { user } = useAuth();
  const publicId = PUBLIC_ID_MAP[user?.id ?? ""] ?? "TAI-X-000";
  const [copied, setCopied] = useState(false);

  const copyId = () => {
    navigator.clipboard.writeText(publicId);
    setCopied(true);
    toast.success("Public ID copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your personal information.</p>
      </div>

      <DashboardCard title="Profile Information" icon={<User className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{user?.firstName} {user?.lastName}</p>
              <div className="flex items-center gap-2 mt-1">
                <RoleBadge role={user?.role ?? "player"} />
                <span className="text-sm text-muted-foreground">{user?.email}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <Label className="text-xs text-muted-foreground">Your Public ID</Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 font-mono text-lg font-bold tracking-wider text-foreground">{publicId}</code>
              <Button variant="outline" size="icon" onClick={copyId}>
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Share this ID so others can connect with you.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>First Name</Label>
              <Input defaultValue={user?.firstName} />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input defaultValue={user?.lastName} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input defaultValue={user?.email} type="email" />
            </div>
          </div>

          <Button>Save Changes</Button>
        </div>
      </DashboardCard>
    </div>
  );
}
