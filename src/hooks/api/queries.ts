// ============================================================
// TennisAI — React Query Hooks for all domain services
// Centralized data fetching, mutation, and cache invalidation
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trainingsApi } from "@/api/endpoints/trainings";
import { trainingRequestsApi } from "@/api/endpoints/trainingRequests";
import { teamsApi } from "@/api/endpoints/teams";
import { calendarApi } from "@/api/endpoints/calendar";
import { tournamentsApi } from "@/api/endpoints/tournaments";
import { hiddenTournamentsApi } from "@/api/endpoints/hiddenTournaments";
import { financeApi } from "@/api/endpoints/finance";
import { equipmentApi } from "@/api/endpoints/equipment";
import { notificationsApi } from "@/api/endpoints/notifications";
import { profileApi, calendarPreferencesApi, type CalendarPreferences } from "@/api/endpoints/profile";
import { trainingPlansApi } from "@/api/endpoints/trainingPlans";
import type { TrainingSession, TrainingScope, TrainingRequest, Team, CalendarEvent, PlayerTournament, FinanceEntry, EquipmentItem, Notification, NotificationSettings, ConnectedPlayer, User, TrainingPlanCreateInput, PlayerSessionFeedback } from "@/types";
import { toastSuccess, toastError } from "@/lib/feedback";

// ─── Query Keys ───
export const queryKeys = {
  trainings: ["trainings"] as const,
  trainingRequests: ["trainingRequests"] as const,
  teams: ["teams"] as const,
  calendarEvents: ["calendarEvents"] as const,
  tournaments: ["tournaments"] as const,
  playerTournaments: ["playerTournaments"] as const,
  hiddenTournaments: ["hidden-tournaments"] as const,
  finance: (playerId: string) => ["finance", playerId] as const,
  financeSummary: (playerId: string) => ["financeSummary", playerId] as const,
  equipment: (playerId: string) => ["equipment", playerId] as const,
  notifications: (userId: string) => ["notifications", userId] as const,
  notificationPrefs: ["notificationPrefs"] as const,
  calendarPrefs: ["calendarPrefs"] as const,
  trainingPlans: ["trainingPlans"] as const,
};

function useInvalidateRelated() {
  const qc = useQueryClient();
  return {
    training: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trainings });
      qc.invalidateQueries({ queryKey: queryKeys.calendarEvents });
    },
    trainingRequest: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trainingRequests });
      qc.invalidateQueries({ queryKey: queryKeys.calendarEvents });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    calendar: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendarEvents });
    },
    team: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teams });
    },
    tournament: () => {
      qc.invalidateQueries({ queryKey: queryKeys.playerTournaments });
      qc.invalidateQueries({ queryKey: queryKeys.calendarEvents });
    },
    finance: (playerId: string) => {
      qc.invalidateQueries({ queryKey: queryKeys.finance(playerId) });
      qc.invalidateQueries({ queryKey: queryKeys.financeSummary(playerId) });
    },
    equipment: (playerId: string) => {
      qc.invalidateQueries({ queryKey: queryKeys.equipment(playerId) });
    },
    notifications: (userId: string) => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
    },
  };
}

// ─── Training Hooks ───

export function useTrainings() {
  return useQuery({
    queryKey: queryKeys.trainings,
    queryFn: async () => (await trainingsApi.getTrainings()).data,
  });
}

export function useCreateTraining() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: (data: Omit<TrainingSession, "id" | "createdAt">) => trainingsApi.createTraining(data),
    onSuccess: () => { inv.training(); toastSuccess("toast.training.created"); },
    onError: (e: unknown) => toastError("toast.training.createFailed", e),
  });
}

export function useUpdateTraining() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, data, scope }: { id: string; data: Partial<TrainingSession>; scope?: TrainingScope }) =>
      trainingsApi.updateTraining(id, data, scope),
    onSuccess: (_result, vars) => {
      inv.training();
      // "Cancelled" is not "updated". A coach who calls off next Tuesday and is
      // told "Training updated" has to go and check what actually happened.
      toastSuccess(vars.data.status === "cancelled" ? "toast.training.cancelled" : "toast.training.updated");
    },
    onError: (e: unknown) => toastError("toast.training.updateFailed", e),
  });
}

export function useDeleteTraining() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, scope }: { id: string; scope?: TrainingScope }) =>
      trainingsApi.deleteTraining(id, scope),
    onSuccess: () => { inv.training(); toastSuccess("toast.training.deleted"); },
    onError: (e: unknown) => toastError("toast.training.deleteFailed", e),
  });
}

