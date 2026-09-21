// ============================================================================
// The photo part of the add / edit equipment dialog.
//
// Same rules as the profile photo card: formats and the size cap are shown
// BEFORE the picker opens; the client-side check is a courtesy, the server
// decides from the bytes; progress is the upload's own number or nothing.
// The chosen file is not sent from here — the dialog uploads it when the
// item is saved, so a new item gets its id first. Removing an existing photo
// is immediate, because there is nothing else to save with it.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { equipmentPhotosAvailable } from "@/api/endpoints/equipment";
import { ACCEPTED_PHOTO_EXTENSIONS, ACCEPTED_PHOTO_TYPES, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/api/endpoints/photos";
import { useT } from "@/lib/i18n";
import type { EquipmentItem } from "@/types";
import { EquipmentPhoto } from "./EquipmentPhoto";

interface EquipmentPhotoFieldProps {
  /** The item being edited, or null while adding. */
  item: EquipmentItem | null;
  pending: File | null;
  onChoose: (file: File | null) => void;
  /** Remove the saved photo now. Only offered while editing an item that has one. */
  onRemoveExisting?: () => void;
  removing?: boolean;
  /** 0..100 while the dialog is uploading, else null. */
  uploadPercent?: number | null;
  disabled?: boolean;
}

function isAcceptedType(type: string): boolean {
  return (ACCEPTED_PHOTO_TYPES as readonly string[]).includes(type);
}

export function EquipmentPhotoField({ item, pending, onChoose, onRemoveExisting, removing, uploadPercent, disabled }: EquipmentPhotoFieldProps) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  useEffect(() => {
    if (!pending || typeof URL.createObjectURL !== "function") {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pending);
    setPreviewUrl(url);
    return () => {
      if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
    };
  }, [pending]);

  if (!equipmentPhotosAvailable()) {
    return (
      <div className="space-y-1.5">
        <Label>{t("equipment.add.photo")}</Label>
        <p className="text-xs text-muted-foreground">{t("equipment.photo.unavailable")}</p>
      </div>
    );
  }

  const hasSaved = Boolean(item?.photoId);

  const choose = (file: File | undefined) => {
    setRejection(null);
    if (!file) return;
    if (!isAcceptedType(file.type)) {
      setRejection(t("equipment.photo.rejectedType"));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setRejection(t("equipment.photo.rejectedSize", { max: MAX_PHOTO_MB }));
      return;
    }
    onChoose(file);
  };

  const clear = () => {
    onChoose(null);
    setRejection(null);
    if (input.current) input.current.value = "";
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="equipment-photo">{t("equipment.add.photo")}</Label>
      <div className="flex flex-wrap items-start gap-3">
        {previewUrl ? (
          <img src={previewUrl} alt={t("equipment.photo.previewAlt")} className="max-h-40 rounded-md border border-border object-contain" />
        ) : item && hasSaved ? (
          <EquipmentPhoto item={item} size="lg" className="max-h-40 w-auto" />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            id="equipment-photo"
            type="file"
            accept={ACCEPTED_PHOTO_EXTENSIONS}
            className="sr-only"
            disabled={disabled}
            onChange={(e) => choose(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={disabled} onClick={() => input.current?.click()}>
            <Camera className="h-3.5 w-3.5" />
            {hasSaved || pending ? t("equipment.photo.replace") : t("equipment.photo.choose")}
          </Button>
          {pending && (
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" disabled={disabled} onClick={clear}>
              <X className="h-3.5 w-3.5" /> {t("equipment.photo.clear")}
            </Button>
          )}
          {!pending && hasSaved && onRemoveExisting && (
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive" disabled={disabled || removing} onClick={onRemoveExisting}>
              <Trash2 className="h-3.5 w-3.5" /> {removing ? t("equipment.photo.removing") : t("equipment.photo.remove")}
            </Button>
          )}
        </div>
      </div>
      {pending && <p className="text-xs text-muted-foreground">{t("equipment.photo.pending", { name: pending.name })}</p>}
      {typeof uploadPercent === "number" && (
        <div className="space-y-1">
          <Progress value={uploadPercent} />
          <p className="text-xs text-muted-foreground">{t("equipment.photo.uploading", { percent: uploadPercent })}</p>
        </div>
      )}
      {rejection ? (
        <p className="text-xs text-destructive">{rejection}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("equipment.photo.hint", { max: MAX_PHOTO_MB })}</p>
      )}
    </div>
  );
}
