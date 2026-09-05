// The conditions for one tournament, opened from a name on the list.
//
// A thin frame around TournamentConditionsPanel: the header names the event,
// the body is the same component the detail page shows always-visible, so
// what a coach reads here and what they read there cannot disagree.
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { conditionsApi } from "@/api/endpoints/conditions";
import { useT } from "@/lib/i18n";
import { conditionsQueryKey } from "@/lib/tournamentConditions";
import {
  TournamentConditionsPanel,
  type PrepCandidate,
} from "@/components/tournaments/TournamentConditionsPanel";

export function TournamentConditionsDialog({
  tournamentId,
  open,
  onOpenChange,
  playerId,
  candidates,
}: {
  tournamentId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Whose preparation this is (a specific entry). Defaults to the caller. */
  playerId?: string;
  /** For a coach without a specific entry: who could be prepared here. */
  candidates?: PrepCandidate[];
}) {
  const { t, formatDate } = useT();

  // Same key as the panel: one request feeds both the header and the body.
  const { data } = useQuery({
    queryKey: conditionsQueryKey(tournamentId),
    queryFn: () => conditionsApi.get(tournamentId!),
    enabled: open && Boolean(tournamentId),
  });
  const tour = data?.tournament;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tour?.name ?? t("tournaments.conditions.title")}</DialogTitle>
          <DialogDescription>
            {tour
              ? `${tour.city}, ${tour.country} · ${formatDate(tour.startDate, { day: "numeric", month: "short", year: "numeric" })}`
              : t("tournaments.conditions.loading")}
          </DialogDescription>
        </DialogHeader>

        {tournamentId && (
          <TournamentConditionsPanel
            tournamentId={tournamentId}
            playerId={playerId}
            candidates={candidates}
            enabled={open}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
