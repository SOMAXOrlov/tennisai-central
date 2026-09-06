import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, Star } from "lucide-react";
import { DiscardChangesDialog } from "@/components/training/DiscardChangesDialog";
import type { TrainingSession, TrainingReview } from "@/types";
import { useT } from "@/lib/i18n";

interface TrainingReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  training: TrainingSession;
  /** Rejects when the save fails — the dialog then stays open with the text intact. */
  onSave: (review: TrainingReview) => void | Promise<void>;
  saving?: boolean;
}

export function TrainingReviewDialog({ open, onOpenChange, training, onSave, saving }: TrainingReviewDialogProps) {
  const { t } = useT();
  const existing = training.review;
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [workedOn, setWorkedOn] = useState(existing?.workedOn ?? "");
  const [nextSteps, setNextSteps] = useState(existing?.nextSteps ?? "");
  const [playerFeedback, setPlayerFeedback] = useState(existing?.playerFeedback ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const valid = rating > 0 && workedOn.trim();

  // Anything typed that isn't already saved on the session counts as dirty —
  // an accidental tap outside must never bin it.
  const dirty =
    rating !== (existing?.rating ?? 0) ||
    workedOn !== (existing?.workedOn ?? "") ||
    nextSteps !== (existing?.nextSteps ?? "") ||
    playerFeedback !== (existing?.playerFeedback ?? "");

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaveError(null);
    try {
      await onSave({
        rating,
        workedOn: workedOn.trim(),
        nextSteps: nextSteps.trim(),
        playerFeedback: playerFeedback.trim() || undefined,
        reviewedAt: new Date().toISOString(),
      });
      onOpenChange(false);
    } catch (e) {
      setSaveError((e as { message?: string })?.message ?? t("training.reviewDialog.saveFailed"));
    }
  };

  /** Any close attempt goes through here so a dirty form asks first. */
  const requestClose = () => {
    if (saving) return;
    if (dirty) { setConfirmDiscard(true); return; }
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) requestClose(); else onOpenChange(true); }}>
        <DialogContent
          className="sm:max-w-lg"
          onInteractOutside={(e) => { if (dirty || saving) e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>{existing ? t("training.reviewDialog.editTitle") : t("training.reviewDialog.newTitle")}</DialogTitle>
            <DialogDescription>{t("training.reviewDialog.description", { title: training.title })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("training.reviewDialog.rating")}</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    aria-label={t("training.reviewDialog.ratingAria", { star })}
                    aria-pressed={star === rating}
                    className="p-0.5 transition-transform hover:scale-110"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                  >
                    <Star
                      className={`h-6 w-6 ${
                        star <= (hoverRating || rating)
                          ? "fill-primary text-primary"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
                {rating > 0 && <span className="ml-2 self-center text-sm text-muted-foreground">{t("training.reviewDialog.ratingValue", { rating })}</span>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="review-worked-on">{t("training.reviewDialog.workedOn")}</Label>
              <Textarea id="review-worked-on" aria-required="true"
                value={workedOn}
                onChange={(e) => setWorkedOn(e.target.value)}
                placeholder={t("training.reviewDialog.workedOnPlaceholder")}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="review-next-steps">{t("training.reviewDialog.nextSteps")}</Label>
              <Textarea id="review-next-steps"
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                placeholder={t("training.reviewDialog.nextStepsPlaceholder")}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="review-player-feedback">{t("training.reviewDialog.playerFeedback")} <span className="text-muted-foreground">{t("training.reviewDialog.playerFeedbackOptional")}</span></Label>
              <Textarea id="review-player-feedback"
                value={playerFeedback}
                onChange={(e) => setPlayerFeedback(e.target.value)}
                placeholder={t("training.reviewDialog.playerFeedbackPlaceholder")}
                rows={2}
              />
            </div>
            {saveError && (
              <p className="flex items-start gap-1.5 border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {saveError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={requestClose} disabled={saving}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={!valid || saving}>
              {saving ? t("training.reviewDialog.saving") : existing ? t("training.reviewDialog.update") : t("training.reviewDialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DiscardChangesDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        what={t("training.discard.review")}
        onConfirm={() => onOpenChange(false)}
      />
    </>
  );
}