/** Repeat a session on a new date — the coach's commonest real action. */
export function useDuplicateTraining() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, startDate, endDate }: { id: string; startDate: string; endDate?: string }) =>
      trainingsApi.duplicateTraining(id, startDate, endDate),
    onSuccess: () => { inv.training(); toastSuccess("toast.training.duplicated"); },
    onError: (e: unknown) => toastError("toast.training.duplicateFailed", e),
  });
}

/**
 * A player saving their own feedback. Separate from `useUpdateTraining`
 * because it hits a separate, player-scoped route — the general training PATCH
 * is coach-only server-side, and routing feedback through it 403d for the one
 * role that writes it.
 */
export function useSaveTrainingFeedback() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, feedback }: { id: string; feedback: PlayerSessionFeedback }) =>
      trainingsApi.saveFeedback(id, feedback),
    onSuccess: () => { inv.training(); toastSuccess("toast.training.feedbackSaved"); },
    onError: (e: unknown) => toastError("toast.training.feedbackFailed", e),
  });
}

export function useAnalyzeTraining() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: (id: string) => trainingsApi.analyzeTraining(id),
    onSuccess: () => { inv.training(); toastSuccess("toast.training.analysisReady"); },
    // `Error`, not `unknown` like its neighbours: TrainingsPage reads
    // `analyzeMut.error?.message` inline, and annotating this handler `unknown`
    // widens the mutation's error type to match, which is what forced an
    // `as any` at that read. `Error` is react-query's own default and the shape
    // `ApiError` has; the optional chain still covers the mock endpoints'
    // plain `{ status, message }` throws. Annotation only — erased at runtime.
    onError: (e: Error) => toastError("toast.training.analyzeFailed", e),
  });
}

// ─── Training Request Hooks ───

export function useTrainingRequests() {
  return useQuery({
    queryKey: queryKeys.trainingRequests,
    queryFn: async () => (await trainingRequestsApi.getRequests()).data,
  });
}

export function useCreateTrainingRequest() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: (data: Omit<TrainingRequest, "id" | "createdAt" | "updatedAt" | "status">) => trainingRequestsApi.createRequest(data),
    onSuccess: () => { inv.trainingRequest(); toastSuccess("toast.request.sent"); },
    onError: (e: unknown) => toastError("toast.request.sendFailed", e),
  });
}

export function useApproveTrainingRequest() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, coachMessage }: { id: string; coachMessage?: string }) => trainingRequestsApi.approve(id, coachMessage),
    onSuccess: () => { inv.trainingRequest(); toastSuccess("toast.request.approved"); },
    onError: (e: unknown) => toastError("toast.request.approveFailed", e),
  });
}

export function useRejectTrainingRequest() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, coachMessage }: { id: string; coachMessage?: string }) => trainingRequestsApi.reject(id, coachMessage),
    onSuccess: () => { inv.trainingRequest(); toastSuccess("toast.request.declined"); },
    onError: (e: unknown) => toastError("toast.request.declineFailed", e),
  });
}

export function useRescheduleTrainingRequest() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { proposedDate: string; proposedStartTime: string; proposedEndTime: string; coachMessage?: string } }) =>
      trainingRequestsApi.reschedule(id, data),
    onSuccess: () => { inv.trainingRequest(); toastSuccess("toast.request.rescheduled"); },
    onError: (e: unknown) => toastError("toast.request.rescheduleFailed", e),
  });
}

export function useCancelTrainingRequest() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: (id: string) => trainingRequestsApi.cancel(id),
    onSuccess: () => { inv.trainingRequest(); toastSuccess("toast.request.cancelled"); },
    onError: (e: unknown) => toastError("toast.request.cancelFailed", e),
  });
}

// ─── Team Hooks ───

export function useTeams() {
  return useQuery({
    queryKey: queryKeys.teams,
    queryFn: async () => (await teamsApi.getTeams()).data,
  });
}

export function useCreateTeam() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: (data: { name: string; coachId: string; description?: string }) => teamsApi.createTeam(data),
    onSuccess: () => { inv.team(); toastSuccess("toast.team.created"); },
    onError: (e: unknown) => toastError("toast.team.createFailed", e),
  });
}

// ─── Training plans (saved from the Session Builder) ───
export function useTrainingPlans() {
  return useQuery({
    queryKey: queryKeys.trainingPlans,
    queryFn: async () => (await trainingPlansApi.list()).data,
  });
}

export function useCreateTrainingPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TrainingPlanCreateInput) => trainingPlansApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingPlans });
      toastSuccess("toast.plan.saved");
    },
    onError: (e: unknown) => toastError("toast.plan.saveFailed", e),
  });
}

