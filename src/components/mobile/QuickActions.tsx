// ============================================================
// Quick actions — the phone header's one button for the things that happen
// on court: a coach logs the session that just ended, a player enters a score
// walking off. Tap 1 opens a bottom sheet listing this role's actions (at most
// three); tap 2 lands in a pre-filled, minimal form inside the same sheet.
//
// Phone only. The trigger is rendered inside DashboardLayout's `md:hidden`
// header, so desktop keeps its full pages and dialogs untouched. Every form
// reuses an existing mutation hook and endpoint — nothing new server-side —
// and each form owns its data hooks, so nothing is fetched until the sheet is
// actually open (the same rule CommandPalette follows).
// ============================================================

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Dumbbell, Zap } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useT } from "@/lib/i18n";
import { quickActionsFor, type QuickActionId } from "@/components/mobile/quickActionsModel";
import { QuickLogTraining } from "@/components/mobile/QuickLogTraining";
import { QuickMatchScore } from "@/components/mobile/QuickMatchScore";

const ACTION_META: Record<QuickActionId, { icon: ReactNode; titleKey: string; descriptionKey: string }> = {
  "log-training": {
    icon: <Dumbbell className="h-5 w-5" />,
    titleKey: "quick.menu.logTraining.title",
    descriptionKey: "quick.menu.logTraining.description",
  },
  "match-score": {
    icon: <ClipboardList className="h-5 w-5" />,
    titleKey: "quick.menu.matchScore.title",
    descriptionKey: "quick.menu.matchScore.description",
  },
};

export function QuickActions({ className }: { className?: string }) {
  const { t } = useT();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<QuickActionId | null>(null);

  const actions = user ? quickActionsFor(user.role) : [];
  // No trigger for a role with nothing to do here (admin): an icon that opens
  // an empty sheet is worse than no icon.
  if (!user || actions.length === 0) return null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Reopening always starts at the list. A half-typed form from an hour ago
    // resurfacing under a different thumb is a trap, not a convenience.
    if (!next) setActive(null);
  };
  const close = () => handleOpenChange(false);
  const meta = active ? ACTION_META[active] : null;

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("quick.trigger")} className={className}>
          <Zap className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          {meta ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 h-9 w-9 shrink-0"
                onClick={() => setActive(null)}
                aria-label={t("quick.back")}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <DrawerTitle>{t(meta.titleKey)}</DrawerTitle>
                <DrawerDescription className="mt-1">{t(meta.descriptionKey)}</DrawerDescription>
              </div>
            </div>
          ) : (
            <>
              <DrawerTitle>{t("quick.title")}</DrawerTitle>
              <DrawerDescription>{t("quick.description")}</DrawerDescription>
            </>
          )}
        </DrawerHeader>

        {active === null ? (
          <ul className="flex flex-col gap-2 px-4 pb-6">
            {actions.map((id) => {
              const item = ACTION_META[id];
              return (
                <li key={id}>
                  {/* min-h-14: a full-width row a thumb cannot miss. Square,
                      matte, ruled — the brand's card, not a pill. */}
                  <button
                    type="button"
                    onClick={() => setActive(id)}
                    className="flex min-h-14 w-full items-center gap-3 border border-border bg-card px-4 py-3 text-left transition-colors duration-120 touch-manipulation hover:bg-accent active:scale-[0.99] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{t(item.titleKey)}</span>
                      <span className="block text-xs text-muted-foreground">{t(item.descriptionKey)}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : active === "log-training" ? (
          <QuickLogTraining coach={user} onDone={close} />
        ) : (
          <QuickMatchScore onDone={close} />
        )}
      </DrawerContent>
    </Drawer>
  );
}
