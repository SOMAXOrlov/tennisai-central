// ============================================================================
// One item's photo, fetched through the API behind its owner check and shown
// as a thumbnail (row) or a larger preview (dialog). Renders nothing when the
// item has no photo, and nothing in mock mode, where photos do not exist.
// ============================================================================
import { equipmentApi } from "@/api/endpoints/equipment";
import { useBlobUrl } from "@/hooks/useBlobUrl";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { EquipmentItem } from "@/types";

interface EquipmentPhotoProps {
  item: Pick<EquipmentItem, "id" | "name" | "photoId" | "photoUpdatedAt">;
  size?: "sm" | "lg";
  className?: string;
}

export function EquipmentPhoto({ item, size = "sm", className }: EquipmentPhotoProps) {
  const { t } = useT();
  const key = item.photoId ? `${item.id}:${item.photoUpdatedAt ?? item.photoId}` : null;
  const url = useBlobUrl(key ? () => equipmentApi.fetchPhoto(item.id) : null, key);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={t("equipment.photo.alt", { name: item.name })}
      className={cn(
        "shrink-0 rounded-md border border-border bg-muted",
        size === "sm" ? "h-12 w-12 object-cover" : "max-h-48 w-full object-contain",
        className,
      )}
    />
  );
}
