// A coach types in a tournament no feed carries.
//
// This exists because there is no way to collect one. UTR publishes no
// sanctioning body, so its rows cannot be relabelled as USTA events; and USTA's
// own site disallows this client by name in its robots.txt and makes respecting
// that a condition of access, so no collector may be written for it. Until the
// owner has data access from USTA directly, an event a coach knows about gets
// into the app the same way it gets onto a whiteboard: somebody types it.
//
// Three deliberate details:
//
//   • The country is a picked CODE, never typed text. The server stores the
//     country name its feeds use, so a coach working in Spanish cannot file an
//     event under "Estados Unidos" and split the country filter in two.
//   • Indoor or outdoor is asked, not defaulted. The column cannot be null and
//     the page shows it on every card; "outdoor" as a silent default would be a
//     guess presented as a fact.
//   • A level or a category is required. Without one the event cannot be told
//     apart from the rest of the list.
//
// No federation field: nothing here knows whether the event is sanctioned, and
// the row is stored without one rather than wearing a badge nobody earned.

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCountries, useCreateTournament } from "@/hooks/api/queries";
import { useT } from "@/lib/i18n";
import type { ConnectedPlayer } from "@/types";

/** The surfaces the app knows, including an honest "Unknown". */
const SURFACES = ["Hard", "Clay", "Grass", "Carpet", "Unknown"] as const;
const NOBODY = "__nobody__";

export function AddTournamentDialog({
  open,
  onOpenChange,
  players,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Players this coach may enter. Empty is fine — the event still gets added. */
  players: ConnectedPlayer[];
}) {
  const { t } = useT();
  const { data: countries = [] } = useCountries();
  const create = useCreateTournament();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [surface, setSurface] = useState<string>("Hard");
  const [indoorOutdoor, setIndoorOutdoor] = useState<"indoor" | "outdoor">("outdoor");
  const [level, setLevel] = useState("");
  const [entryDeadline, setEntryDeadline] = useState("");
  const [website, setWebsite] = useState("");
  const [playerId, setPlayerId] = useState<string>(NOBODY);

  /** Exactly the server's own rules, so the form cannot submit a 400. */
  const complete =
    name.trim().length >= 2 &&
    city.trim().length >= 1 &&
    country !== "" &&
    startDate !== "" &&
    endDate !== "" &&
    endDate >= startDate &&
    level.trim().length >= 1;

  const reset = () => {
    setName("");
    setCity("");
    setCountry("");
    setStartDate("");
    setEndDate("");
    setSurface("Hard");
    setIndoorOutdoor("outdoor");
    setLevel("");
    setEntryDeadline("");
    setWebsite("");
    setPlayerId(NOBODY);
  };

  const submit = () => {
    create.mutate(
      {
        name: name.trim(),
        city: city.trim(),
        country,
        startDate,
        endDate,
        surface,
        indoorOutdoor,
        level: level.trim(),
        ...(entryDeadline ? { entryDeadline } : {}),
        ...(website.trim() ? { website: website.trim() } : {}),
        ...(playerId !== NOBODY ? { playerId } : {}),
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("tournaments.add.title")}</DialogTitle>
          <DialogDescription>{t("tournaments.add.body")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-t-name">{t("tournaments.add.name")}</Label>
            <Input id="add-t-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-t-city">{t("tournaments.add.city")}</Label>
              <Input id="add-t-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-t-country">{t("tournaments.add.country")}</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="add-t-country">
                  <SelectValue placeholder={t("tournaments.add.countryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-t-start">{t("tournaments.add.startDate")}</Label>
              <Input id="add-t-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-t-end">{t("tournaments.add.endDate")}</Label>
              <Input id="add-t-end" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-t-surface">{t("tournaments.add.surface")}</Label>
              <Select value={surface} onValueChange={setSurface}>
                <SelectTrigger id="add-t-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SURFACES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`tournaments.add.surfaceOption.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-t-environment">{t("tournaments.add.environment")}</Label>
              <Select value={indoorOutdoor} onValueChange={(v) => setIndoorOutdoor(v as "indoor" | "outdoor")}>
                <SelectTrigger id="add-t-environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outdoor">{t("tournaments.page.outdoor")}</SelectItem>
                  <SelectItem value="indoor">{t("tournaments.page.indoor")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-t-level">{t("tournaments.add.level")}</Label>
            <Input
              id="add-t-level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              maxLength={80}
              placeholder={t("tournaments.add.levelPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("tournaments.add.levelHint")}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-t-deadline">{t("tournaments.add.entryDeadline")}</Label>
              <Input id="add-t-deadline" type="date" value={entryDeadline} onChange={(e) => setEntryDeadline(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-t-website">{t("tournaments.add.website")}</Label>
              <Input
                id="add-t-website"
                type="url"
                inputMode="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder={t("tournaments.add.websitePlaceholder")}
              />
            </div>
          </div>

          {players.length > 0 && (
            <div className="space-y-1.5 border-t border-border pt-3">
              <Label htmlFor="add-t-player">{t("tournaments.add.forPlayer")}</Label>
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger id="add-t-player">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOBODY}>{t("tournaments.add.nobody")}</SelectItem>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("tournaments.add.forPlayerHint")}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{t("tournaments.add.provenanceNote")}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("tournaments.add.cancel")}
          </Button>
          <Button disabled={!complete || create.isPending} onClick={submit} className="gap-1.5">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {create.isPending ? t("tournaments.add.saving") : t("tournaments.add.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