// Optimistic: renaming a team is a field patch on a row the coach is looking
// at, and the rename dialog closes on submit — without this the old name would
// sit on the card for a round trip. Restored verbatim if the save fails.
export function useUpdateTeam() {
  const qc = useQueryClient();
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Team> }) => teamsApi.updateTeam(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.teams });
      const previous = qc.getQueryData<Team[]>(queryKeys.teams);
      qc.setQueryData<Team[]>(queryKeys.teams, (old) =>
        old?.map((team) => (team.id === id ? { ...team, ...data } : team)),
      );
      return { previous };
    },
    onSuccess: () => { toastSuccess("toast.team.updated"); },
    onError: (e: unknown, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKeys.teams, ctx.previous);
      toastError("toast.team.updateFailed", e);
    },
    onSettled: () => { inv.team(); },
  });
}

export function useDeleteTeam() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: (id: string) => teamsApi.deleteTeam(id),
    onSuccess: () => { inv.team(); toastSuccess("toast.team.deleted"); },
    onError: (e: unknown) => toastError("toast.team.deleteFailed", e),
  });
}

export function useAddTeamMember() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ teamId, player }: { teamId: string; player: ConnectedPlayer }) => teamsApi.addTeamMember(teamId, player),
    onSuccess: () => { inv.team(); toastSuccess("toast.team.playerAdded"); },
    onError: (e: unknown) => toastError("toast.team.addPlayerFailed", e),
  });
}

export function useRemoveTeamMember() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ teamId, playerId }: { teamId: string; playerId: string }) => teamsApi.removeTeamMember(teamId, playerId),
    onSuccess: () => { inv.team(); toastSuccess("toast.team.playerRemoved"); },
    onError: (e: unknown) => toastError("toast.team.removePlayerFailed", e),
  });
}

// ─── Calendar Hooks ───

export function useCalendarEvents() {
  return useQuery({
    queryKey: queryKeys.calendarEvents,
    queryFn: async () => (await calendarApi.getEvents()).data,
  });
}

export function useCreateCalendarEvent() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: (data: Omit<CalendarEvent, "id">) => calendarApi.createEvent(data),
    onSuccess: () => { inv.calendar(); toastSuccess("toast.event.created"); },
    onError: (e: unknown) => toastError("toast.event.createFailed", e),
  });
}

export function useUpdateCalendarEvent() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CalendarEvent> }) => calendarApi.updateEvent(id, data),
    onSuccess: () => { inv.calendar(); toastSuccess("toast.event.updated"); },
    onError: (e: unknown) => toastError("toast.event.updateFailed", e),
  });
}

export function useDeleteCalendarEvent() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: (id: string) => calendarApi.deleteEvent(id),
    onSuccess: () => { inv.calendar(); toastSuccess("toast.event.deleted"); },
    onError: (e: unknown) => toastError("toast.event.deleteFailed", e),
  });
}

// ─── Tournament Hooks ───

export function useTournaments() {
  return useQuery({
    queryKey: queryKeys.tournaments,
    queryFn: async () => (await tournamentsApi.getTournaments()).data,
  });
}

export function usePlayerTournaments() {
  return useQuery({
    queryKey: queryKeys.playerTournaments,
    queryFn: async () => (await tournamentsApi.getPlayerTournaments()).data,
  });
}

// Optimistic: a status change on an entry the client already has is a field patch
// on a row that exists — the UI can show it immediately and roll back cleanly.
export function useUpdatePlayerTournament() {
  const qc = useQueryClient();
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PlayerTournament> }) => tournamentsApi.updatePlayerTournament(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.playerTournaments });
      const previous = qc.getQueryData<PlayerTournament[]>(queryKeys.playerTournaments);
      qc.setQueryData<PlayerTournament[]>(queryKeys.playerTournaments, (old) =>
        old?.map((pt) => (pt.id === id ? { ...pt, ...data } : pt)),
      );
      return { previous };
    },
    onSuccess: () => { toastSuccess("toast.tournament.statusUpdated"); },
    onError: (e: unknown, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKeys.playerTournaments, ctx.previous);
      toastError("toast.tournament.statusFailed", e);
    },
    onSettled: () => { inv.tournament(); },
  });
}

export function useAddPlayerTournament() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: (data: Omit<PlayerTournament, "id">) => tournamentsApi.addPlayerTournament(data),
    onSuccess: () => { inv.tournament(); toastSuccess("toast.tournament.addedToSchedule"); },
    onError: (e: unknown) => toastError("toast.tournament.addFailed", e),
  });
}

