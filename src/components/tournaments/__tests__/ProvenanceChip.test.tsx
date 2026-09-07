// The provenance chip must say, for every row, which feed listed it and when
// that feed last confirmed it — and must never dress a hand-entered row up as
// a feed, or a feed row with no confirmation as fresh.

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { t } from "@/lib/i18n";
import { ProvenanceChip, ProvenanceLegend } from "@/components/tournaments/ProvenanceChip";
import { describeProvenance } from "@/lib/tournamentProvenance";

const NOW = new Date("2026-09-05T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

afterEach(cleanup);

describe("describeProvenance", () => {
  it("names a UTR feed row and when the feed last confirmed it", () => {
    const text = describeProvenance({ source: "utr-events", lastSeenAt: hoursAgo(3), updatedAt: hoursAgo(1) }, t, NOW);
    expect(text.source).toBe("via UTR");
    expect(text.freshness).toBe("checked 3 hours ago");
    expect(text.manual).toBe(false);
    // The feed timestamp wins over the row's own updatedAt for a sourced row.
    expect(text.at).toBe(hoursAgo(3));
  });

  it("names an ITF Juniors feed row", () => {
    const text = describeProvenance({ source: "itf-juniors", lastSeenAt: hoursAgo(26) }, t, NOW);
    expect(text.source).toBe("via ITF Juniors");
    expect(text.freshness).toBe("checked yesterday");
  });

  it("calls a row with no source manual and dates it by its last edit", () => {
    const text = describeProvenance({ source: undefined, lastSeenAt: undefined, updatedAt: hoursAgo(2) }, t, NOW);
    expect(text.source).toBe("Added manually");
    expect(text.freshness).toBe("edited 2 hours ago");
    expect(text.manual).toBe(true);
  });

  it("shows an unknown feed's slug verbatim rather than guessing a name", () => {
    const text = describeProvenance({ source: "regional-club-feed", lastSeenAt: hoursAgo(1) }, t, NOW);
    expect(text.source).toBe("via regional-club-feed");
  });

  it("says freshness is not available for a feed row the feed never confirmed", () => {
    const text = describeProvenance({ source: "utr-events", lastSeenAt: undefined, updatedAt: hoursAgo(1) }, t, NOW);
    expect(text.source).toBe("via UTR");
    expect(text.freshness).toBe("freshness not available");
    expect(text.at).toBeNull();
  });
});

describe("<ProvenanceChip />", () => {
  it("renders the source and freshness with an accessible label", () => {
    render(<ProvenanceChip tournament={{ source: "utr-events", lastSeenAt: new Date(Date.now() - 3 * 3_600_000 - 60_000).toISOString() }} />);
    const chip = screen.getByTestId("provenance-chip");
    expect(chip).toHaveTextContent("via UTR");
    expect(chip).toHaveTextContent("checked 3 hours ago");
    expect(chip).toHaveAttribute("aria-label", "Source: via UTR. checked 3 hours ago");
    // The exact timestamp is one hover away.
    expect(chip.getAttribute("title")).toBeTruthy();
  });

  it("renders the legend text once", () => {
    render(<ProvenanceLegend />);
    expect(screen.getByTestId("provenance-legend")).toHaveTextContent(/Each chip names the feed/);
  });
});

describe("a coach-entered row", () => {
  it("reads as hand-entered, and says when it was last edited", () => {
    // Not "via coach-entered", and not a feed freshness it never had. A coach
    // must be able to tell their own entry from a collected one at a glance.
    const text = describeProvenance(
      { source: "coach-entered", lastSeenAt: undefined, updatedAt: hoursAgo(26) },
      t,
      NOW,
    );
    expect(text.source).toBe("Entered by a coach");
    expect(text.manual).toBe(true);
    expect(text.freshness).toBe("edited yesterday");
  });

  it("renders with the hand-entered wording rather than a feed name", () => {
    render(
      <ProvenanceChip
        tournament={{ source: "coach-entered", lastSeenAt: undefined, updatedAt: hoursAgo(2) }}
      />,
    );
    expect(screen.getByTestId("provenance-chip").textContent).toContain("Entered by a coach");
    expect(screen.getByTestId("provenance-chip").textContent).not.toContain("via");
  });
});
