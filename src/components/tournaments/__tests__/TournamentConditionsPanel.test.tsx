// The conditions panel's honesty: every weather figure says what KIND of data
// it is, a missing value reads "Not available" rather than a guess, and the
// "Prepare for this match" button explains why it cannot run.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TournamentConditions } from "@/api/endpoints/conditions";
import { TournamentConditionsPanel } from "@/components/tournaments/TournamentConditionsPanel";
import { prepBlocker } from "@/lib/tournamentConditions";

const { conditions, ai, auth } = vi.hoisted(() => ({
  conditions: { get: vi.fn(), setBall: vi.fn(), matchPrep: vi.fn() },
  ai: { status: vi.fn(), usage: vi.fn(), trainingAdvice: vi.fn() },
  auth: { user: { id: "p1", role: "player" } as { id: string; role: string } | null },
}));

vi.mock("@/api/endpoints/conditions", () => ({ conditionsApi: conditions }));
vi.mock("@/api/endpoints/aiAdvice", () => ({ aiAdviceApi: ai }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));

const BASE: TournamentConditions = {
  tournament: {
    id: "t1",
    name: "Open de Valencia",
    city: "Valencia",
    country: "Spain",
    surface: "Clay",
    indoorOutdoor: "outdoor",
    ballBrand: null,
    startDate: "2026-10-10T00:00:00.000Z",
    endDate: "2026-10-14T00:00:00.000Z",
  },
  altitudeM: 15,
  altitudeSource: "catalog",
  altitudeAssumed: false,
  weather: {
    kind: "forecast",
    temperatureC: 24,
    temperatureMaxC: 28,
    temperatureMinC: 18,
    humidityPct: 55,
    source: "Open-Meteo forecast",
  },
  weatherError: null,
  physics: {
    airDensity: 1.19,
    densityVsReferencePct: -2.1,
    pressureHPa: 1012,
    speed: "faster",
    bounce: "higher",
    drivers: ["Warm air is thinner"],
  },
  physicsBasis: "outdoor",
};

function mount(props: Partial<React.ComponentProps<typeof TournamentConditionsPanel>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TournamentConditionsPanel tournamentId="t1" {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  conditions.get.mockReset();
  ai.status.mockReset();
  ai.usage.mockReset();
  auth.user = { id: "p1", role: "player" };
  ai.status.mockResolvedValue({ configured: false, provider: null });
});
afterEach(cleanup);

describe("weather basis labelling", () => {
  it("labels a live forecast as a forecast and says how far ahead forecasts reach", async () => {
    conditions.get.mockResolvedValue(BASE);
    mount();
    expect(await screen.findByTestId("weather-basis")).toHaveTextContent("Live forecast");
    expect(screen.getByTestId("weather-basis-detail")).toHaveTextContent(/A forecast for .*October.*2026/);
    expect(screen.getByText("Source: Open-Meteo forecast")).toBeInTheDocument();
  });

  it("labels a historical average as NOT a forecast and says how many years it averages", async () => {
    conditions.get.mockResolvedValue({
      ...BASE,
      weather: { ...BASE.weather!, kind: "typical", basedOnYears: 5, source: "Open-Meteo archive, 5 years" },
    });
    mount();
    expect(await screen.findByTestId("weather-basis")).toHaveTextContent("Historical average");
    const detail = screen.getByTestId("weather-basis-detail");
    expect(detail).toHaveTextContent(/Not a forecast/);
    expect(detail).toHaveTextContent(/5 previous years/);
  });

  it("says plainly when there is no weather, and that the ball behaviour cannot be calculated", async () => {
    conditions.get.mockResolvedValue({
      ...BASE,
      weather: null,
      weatherError: null,
      physics: null,
      tournament: { ...BASE.tournament, surface: "Unknown" },
      altitudeM: null,
      altitudeSource: null,
    });
    mount();
    expect(await screen.findByTestId("weather-basis")).toHaveTextContent("No weather data");
    expect(screen.getByTestId("weather-basis-detail")).toHaveTextContent("Nothing is shown rather than a guess.");
    expect(screen.getByTestId("ball-behaviour")).toHaveTextContent("Ball behaviour cannot be calculated without weather data.");
    // Two missing facts, two "Not available" — never a made-up surface or altitude.
    expect(screen.getAllByText("Not available")).toHaveLength(2);
  });

  it("renders the computed ball behaviour as a calculation, not as AI", async () => {
    conditions.get.mockResolvedValue(BASE);
    mount();
    const physics = await screen.findByTestId("ball-behaviour");
    expect(physics).toHaveTextContent("The ball will move through the air faster than usual and bounce higher.");
    expect(physics).toHaveTextContent(/calculated, not estimated by AI/);
    expect(physics).toHaveTextContent("Warm air is thinner");
  });
});