export function useRemovePlayerTournament() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: (id: string) => tournamentsApi.removePlayerTournament(id),
    onSuccess: () => { inv.tournament(); toastSuccess("toast.tournament.removedFromSchedule"); },
    onError: (e: unknown) => toastError("toast.tournament.removeFailed", e),
  });
}

// ─── Hidden Tournaments ("eliminate from suggestions") ───

export function useHiddenTournaments() {
  return useQuery({
    queryKey: queryKeys.hiddenTournaments,
    queryFn: async () => (await hiddenTournamentsApi.getHidden()).data,
  });
}

// Optimistic: hide/unhide is a per-account boolean filter over a list of ids —
// the cheapest possible thing to apply locally and reverse if the write fails.
export function useHideTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tournamentId: string) => hiddenTournamentsApi.hide(tournamentId),
    onMutate: async (tournamentId) => {
      await qc.cancelQueries({ queryKey: queryKeys.hiddenTournaments });
      const previous = qc.getQueryData<string[]>(queryKeys.hiddenTournaments);
      qc.setQueryData<string[]>(queryKeys.hiddenTournaments, (old) =>
        old ? (old.includes(tournamentId) ? old : [...old, tournamentId]) : [tournamentId],
      );
      return { previous };
    },
    onSuccess: () => { toastSuccess("toast.tournament.hidden"); },
    onError: (e: unknown, _tournamentId, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKeys.hiddenTournaments, ctx.previous);
      toastError("toast.tournament.hideFailed", e);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.hiddenTournaments });
      qc.invalidateQueries({ queryKey: queryKeys.tournaments });
    },
  });
}

export function useUnhideTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tournamentId: string) => hiddenTournamentsApi.unhide(tournamentId),
    onMutate: async (tournamentId) => {
      await qc.cancelQueries({ queryKey: queryKeys.hiddenTournaments });
      const previous = qc.getQueryData<string[]>(queryKeys.hiddenTournaments);
      qc.setQueryData<string[]>(queryKeys.hiddenTournaments, (old) => old?.filter((id) => id !== tournamentId));
      return { previous };
    },
    onSuccess: () => { toastSuccess("toast.tournament.unhidden"); },
    onError: (e: unknown, _tournamentId, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKeys.hiddenTournaments, ctx.previous);
      toastError("toast.tournament.unhideFailed", e);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.hiddenTournaments });
      qc.invalidateQueries({ queryKey: queryKeys.tournaments });
    },
  });
}

// ─── Finance Hooks ───

export function useFinanceEntries(playerId: string) {
  return useQuery({
    queryKey: queryKeys.finance(playerId),
    queryFn: async () => (await financeApi.getEntries(playerId)).data,
    enabled: !!playerId,
  });
}

export function useFinanceSummary(playerId: string) {
  return useQuery({
    queryKey: queryKeys.financeSummary(playerId),
    queryFn: async () => (await financeApi.getSummary(playerId)).data,
    enabled: !!playerId,
  });
}

export function useCreateFinanceEntry() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ playerId, data }: { playerId: string; data: Omit<FinanceEntry, "id" | "createdAt" | "playerId"> }) =>
      financeApi.createEntry(playerId, data),
    onSuccess: (_, vars) => { inv.finance(vars.playerId); toastSuccess("toast.finance.added"); },
    onError: (e: unknown) => toastError("toast.finance.addFailed", e),
  });
}

// ─── Equipment Hooks ───

export function useEquipment(playerId: string) {
  return useQuery({
    queryKey: queryKeys.equipment(playerId),
    queryFn: async () => (await equipmentApi.getItems(playerId)).data,
    enabled: !!playerId,
  });
}

export function useCreateEquipment() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: (data: Omit<EquipmentItem, "id">) => equipmentApi.createItem(data),
    onSuccess: (_, vars) => { inv.equipment(vars.playerId); toastSuccess("toast.equipment.added"); },
    onError: (e: unknown) => toastError("toast.equipment.addFailed", e),
  });
}

export function useUpdateEquipment() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, data, playerId }: { id: string; data: Partial<EquipmentItem>; playerId: string }) =>
      equipmentApi.updateItem(id, data),
    onSuccess: (_, vars) => { inv.equipment(vars.playerId); toastSuccess("toast.equipment.updated"); },
    onError: (e: unknown) => toastError("toast.equipment.updateFailed", e),
  });
}

export function useDeleteEquipment() {
  const inv = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, playerId }: { id: string; playerId: string }) => equipmentApi.deleteItem(id),
    onSuccess: (_, vars) => { inv.equipment(vars.playerId); toastSuccess("toast.equipment.removed"); },
    onError: (e: unknown) => toastError("toast.equipment.removeFailed", e),
  });
}

