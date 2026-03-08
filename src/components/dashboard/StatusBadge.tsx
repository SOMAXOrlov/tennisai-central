import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  accepted: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  revoked: "bg-muted text-muted-foreground",
  planned: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  registered: "bg-primary/10 text-primary",
  maybe: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  withdrawn: "bg-muted text-muted-foreground",
  played: "bg-primary/10 text-primary",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
        statusStyles[status] || "bg-muted text-muted-foreground",
        className
      )}
    >
      {status}
    </span>
  );
}
