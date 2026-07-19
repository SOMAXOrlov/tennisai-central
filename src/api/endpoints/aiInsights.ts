// ============================================================
// TennisAI — AI Insights Service
// Mock rule-based engine, same shape as a future LLM backend.
// TODO: When backend is ready, set USE_MOCK = false and expose:
//   POST /ai/match-prep      { input, playerId } -> AIInsightResult
//   GET  /ai/coach-insights  ?coachId=...        -> CoachTrainingInsights
// ============================================================

import type {
  AIInsightInput,
  AIInsightResult,
  ApiResponse,
  EquipmentItem,
  TrainingSession,
} from "@/types";
import { apiClient } from "@/api/client";
import { mockStore } from "@/mock/store";

const USE_MOCK = true;
const delay = (ms = 900) => new Promise((r) => setTimeout(r, ms));

// --- Coach insights types ---
// TODO: move to @/types/index.ts once the backend contract is final
export interface CoachInsightStat {
  label: string;
  value: string;
  hint?: string;
}

export interface CoachTrainingInsights {
  periodLabel: string;
  stats: CoachInsightStat[];
  observations: string[];
  recommendations: string[];
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// Match-prep rule engine (mock "AI")
// ─────────────────────────────────────────────────────────────

function buildMatchPrep(input: AIInsightInput, equipment: EquipmentItem[]): AIInsightResult {
  const risks: string[] = [];
  const prep: string[] = [];
  const gear: string[] = [];
  const summaryParts: string[] = [];

  const surface = (input.surface || "hard").toLowerCase();
  const weather = (input.weather || "mild").toLowerCase();
  const altitude = input.altitude ?? 0;
  const load = (input.recentTrainingLoad || "moderate").toLowerCase();
  const style = (input.playerStyle || "all-court").toLowerCase();

  const strings = equipment.filter((e) => e.category === "string");
  const rackets = equipment.filter((e) => e.category === "racket");
  const shoes = equipment.filter((e) => e.category === "shoes");
  const badString = strings.find((s) =>
    ["fraying", "losing tension", "broken", "dead"].some((c) => (s.condition || "").toLowerCase().includes(c))
  );
  const wornShoes = shoes.find((s) =>
    ["worn", "poor", "smooth"].some((c) => (s.condition || "").toLowerCase().includes(c))
  );

  // --- Surface ---
  if (surface.includes("clay")) {
    summaryParts.push("Clay slows the ball and raises the bounce — expect longer rallies");
    prep.push("Practice sliding into open-stance shots and hitting with extra net clearance.");
    prep.push("Plan for longer points: extend your warm-up rallies to 15+ shots.");
    gear.push("Drop string tension 1–2 lbs from your hard-court setup for extra depth and spin.");
    if (wornShoes) gear.push(`Your ${wornShoes.name} tread looks ${(wornShoes.condition || "worn").toLowerCase()} — clay demands a full herringbone sole for controlled sliding.`);
    else gear.push("Use clay-court shoes (full herringbone tread) for controlled sliding.");
  } else if (surface.includes("grass")) {
    summaryParts.push("Grass keeps the ball low and fast — points will be short");
    prep.push("Drill low volleys, slices, and split-step timing; the bounce will stay below your knees.");
    gear.push("String 1–2 lbs tighter for control on fast exchanges; consider a hybrid setup for feel.");
  } else {
    summaryParts.push("Hard court gives a true, medium-fast bounce");
    prep.push("Rehearse first-strike patterns: serve +1 and return +1 will decide most points.");
    gear.push("Durable poly mains recommended — hard courts chew through soft strings fastest.");
  }

  // --- Weather ---
  if (weather.includes("hot")) {
    summaryParts.push("in hot conditions the ball flies faster and strings lose tension quicker");
    risks.push("Heat: dehydration and mid-match tension loss in your strings.");
    prep.push("Hydrate from the evening before; schedule electrolytes every changeover.");
    gear.push("String ~2 lbs tighter than usual — heat makes the stringbed play softer and launchier.");
  } else if (weather.includes("cold")) {
    summaryParts.push("cold air deadens the ball and stiffens strings");
    risks.push("Cold: higher muscle-injury risk and a board-like stringbed.");
    prep.push("Double your dynamic warm-up (10+ min) and keep layers on between points.");
    gear.push("Drop tension ~2 lbs so the stringbed keeps some pocketing in the cold.");
  } else if (weather.includes("wind")) {
    summaryParts.push("wind will disrupt toss and depth control");
    risks.push("Wind: service toss instability and mistimed contact.");
    prep.push("Practice an abbreviated, lower ball toss and add heavy topspin margin crosscourt.");
  } else if (weather.includes("humid") || weather.includes("rain")) {
    summaryParts.push("humidity makes balls heavier and grips slippery");
    risks.push("Humidity: heavier balls strain the shoulder; sweat compromises grip.");
    gear.push("Pack 2–3 fresh overgrips and a towel per set; consider rosin/grip enhancer.");
  } else {
    summaryParts.push("mild weather — neutral playing conditions");
  }

  // --- Altitude ---
  if (altitude > 1000) {
    summaryParts.push(`at ${altitude} m altitude the ball flies noticeably further`);
    risks.push("Altitude: balls fly ~10% further — overhitting is the #1 error above 1000 m.");
    prep.push("Arrive 1–2 days early if possible; aim 1 m shorter than your usual targets.");
    gear.push("String 2–3 lbs tighter to tame the extra ball flight; pressureless or high-altitude balls if allowed.");
  }

  // --- Equipment condition from the player's actual bag ---
  if (badString) {
    risks.push(`Your ${badString.name} is "${badString.condition}" — a mid-match break or unpredictable tension is likely.`);
    gear.push(`Restring before the match${badString.notes ? ` (last setup: ${badString.notes})` : ""} and prepare a second strung racket.`);
  }
  if (rackets.length >= 2) {
    gear.push(`Bring both rackets (${rackets.map((r) => r.name).join(", ")}) strung identically so a string break costs you nothing.`);
  } else if (rackets.length === 1) {
    risks.push("Only one racket in your bag — a string break mid-match would be costly.");
    gear.push("Arrange a backup racket, even a borrowed one, strung close to your tension.");
  }

  // --- Style & load ---
  if (style.includes("aggressive") || style.includes("attack")) {
    prep.push("Your aggressive game: commit to the first strike, but pick crosscourt when off balance.");
  } else if (style.includes("counter") || style.includes("defen")) {
    prep.push("Your counterpunching game: use height and depth to neutralize, attack only short balls.");
  } else if (style.includes("serve")) {
    prep.push("Serve-forward game: chart first-serve percentage in warm-up; 60%+ is your green light to attack.");
  }
  if (load.includes("heavy") || load.includes("high")) {
    risks.push("Heavy recent training load — accumulated fatigue can surface in the third set.");
    prep.push("Take tomorrow as active recovery; prioritize sleep over extra hitting.");
  } else if (load.includes("light") || load.includes("low")) {
    prep.push("Training load has been light — add a high-intensity practice set 2 days out to sharpen timing.");
  }

  if (input.ballBrand) {
    prep.push(`Practice with ${input.ballBrand} balls before the event — ball response varies noticeably between brands.`);
  }

  return {
    matchConditionsSummary: summaryParts.join("; ") + ".",
    expectedRisks: risks.length ? risks : ["No major risks detected for these conditions."],
    preparationRecommendations: prep,
    equipmentRecommendations: gear,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// Coach training-insights engine (mock "AI")
// ─────────────────────────────────────────────────────────────

function buildCoachInsights(trainings: TrainingSession[]): CoachTrainingInsights {
  const observations: string[] = [];
  const recommendations: string[] = [];

  const reviewed = trainings.filter((t) => t.review);
  const withFeedback = trainings.filter((t) => t.playerSessionFeedback);
  const highIntensity = trainings.filter((t) => t.intensity === "high");

  const avgRating = reviewed.length
    ? reviewed.reduce((s, t) => s + (t.review?.rating ?? 0), 0) / reviewed.length
    : 0;

  const avgEnergy = withFeedback.length
    ? withFeedback.reduce((s, t) => s + (t.playerSessionFeedback?.energyLevel ?? 0), 0) / withFeedback.length
    : 0;

  // Tag frequency across player feedback
  const tagCounts = new Map<string, number>();
  withFeedback.forEach((t) =>
    t.playerSessionFeedback?.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1))
  );
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Player coverage
  const playerSessionCount = new Map<string, number>();
  trainings.forEach((t) => t.playerIds.forEach((p) => playerSessionCount.set(p, (playerSessionCount.get(p) ?? 0) + 1)));

  // --- Observations ---
  if (reviewed.length) {
    observations.push(`You reviewed ${reviewed.length} of ${trainings.length} sessions with an average rating of ${avgRating.toFixed(1)}/5.`);
  }
  if (trainings.length && reviewed.length < trainings.length) {
    observations.push(`${trainings.length - reviewed.length} session(s) still lack a review — reviews are the raw material for player development tracking.`);
  }
  if (topTags.length) {
    observations.push(`Most common player feedback: ${topTags.map(([tag, n]) => `"${tag}" (${n}x)`).join(", ")}.`);
  }
  if (highIntensity.length / Math.max(trainings.length, 1) > 0.5) {
    observations.push(`${highIntensity.length} of ${trainings.length} sessions were high intensity — the group is training hot.`);
  }
  const tacticalCount = trainings.filter((t) => t.trainingType === "tactical").length;
  const fitnessCount = trainings.filter((t) => t.trainingType === "fitness").length;
  observations.push(`Session mix: ${tacticalCount} tactical, ${fitnessCount} fitness, ${trainings.filter((t) => t.trainingType === "match_practice").length} match practice out of ${trainings.length} total.`);

  // --- Recommendations ---
  const tired = tagCounts.get("Felt tired") ?? 0;
  if (tired > 0 || (avgEnergy > 0 && avgEnergy < 3)) {
    recommendations.push("Fatigue signals detected in player feedback — schedule a recovery or low-intensity session this week.");
  }
  if ((tagCounts.get("Too hard") ?? 0) > (tagCounts.get("Too easy") ?? 0)) {
    recommendations.push("Players report sessions skewing too hard — mix in a confidence-building drill day.");
  } else if ((tagCounts.get("Too easy") ?? 0) > 0) {
    recommendations.push("Some players find sessions too easy — consider splitting the group by level for key drills.");
  }
  if (trainings.length && reviewed.length < trainings.length) {
    recommendations.push("Complete reviews for unreviewed sessions while details are fresh — this powers per-player AI insights later.");
  }
  const underTrained = [...playerSessionCount.entries()].filter(([, n]) => n === 1);
  if (underTrained.length && playerSessionCount.size > 1) {
    recommendations.push(`${underTrained.length} player(s) appeared in only one session — check whether they need more court time before the next tournament.`);
  }
  if (!recommendations.length) {
    recommendations.push("Training pattern looks balanced — keep the current rhythm and re-check after the next tournament block.");
  }

  return {
    periodLabel: "Recent sessions",
    stats: [
      { label: "Sessions", value: String(trainings.length) },
      { label: "Avg session rating", value: reviewed.length ? `${avgRating.toFixed(1)}/5` : "—", hint: `${reviewed.length} reviewed` },
      { label: "High intensity", value: `${highIntensity.length}/${trainings.length}` },
      { label: "Player feedback", value: String(withFeedback.length), hint: withFeedback.length ? `avg energy ${avgEnergy.toFixed(1)}/5` : "none submitted" },
    ],
    observations,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export const aiInsightsApi = {
  async generateMatchPrep(playerId: string, input: AIInsightInput): Promise<ApiResponse<AIInsightResult>> {
    if (USE_MOCK) {
      await delay();
      const equipment = mockStore.getEquipment(playerId);
      return { data: buildMatchPrep(input, equipment), message: "Match preparation analysis ready" };
    }
    return apiClient.post(`/ai/match-prep`, { playerId, input });
  },

  async getCoachInsights(coachId: string): Promise<ApiResponse<CoachTrainingInsights>> {
    if (USE_MOCK) {
      await delay(700);
      const trainings = mockStore.getTrainings().filter((t) => t.coachId === coachId);
      return { data: buildCoachInsights(trainings) };
    }
    return apiClient.get(`/ai/coach-insights?coachId=${coachId}`);
  },
};
