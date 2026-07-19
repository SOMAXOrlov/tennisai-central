// Shareable, human-facing directory IDs, e.g. "TAI-P-4X9Q2A".
// Deterministic from the user id so it is stable, and role-prefixed so the
// connection dialog can hint the expected target role.

const ROLE_LETTER: Record<string, string> = {
  player: "P",
  coach: "C",
  observer: "F",
  admin: "A",
};

/** Short stable base36 hash of a string. */
function hash6(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36).toUpperCase().slice(0, 6).padStart(6, "0");
}

export function publicIdFor(role: string, id: string): string {
  const letter = ROLE_LETTER[role] ?? "X";
  return `TAI-${letter}-${hash6(id)}`;
}
