import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Demo accounts. IDs are pinned to match the front-end mock data
// (equipment, finance, etc. are keyed on p1 / c1 / …), so the seeded
// dashboard keeps working after auth becomes real.
const DEMO_USERS = [
  { id: "p1", email: "player@test.com", role: "player", firstName: "Alex", lastName: "Rivera" },
  { id: "c1", email: "coach@test.com", role: "coach", firstName: "Jordan", lastName: "Smith" },
  { id: "o1", email: "observer@test.com", role: "observer", firstName: "Morgan", lastName: "Lee" },
  { id: "a1", email: "admin@test.com", role: "admin", firstName: "Admin", lastName: "User" },
];

// A couple of demo trainings for coach c1 with player p1 as participant, so the
// Trainings page shows real DB-backed data for the demo logins.
const now = new Date();
const day = (offset: number, hour: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const DEMO_TRAININGS = [
  {
    id: "t-seed-1",
    title: "Serve & Volley Fundamentals",
    trainingType: "individual",
    coachId: "c1",
    startDate: day(1, 9),
    endDate: day(1, 11),
    location: "Center Court",
    goal: "Sharpen first-serve placement and net approach",
    intensity: "high",
  },
  {
    id: "t-seed-2",
    title: "Baseline Consistency Drill",
    trainingType: "fitness",
    coachId: "c1",
    startDate: day(3, 16),
    endDate: day(3, 17),
    location: "Court 3",
    goal: "20-ball rally consistency under fatigue",
    intensity: "medium",
  },
];

// A representative slice of the tournament catalog (pinned ids match the
// front-end mock cross-references). A real deployment would import the full feed.
const DEMO_TOURNAMENTS = [
  { id: "t1", name: "Australian Open 2026", city: "Melbourne", country: "Australia", surface: "Hard", indoorOutdoor: "outdoor", ballBrand: "Dunlop", category: "Grand Slam", level: "Professional", federation: "ATP", startDate: "2026-01-19T00:00:00Z", endDate: "2026-02-01T00:00:00Z" },
  { id: "t2", name: "Roland-Garros 2026", city: "Paris", country: "France", surface: "Clay", indoorOutdoor: "outdoor", ballBrand: "Wilson", category: "Grand Slam", level: "Professional", federation: "ATP", startDate: "2026-05-24T00:00:00Z", endDate: "2026-06-07T00:00:00Z" },
  { id: "t3", name: "Wimbledon 2026", city: "London", country: "UK", surface: "Grass", indoorOutdoor: "outdoor", ballBrand: "Slazenger", category: "Grand Slam", level: "Professional", federation: "WTA", startDate: "2026-06-29T00:00:00Z", endDate: "2026-07-12T00:00:00Z" },
  { id: "t4", name: "US Open 2026", city: "New York", country: "USA", surface: "Hard", indoorOutdoor: "outdoor", ballBrand: "Wilson", category: "Grand Slam", level: "Professional", federation: "USTA", startDate: "2026-08-31T00:00:00Z", endDate: "2026-09-13T00:00:00Z" },
  { id: "t5", name: "Indian Wells Masters", city: "Indian Wells", country: "USA", surface: "Hard", indoorOutdoor: "outdoor", ballBrand: "Penn", category: "ATP 1000", level: "Professional", federation: "ATP", startDate: "2026-03-09T00:00:00Z", endDate: "2026-03-22T00:00:00Z" },
  { id: "t6", name: "Miami Open", city: "Miami", country: "USA", surface: "Hard", indoorOutdoor: "outdoor", ballBrand: "Wilson", category: "ATP 1000", level: "Professional", federation: "ATP", startDate: "2026-03-23T00:00:00Z", endDate: "2026-04-05T00:00:00Z" },
  { id: "t7", name: "Madrid Open", city: "Madrid", country: "Spain", surface: "Clay", indoorOutdoor: "outdoor", altitude: 650, ballBrand: "Dunlop", category: "ATP 1000", level: "Professional", federation: "ATP", startDate: "2026-04-27T00:00:00Z", endDate: "2026-05-10T00:00:00Z" },
  { id: "t8", name: "Internazionali BNL d'Italia", city: "Rome", country: "Italy", surface: "Clay", indoorOutdoor: "outdoor", ballBrand: "Dunlop", category: "ATP 1000", level: "Professional", federation: "ATP", startDate: "2026-05-11T00:00:00Z", endDate: "2026-05-18T00:00:00Z" },
];

// Demo tournament entries for player p1.
const DEMO_PLAYER_TOURNAMENTS = [
  { id: "pt1", tournamentId: "t1", playerId: "p1", status: "registered" },
  { id: "pt2", tournamentId: "t3", playerId: "p1", status: "planned" },
];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  for (const u of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { firstName: u.firstName, lastName: u.lastName, role: u.role },
      create: { ...u, passwordHash, emailVerified: true },
    });
  }

  for (const t of DEMO_TRAININGS) {
    await prisma.training.upsert({
      where: { id: t.id },
      update: { title: t.title, startDate: t.startDate, endDate: t.endDate },
      create: {
        ...t,
        participants: { create: [{ playerId: "p1" }] },
      },
    });
  }

  for (const t of DEMO_TOURNAMENTS) {
    const { startDate, endDate, ...rest } = t;
    const values = { ...rest, startDate: new Date(startDate), endDate: new Date(endDate) };
    await prisma.tournament.upsert({ where: { id: t.id }, update: values, create: values });
  }

  for (const pt of DEMO_PLAYER_TOURNAMENTS) {
    await prisma.playerTournament.upsert({
      where: { tournamentId_playerId: { tournamentId: pt.tournamentId, playerId: pt.playerId } },
      update: { status: pt.status },
      create: pt,
    });
  }

  console.log(`✅ Seeded ${DEMO_USERS.length} demo users (password: password123):`);
  DEMO_USERS.forEach((u) => console.log(`   • ${u.email} (${u.role})`));
  console.log(`✅ Seeded ${DEMO_TRAININGS.length} demo trainings for coach c1 / player p1.`);
  console.log(`✅ Seeded ${DEMO_TOURNAMENTS.length} tournaments + ${DEMO_PLAYER_TOURNAMENTS.length} entries for p1.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
