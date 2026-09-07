// What the court art promises, and what must not quietly break.
//
// Three things are worth a test here, and one of them matters more than the
// others: `SurfaceImage`'s `<img>` path is the route back to real photographs.
// The owner may still supply club photos, and the whole reason that branch was
// kept rather than deleted is so that dropping a `src` back in works with no
// further change. If it silently stops rendering an image, the drawn art has
// become permanent without anyone deciding that — so it is asserted first.
//
// The other two: every surface is drawn *differently* (a picker where clay and
// grass differ only by hue would fail the point of the exercise), and the
// no-photo path draws a court rather than the flat colour block it replaced.
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CourtSurfaceArt } from "@/components/courts/CourtSurfaceArt";
import { SurfaceImage } from "@/components/SurfaceImage";
import { SurfacePicker } from "@/components/SurfacePicker";
import { SURFACE_COLOR } from "@/lib/calendar/colors";
import type { Surface } from "@/types";

const SURFACES: Surface[] = ["hard", "clay", "grass", "indoor"];

/** The drawing is decorative and `aria-hidden`, so it is found structurally. */
function artSvg(container: HTMLElement): SVGSVGElement | null {
  return container.querySelector("svg");
}

describe("CourtSurfaceArt", () => {
  it.each(SURFACES)("draws %s as an svg", (surface) => {
    const { container } = render(<CourtSurfaceArt surface={surface} />);
    const svg = artSvg(container);
    expect(svg).not.toBeNull();
    // Decorative: the accessible name belongs to the tile around it, and a
    // screen reader must not announce the drawing itself.
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("shares the line overlay's frame, so the painted markings land on the art", () => {
    // Both must stay on viewBox "0 0 400 300" with the same slice behaviour;
    // if one drifts the lines float over a court drawn to a different scale.
    for (const surface of SURFACES) {
      const { container, unmount } = render(<CourtSurfaceArt surface={surface} />);
      expect(artSvg(container)).toHaveAttribute("viewBox", "0 0 400 300");
      unmount();
    }
  });

  it("draws each surface differently, not one court in four colours", () => {
    // The product requirement is that a surface is identifiable at tile size
    // without reading its label. Comparing whole markup rather than path data
    // keeps this honest without breaking on a visual tweak.
    const drawings = SURFACES.map((surface) => {
      const { container, unmount } = render(<CourtSurfaceArt surface={surface} />);
      // Strip the per-instance ids from useId so the comparison is about
      // construction, not about which instance rendered first.
      const markup = (artSvg(container)?.outerHTML ?? "").replace(/court-[a-z]+-[^"')]*/g, "ID");
      unmount();
      return markup;
    });

    expect(new Set(drawings).size).toBe(SURFACES.length);
  });

  it("gives concurrent instances distinct gradient ids", () => {
    // Four of these render side by side in the picker. Colliding ids would
    // make several tiles paint from whichever gradient won, which looks like a
    // colour bug and is very hard to trace back to here.
    const { container } = render(
      <>
        <CourtSurfaceArt surface="clay" />
        <CourtSurfaceArt surface="clay" />
      </>,
    );

    const ids = Array.from(container.querySelectorAll("[id]")).map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("renders rather than throwing for a surface value it does not know", () => {
    // Reachable from stored data: `Surface` is a string union at the type
    // level only, and a row written before a surface was renamed still arrives.
    const { container } = render(
      <CourtSurfaceArt surface={"carpet" as Surface} color={SURFACE_COLOR.hard} />,
    );
    expect(artSvg(container)).not.toBeNull();
  });
});

describe("SurfaceImage", () => {
  it("still renders a photograph when given one", () => {
    // THE REGRESSION GUARD. See the note at the top of this file.
    render(
      <SurfaceImage
        src="/club/centre-court.jpg"
        name="Clay"
        surface="clay"
        color={SURFACE_COLOR.clay}
      />,
    );

    const img = screen.getByRole("img", { name: "Clay tennis court surface" });
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", "/club/centre-court.jpg");
  });

  it("draws the court when there is no photo, and names the tile", () => {
    const { container } = render(
      <SurfaceImage src="" name="Grass" surface="grass" color={SURFACE_COLOR.grass} />,
    );

    // No <img> at all — not an image element with an empty src, which would
    // ask the browser for the current page and log a console error.
    expect(container.querySelector("img")).toBeNull();

    const tile = screen.getByRole("img", { name: "Grass tennis court surface" });
    expect(tile.tagName).not.toBe("IMG");
    expect(tile.querySelector("svg")).not.toBeNull();
  });

  it("falls back to the drawn court when a photo fails to load", () => {
    render(
      <SurfaceImage
        src="/club/missing.jpg"
        name="Hard"
        surface="hard"
        color={SURFACE_COLOR.hard}
      />,
    );

    const img = screen.getByRole("img", { name: "Hard tennis court surface" });
    expect(img.tagName).toBe("IMG");

    fireEvent.error(img);

    const tile = screen.getByRole("img", { name: "Hard tennis court surface" });
    expect(tile.tagName).not.toBe("IMG");
    expect(tile.querySelector("svg")).not.toBeNull();
  });
});

describe("SurfacePicker", () => {
  it("offers all four surfaces, each named by its label alone", () => {
    render(<SurfacePicker value="hard" onChange={() => {}} />);

    // The label alone, not "Clay tennis court surface Clay": the tile carries
    // an explicit aria-label precisely so the button is not named by its
    // contents. That comment in SurfacePicker is what this asserts.
    for (const label of ["Hard", "Clay", "Grass", "Indoor"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the selected surface as pressed, and reports a change", () => {
    const onChange = vi.fn();
    render(<SurfacePicker value="clay" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Clay" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Grass" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Grass" }));
    expect(onChange).toHaveBeenCalledWith("grass");
  });

  it("ships no bundled court photographs", () => {
    // The three JPEGs this branch deleted carried no licence and no
    // attribution. If an <img> reappears here, a photograph has been added
    // back and src/assets/ATTRIBUTION.md needs an entry for it.
    const { container } = render(<SurfacePicker value="hard" onChange={() => {}} />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});