// ─── Notification Hooks ───

export function useNotifications(userId: string) {
  return useQuery({
    queryKey: queryKeys.notifications(userId),
    queryFn: async () => (await notificationsApi.getNotifications(userId)).data,
    enabled: !!userId,
  });
}

// Optimistic: marking one notification read is a single boolean flip, fired the
// moment the user taps a row — waiting for a round-trip before the badge drops
// is the most visible lag in the app. Every ["notifications", userId] cache is
// patched, then restored verbatim if the write fails.
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const previous = qc.getQueriesData<Notification[]>({ queryKey: ["notifications"] });
      qc.setQueriesData<Notification[]>({ queryKey: ["notifications"] }, (old) =>
        old?.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      return { previous };
    },
    onError: (e: unknown, _id, ctx) => {
      ctx?.previous.forEach(([key, data]) => { qc.setQueryData(key, data); });
      toastError("toast.notification.markReadFailed", e);
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => notificationsApi.markAllRead(userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); toastSuccess("toast.notification.allRead"); },
    onError: (e: unknown) => toastError("toast.notification.allReadFailed", e),
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notificationPrefs,
    queryFn: async () => (await notificationsApi.getPreferences()).data,
  });
}

/** Shared by every in-flight preference save, so a burst of toggles can be counted (see onSettled). */
const NOTIFICATION_PREFS_MUTATION_KEY = ["updateNotificationPrefs"] as const;

// Optimistic: a preference is one boolean on a record the client already
// holds. The switch flips as it is tapped; if the save fails the record is put
// back and a toast says so. No success toast — the switch staying flipped is
// the confirmation, and six toasts for six toggles would be noise.
export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: NOTIFICATION_PREFS_MUTATION_KEY,
    mutationFn: (data: Partial<NotificationSettings>) => notificationsApi.updatePreferences(data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: queryKeys.notificationPrefs });
      const previous = qc.getQueryData<NotificationSettings>(queryKeys.notificationPrefs);
      qc.setQueryData<NotificationSettings>(queryKeys.notificationPrefs, (old) => (old ? { ...old, ...data } : old));
      return { previous };
    },
    onError: (e: unknown, _data, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKeys.notificationPrefs, ctx.previous);
      toastError("toast.notification.preferenceFailed", e);
    },
    // Refetch only when the LAST toggle settles: an early response would carry
    // a record that predates the later taps and flick those switches back
    // until their own responses land (the attendance register does the same).
    onSettled: () => {
      if (qc.isMutating({ mutationKey: NOTIFICATION_PREFS_MUTATION_KEY }) === 1) {
        qc.invalidateQueries({ queryKey: queryKeys.notificationPrefs });
      }
    },
  });
}

// ─── Profile Hooks ───

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (data: Partial<User>) => profileApi.updateProfile(data),
    onSuccess: () => toastSuccess("toast.profile.updated"),
    onError: (e: unknown) => toastError("toast.profile.updateFailed", e),
  });
}

// ── Calendar preferences ────────────────────────────────────────────────────
//
// Which tournament calendars this user has subscribed to. Kept on the account,
// not in the browser: the filters used to be session-only, so a coach re-hid
// 1,458 September events on every visit and again on their phone.

export function useCalendarPreferences() {
  return useQuery({
    queryKey: queryKeys.calendarPrefs,
    queryFn: async () => (await calendarPreferencesApi.get()).data,
    // A subscription changes about twice a year. Refetching it on every window
    // focus is pure noise.
    staleTime: 10 * 60 * 1000,
  });
}

export function useSaveCalendarPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: { federations: string[]; showOwnEvents?: boolean }) =>
      calendarPreferencesApi.save(prefs),
    // Optimistic: toggling a calendar should redraw immediately. A round trip
    // before the tick appears makes the control feel broken.
    onMutate: async (prefs) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.calendarPrefs });
      const previous = queryClient.getQueryData<CalendarPreferences>(queryKeys.calendarPrefs);
      queryClient.setQueryData<CalendarPreferences>(queryKeys.calendarPrefs, {
        showOwnEvents: previous?.showOwnEvents ?? true,
        ...prefs,
      });
      return { previous };
    },
    onError: (e: unknown, _vars, context) => {
      // Put the old choice back rather than leaving the UI showing a state the
      // server never accepted.
      if (context?.previous) queryClient.setQueryData(queryKeys.calendarPrefs, context.previous);
      toastError("toast.calendarPrefs.saveFailed", e);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.calendarPrefs }),
  });
}
