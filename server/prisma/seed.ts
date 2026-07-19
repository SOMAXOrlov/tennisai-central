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

  console.log(`✅ Seeded ${DEMO_USERS.length} demo users (password: password123):`);
  DEMO_USERS.forEach((u) => console.log(`   • ${u.email} (${u.role})`));
  console.log(`✅ Seeded ${DEMO_TRAININGS.length} demo trainings for coach c1 / player p1.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
