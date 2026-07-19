import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import type { TrainingSession, TrainingReview } from "@/types";

interface TrainingReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  training: TrainingSession;
  onSave: (review: TrainingReview) => void;
  saving?: boolean;
}

export function TrainingReviewDialog({ open, onOpenChange, training, onSave, saving }: TrainingReviewDialogProps) {
  const existing = training.review;
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [workedOn, setWorkedOn] = useState(existing?.workedOn ?? "");
  const [nextSteps, setNextSteps] = useState(existing?.nextSteps ?? "");
  const [playerFeedback, setPlayerFeedback] = useState(existing?.playerFeedback ?? "");

  const valid = rating > 0 && workedOn.trim();

  const handleSave = () => {
    onSave({
      rating,
      workedOn: workedOn.trim(),
      nextSteps: nextSteps.trim(),
      playerFeedback: playerFeedback.trim() || undefined,
      reviewedAt: new Date().toISOString(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Review" : "Review Training Session"}</DialogTitle>
          <DialogDescription>
            Rate "{training.title}" and note what was covered and what to focus on next.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Rating *</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
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
              {rating > 0 && <span className="ml-2 self-center text-sm text-muted-foreground">{rating}/5</span>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>What was worked on *</Label>
            <Textarea
              value={workedOn}
              onChange={(e) => setWorkedOn(e.target.value)}
              placeholder="e.g. Lateral footwork drills, split-step timing, recovery steps"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>What to do next</Label>
            <Textarea
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              placeholder="e.g. Increase drill speed, add weighted vest, focus on backhand"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Player feedback <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              value={playerFeedback}
              onChange={(e) => setPlayerFeedback(e.target.value)}
              placeholder="Any feedback from the player about the session"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!valid || saving}>
            {saving ? "Saving…" : existing ? "Update Review" : "Save Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
