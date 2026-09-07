// ============================================================================
// "Repeat this session" — the commonest real thing a coach does.
//
// Until now the only way to run last week's session again was to retype it. The
// copy carries the plan and the players; it deliberately does NOT carry the
// register, the review, the player's feedback or the analysis, and the dialog
// says so, because a coach who expected the register to come too would find out
// at the worst moment.
//
// The date defaults to a week later, which is what "repeat this" nearly always
// means, and stays editable for the times it does not.
// ============================================================================

import { useState } from "react";
import { CopyPlus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import { useT } from "@/lib/i18n";
import type { TrainingSession } from "@/types";

const LOCAL_DATETIME = "yyyy-MM-dd'T'HH:mm";

/** A week after the session being copied, at the same time of day. */
export function defaultCopyDate(startDate: string): string {
  const start = parseISO(startDate);
  if (Number.isNaN(start.getTime())) return "";
  return format(new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000), LOCAL_DATETIME);
}

export interface DuplicateTrainingDialogProps {
  training: TrainingSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives an ISO instant; the length is carried over by the server. */
  onDuplicate: (startDate: string) => void;
  loading?: boolean;
}

export function DuplicateTrainingDialog({
  training,
  open,
  onOpenChange,
  onDuplicate,
  loading,
}: DuplicateTrainingDialogProps) {
  const { t } = useT();
  const [startDate, setStartDate] = useState(() => defaultCopyDate(training.startDate));

  const valid = Boolean(startDate) && !Number.isNaN(new Date(startDate).getTime());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("session.duplicate.title")}</DialogTitle>
          <DialogDescription>{t("session.duplicate.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="duplicate-start">{t("session.duplicate.startDate")}</Label>
          <Input
            id="duplicate-start"
            type="datetime-local"
            value={startDate}
            disabled={loading}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => onDuplicate(new Date(startDate).toISOString())}
            disabled={!valid || loading}
            className="gap-1.5"
          >
            <CopyPlus className="h-4 w-4" />
            {loading ? t("session.duplicate.creating") : t("session.duplicate.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
