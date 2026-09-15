// The three facts that ride with a tournament wherever a player decides about
// it. The countdown is deadline-first — while entries are open the chip counts
// to the deadline, not the first ball — and the preparation chip only ever says
// what the server recorded, and says nothing once the event is over.

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EntryDeadlineNote, PrepStatusChip, TimeLeftChip } from "@/components/tournaments/TournamentChips";

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

afterEach(cleanup);

describe("TimeLeftChip", () => {
  it("counts to the entry deadline while entries are open, and flags it urgent when close", () => {
    render(<TimeLeftChip tournament={{ startDate: iso(20), endDate: iso(22), entryDeadline: iso(2) }} />);
    const chip = screen.getByTestId("time-left-chip");
    expect(chip.dataset.kind).toBe("entry");
    expect(chip.dataset.tone).toBe("urgent");
    expect(chip.textContent).toMatch(/Entries close in 2 days/);
  });

  it("counts to the start once there is no deadline to beat", () => {
    render(<TimeLeftChip tournament={{ startDate: iso(12), endDate: iso(14) }} />);
    const chip = screen.getByTestId("time-left-chip");
    expect(chip.dataset.kind).toBe("start");
    expect(chip.textContent).toMatch(/Starts in 12 days/);
  });

  it("says so when the event is on, and when it is over", () => {
    render(<TimeLeftChip tournament={{ startDate: iso(-1), endDate: iso(2) }} />);
    expect(screen.getByTestId("time-left-chip").dataset.kind).toBe("running");
    cleanup();
    render(<TimeLeftChip tournament={{ startDate: iso(-9), endDate: iso(-3) }} />);
    expect(screen.getByTestId("time-left-chip").dataset.kind).toBe("finished");
  });
});

describe("EntryDeadlineNote", () => {
  it("names the day entries close", () => {
    render(<EntryDeadlineNote tournament={{ entryDeadline: "2026-10-03T00:00:00.000Z" }} />);
    expect(screen.getByTestId("entry-deadline").textContent).toMatch(/Entry deadline .*3 Oct 2026|Oct 3, 2026/);
  });

  it("renders nothing when the feed carried no deadline — never a guess", () => {
    render(<EntryDeadlineNote tournament={{}} />);
    expect(screen.queryByTestId("entry-deadline")).toBeNull();
  });
});

describe("PrepStatusChip", () => {
  it("reports a recorded preparation with its date", () => {
    render(<PrepStatusChip preparedAt="2026-09-10T10:00:00.000Z" tournament={{ endDate: iso(5) }} />);
    const chip = screen.getByTestId("prep-status-chip");
    expect(chip.dataset.prepared).toBe("true");
    expect(chip.textContent).toMatch(/Prepared/);
  });

  it("says 'not yet' when the server has no successful run", () => {
    render(<PrepStatusChip tournament={{ endDate: iso(5) }} />);
    const chip = screen.getByTestId("prep-status-chip");
    expect(chip.dataset.prepared).toBe("false");
    expect(chip.textContent).toMatch(/Not prepared yet/);
  });

  it("stays silent for an event that is already over", () => {
    render(<PrepStatusChip tournament={{ endDate: iso(-2) }} />);
    expect(screen.queryByTestId("prep-status-chip")).toBeNull();
  });
});
