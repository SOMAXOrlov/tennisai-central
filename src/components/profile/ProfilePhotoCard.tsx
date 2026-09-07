// ============================================================================
// Your own profile photo — choose, preview, save, remove.
//
// The rules the copy has to obey, and why:
//
//   The accepted formats and the size cap are shown BEFORE the picker opens.
//   Learning "that file is too big" after choosing a photo, on a phone, on
//   mobile data, is a wasted minute and an avoidable error message.
//
//   The client-side type and size check is a COURTESY, not the gate. It saves
//   a doomed upload; the server checks the magic bytes and counts the arriving
//   stream regardless of anything decided here. Nothing in this file is
//   security, and it does not pretend to be.
//
//   Progress is the real number from the upload's own progress events (see
//   apiClient.postForm), shown as a percentage only while the browser reports
//   a computable total, and as a plain "uploading" line otherwise. An invented
//   bar would be a fake.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/auth/AuthContext";
import {
  ACCEPTED_PHOTO_EXTENSIONS,
  ACCEPTED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_MB,
  photosApi,
} from "@/api/endpoints/photos";
import { toastError, toastSuccess } from "@/lib/feedback";
import { useT } from "@/lib/i18n";

type Accepted = (typeof ACCEPTED_PHOTO_TYPES)[number];

function isAcceptedType(type: string): type is Accepted {
  return (ACCEPTED_PHOTO_TYPES as readonly string[]).includes(type);
}

export function ProfilePhotoCard() {
  const { t } = useT();
  const { user, refreshUser } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  const hasPhoto = Boolean(user?.photoId);

  // A local preview of the chosen file, revoked when it is replaced or dropped.
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

  const clearChoice = () => {
    setPending(null);
    setRejection(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const choose = (file: File | undefined) => {
    setRejection(null);
    if (!file) {
      setPending(null);
      return;
    }
    // The courtesy check. The server decides for real, from the bytes.
    if (!isAcceptedType(file.type)) {
      setPending(null);
      setRejection(t("photo.rejected.type"));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPending(null);
      setRejection(t("photo.rejected.size", { max: MAX_PHOTO_MB }));
      return;
    }
    setPending(file);
  };

  const save = async () => {
    if (!pending) return;
    setUploading(true);
    setProgress(null);
    try {
      await photosApi.upload(pending, (fraction) => setProgress(Math.round(fraction * 100)));
      await refreshUser();
      clearChoice();
      toastSuccess("photo.toast.saved");
    } catch (err) {
      toastError("photo.toast.saveFailed", err);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await photosApi.remove();
      await refreshUser();
      clearChoice();
      toastSuccess("photo.toast.removed");
    } catch (err) {
      toastError("photo.toast.removeFailed", err);
    } finally {
      setRemoving(false);
    }
  };

  const busy = uploading || removing;

  return (
    <DashboardCard
      title={t("photo.title")}
      description={t("photo.description")}
      icon={<Camera className="h-4 w-4" />}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={t("photo.previewAlt")}
              className="h-20 w-20 shrink-0 rounded-full object-cover"
            />
          ) : (
            <PlayerAvatar
              userId={user?.id}
              firstName={user?.firstName}
              lastName={user?.lastName}
              version={user?.photoUpdatedAt ?? null}
              hasPhoto={hasPhoto}
              className="h-20 w-20 shrink-0"
              fallbackClassName="text-xl"
            />
          )}

          <div className="min-w-0 flex-1 space-y-2">
            {/* Said before the picker opens, not after a rejected upload. */}
            <p className="text-xs text-muted-foreground">
              {t("photo.acceptedHint", { max: MAX_PHOTO_MB })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED_PHOTO_EXTENSIONS}
                className="sr-only"
                aria-label={t("photo.chooseAria")}
                onChange={(e) => choose(e.target.files?.[0])}
                disabled={busy}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {hasPhoto ? t("photo.replace") : t("photo.choose")}
              </Button>
              {pending && (
                <>
                  <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
                    {uploading ? t("photo.saving") : t("photo.save")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={clearChoice}>
                    {t("photo.cancel")}
                  </Button>
                </>
              )}
              {hasPhoto && !pending && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:bg-destructive/10"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {removing ? t("photo.removing") : t("photo.remove")}
                </Button>
              )}
            </div>
            {pending && !uploading && (
              <p className="truncate text-xs text-muted-foreground">{t("photo.chosen", { name: pending.name })}</p>
            )}
          </div>
        </div>

        {rejection && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {rejection}
          </p>
        )}

        {uploading && (
          <div className="space-y-1.5" aria-live="polite">
            {/* A percentage only when the browser gives a computable total. */}
            {progress === null ? (
              <p className="text-xs text-muted-foreground">{t("photo.uploading")}</p>
            ) : (
              <>
                <Progress value={progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground">{t("photo.uploadingPercent", { percent: progress })}</p>
              </>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t("photo.privacyNote")}</p>
      </div>
    </DashboardCard>
  );
}
