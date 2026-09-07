// ============================================================================
// Calling a session off — which is NOT the same as deleting it.
//
// This dialog replaces a plain delete confirmation, and the difference is the
// whole point. Cancelling used to be a hard DELETE whose cascade destroyed the
// attendance register, and the players then got a notification about a row that
// no longer existed. A session someone has actually marked is a record: who
// turned up, who did not, what the coach wrote afterwards.
//
// So: CANCEL is the default and keeps everything. Deleting for good is offered
// only when nobody has been marked — when there is genuinely nothing to lose —
// and the server enforces the same rule, refusing with a 409 otherwise.
// ============================================================================

import { useState } from "react";
import { Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import { SeriesScopeField } from "@/components/training/SeriesScopeField";
import { interleave, slot, useT } from "@/lib/i18n";
import type { TrainingScope, TrainingSession } from "@/types";

export interface CancelTrainingDialogProps {
  training: TrainingSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelSession: (scope: TrainingScope) => void;
  onDelete: (scope: TrainingScope) => void;
  loading?: boolean;
}

export function CancelTrainingDialog({
  training,
  open,
  onOpenChange,
  onCancelSession,
  onDelete,
  loading,
}: CancelTrainingDialogProps) {
  const { t } = useT();
  const [scope, setScope] = useState<TrainingScope>("one");

  // `attendance` is present only once the register has been taken at least
  // once — the same distinction the server draws, and the same one that decides
  // whether a hard delete is still safe.
  const registerTaken = training.attendance !== undefined;
  const inSeries = Boolean(training.seriesId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("session.cancel.title")}</DialogTitle>
          <DialogDescription>
            {interleave(t("session.cancel.body", { title: slot(0) }), [
              // No quotes here: each locale supplies its own around the slot
              // (“ ” in English, « » in Spanish), and adding a second pair
              // rendered the title as ““Tuesday squad block””.
              <span key="title" className="font-semibold text-foreground">
                {training.title}
              </span>,
            ])}
          </DialogDescription>
        </DialogHeader>

        {inSeries && (
          <SeriesScopeField value={scope} onChange={setScope} disabled={loading} name="cancel-scope" />
        )}

        <div className="space-y-2">
          {registerTaken ? (
            <p className="text-xs text-muted-foreground">{t("session.cancel.deleteBlocked")}</p>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => onDelete(scope)}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> {t("session.cancel.deleteInstead")}
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("session.cancel.keep")}
          </Button>
          <Button onClick={() => onCancelSession(scope)} disabled={loading} className="gap-1.5">
            <XCircle className="h-4 w-4" />
            {loading ? t("session.cancel.cancelling") : t("session.cancel.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
