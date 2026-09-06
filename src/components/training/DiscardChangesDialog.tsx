// Confirm before throwing away typed-but-unsaved form input.
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";

export interface DiscardChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being thrown away, already translated (e.g. "the review"). */
  what?: string;
  onConfirm: () => void;
}

export function DiscardChangesDialog({ open, onOpenChange, what, onConfirm }: DiscardChangesDialogProps) {
  const { t } = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("training.discard.title", { what: what ?? t("training.discard.changes") })}</DialogTitle>
          <DialogDescription>{t("training.discard.body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("training.discard.keep")}
          </Button>
          <Button variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>
            <Trash2 className="mr-1.5 h-4 w-4" /> {t("training.discard.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