describe("prepBlocker ordering", () => {
  const ok = { aiConfigured: true, role: "player", targetPlayerId: "p1", hasPhysics: true, remaining: 10 };

  it("returns null when everything is in place", () => {
    expect(prepBlocker(ok)).toBeNull();
  });

  it("puts a switched-off feature before every other reason", () => {
    expect(prepBlocker({ ...ok, aiConfigured: false, role: "observer", targetPlayerId: null, hasPhysics: false, remaining: 0 })).toBe("aiOff");
  });

  it("then read-only, then who to prepare, then weather, then quota", () => {
    expect(prepBlocker({ ...ok, role: "observer", targetPlayerId: null, hasPhysics: false, remaining: 0 })).toBe("readOnly");
    expect(prepBlocker({ ...ok, role: "coach", targetPlayerId: null, hasPhysics: false, remaining: 0 })).toBe("noPlayer");
    expect(prepBlocker({ ...ok, role: "coach", targetPlayerId: null, candidateCount: 3, hasPhysics: false })).toBe("pickPlayer");
    expect(prepBlocker({ ...ok, hasPhysics: false, remaining: 0 })).toBe("noWeather");
    expect(prepBlocker({ ...ok, remaining: 0 })).toBe("quota");
  });

  it("does not block on quota while the counter is still unknown", () => {
    expect(prepBlocker({ ...ok, remaining: undefined })).toBeNull();
  });
});

describe("Prepare for this match CTA", () => {
  it("is disabled with the honest reason when the AI provider is not configured", async () => {
    conditions.get.mockResolvedValue(BASE);
    mount();
    const cta = await screen.findByTestId("prep-cta");
    await waitFor(() => expect(screen.getByTestId("prep-blocker")).toBeInTheDocument());
    expect(cta).toBeDisabled();
    expect(screen.getByTestId("prep-blocker")).toHaveTextContent("AI analysis is not enabled on this server.");
    // No counter is shown for a feature that is off.
    expect(screen.queryByTestId("ai-usage")).toBeNull();
    expect(ai.usage).not.toHaveBeenCalled();
  });

  it("is enabled for a player with weather when the feature is on, and shows the counter", async () => {
    ai.status.mockResolvedValue({ configured: true, provider: "anthropic" });
    ai.usage.mockResolvedValue({ periodKey: "2026-09", reportsGenerated: 1, limit: 100, remaining: 99 });
    conditions.get.mockResolvedValue(BASE);
    mount();
    const cta = await screen.findByTestId("prep-cta");
    await waitFor(() => expect(cta).toBeEnabled());
    expect(screen.queryByTestId("prep-blocker")).toBeNull();
    expect(await screen.findByTestId("ai-usage")).toHaveTextContent("99 of 100 AI generations left this month");
  });

  it("tells an observer their account is read-only", async () => {
    ai.status.mockResolvedValue({ configured: true, provider: "anthropic" });
    ai.usage.mockResolvedValue({ periodKey: "2026-09", reportsGenerated: 0, limit: 100, remaining: 100 });
    auth.user = { id: "o1", role: "observer" };
    conditions.get.mockResolvedValue(BASE);
    mount();
    await screen.findByTestId("prep-cta");
    await waitFor(() => expect(screen.getByTestId("prep-blocker")).toHaveTextContent(/read-only/));
    expect(screen.getByTestId("prep-cta")).toBeDisabled();
  });

  it("asks a coach with nobody entered to add a player first", async () => {
    ai.status.mockResolvedValue({ configured: true, provider: "anthropic" });
    ai.usage.mockResolvedValue({ periodKey: "2026-09", reportsGenerated: 0, limit: 100, remaining: 100 });
    auth.user = { id: "c1", role: "coach" };
    conditions.get.mockResolvedValue(BASE);
    mount({ candidates: [] });
    await screen.findByTestId("prep-cta");
    await waitFor(() => expect(screen.getByTestId("prep-blocker")).toHaveTextContent(/Add a player to this tournament first/));
  });

  it("names the one entered player on the button for a coach", async () => {
    ai.status.mockResolvedValue({ configured: true, provider: "anthropic" });
    ai.usage.mockResolvedValue({ periodKey: "2026-09", reportsGenerated: 0, limit: 100, remaining: 100 });
    auth.user = { id: "c1", role: "coach" };
    conditions.get.mockResolvedValue(BASE);
    mount({ candidates: [{ id: "p7", name: "Sam" }] });
    const cta = await screen.findByTestId("prep-cta");
    await waitFor(() => expect(cta).toBeEnabled());
    expect(cta).toHaveTextContent("Prepare Sam for this match");
  });
});
