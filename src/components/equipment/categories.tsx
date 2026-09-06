// ============================================================
// Equipment categories, their condition ladders and the badge styling —
// shared by the player's own Equipment page and the coach's read-only
// PlayerEquipmentDrawer, so both describe a racket's state the same way.
// ============================================================
import type { ReactNode } from "react";
import { CircleDot, Zap, Footprints, Circle, Grip } from "lucide-react";
import type { EquipmentCategory } from "@/types";
import { t } from "@/lib/i18n";

// ─── Category config ───

/**
 * The shape of each category: its icon and the condition ladder it offers.
 *
 * `value` is what is STORED on the item and must never change — the copy for
 * it lives in the locale bundles under `equipment.condition.<category>.<value>`
 * and is resolved at render time by `conditionLabel` below.
 */
export const CATEGORY_CONFIG: Record<EquipmentCategory, {
  icon: ReactNode;
  conditions: { value: string; level: "excellent" | "good" | "fair" | "poor" }[];
}> = {
  racket: {
    icon: <CircleDot className="h-4 w-4" />,
    conditions: [
      { value: "New", level: "excellent" },
      { value: "Excellent", level: "excellent" },
      { value: "Good", level: "good" },
      { value: "Fair", level: "fair" },
      { value: "Poor", level: "poor" },
    ],
  },
  string: {
    icon: <Zap className="h-4 w-4" />,
    conditions: [
      { value: "Fresh", level: "excellent" },
      { value: "Good", level: "good" },
      { value: "Losing Tension", level: "fair" },
      { value: "Fraying", level: "poor" },
      { value: "Broken", level: "poor" },
    ],
  },
  shoes: {
    icon: <Footprints className="h-4 w-4" />,
    conditions: [
      { value: "New", level: "excellent" },
      { value: "Good", level: "good" },
      { value: "Worn Tread", level: "fair" },
      { value: "Worn Out", level: "poor" },
    ],
  },
  balls: {
    icon: <Circle className="h-4 w-4" />,
    conditions: [
      { value: "New", level: "excellent" },
      { value: "Practice", level: "good" },
      { value: "Flat", level: "fair" },
      { value: "Dead", level: "poor" },
    ],
  },
  accessories: {
    icon: <Grip className="h-4 w-4" />,
    conditions: [
      { value: "New", level: "excellent" },
      { value: "Good", level: "good" },
      { value: "Worn", level: "fair" },
      { value: "Replace", level: "poor" },
    ],
  },
};

/** The category's name, e.g. "Racket" / "Raqueta". */
export const categoryLabel = (category: EquipmentCategory): string =>
  t(`equipment.category.${category}.label`);

/** The category's plural name, for section headings. */
export const categoryPlural = (category: EquipmentCategory): string =>
  t(`equipment.category.${category}.plural`);

/** The stored condition value, spelled out for a reader. */
export const conditionLabel = (category: EquipmentCategory, value: string): string =>
  t(`equipment.condition.${category}.${value}`);

export const CATEGORY_ORDER: EquipmentCategory[] = ["racket", "string", "shoes", "balls", "accessories"];

// ─── Condition badge colors ───

export const CONDITION_STYLES: Record<string, string> = {
  excellent: "bg-muted text-foreground dark:text-foreground border-border",
  good: "bg-muted text-foreground dark:text-foreground border-border",
  fair: "bg-primary/10 text-primary dark:text-primary border-primary/25",
  poor: "bg-primary/10 text-primary dark:text-primary border-primary/25",
};

export function getConditionLevel(category: EquipmentCategory, condition?: string): string {
  if (!condition) return "good";
  const cfg = CATEGORY_CONFIG[category];
  const found = cfg.conditions.find((c) => c.value === condition);
  return found?.level ?? "good";
}
