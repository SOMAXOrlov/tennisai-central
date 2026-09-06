import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageSkeleton, type PageSkeletonVariant } from "@/components/ui/PageSkeleton";

const VARIANTS: PageSkeletonVariant[] = ["page", "list", "cards", "calendar", "table", "detail", "dashboard"];

describe("PageSkeleton", () => {
  it.each(VARIANTS)("renders the %s variant as a busy, announced region", (variant) => {
    const { container } = render(<PageSkeleton variant={variant} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("aria-busy", "true");
    expect(root).toHaveAttribute("data-skeleton", variant);
    expect(screen.getByText("Loading…")).toHaveClass("sr-only");
    // No spinner anywhere: shapes only.
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("draws a full month of day cells for the calendar", () => {
    const { container } = render(<PageSkeleton variant="calendar" header={false} />);
    const grids = container.querySelectorAll(".grid-cols-7");
    expect(grids).toHaveLength(2); // weekday strip + days
    expect(grids[1].children).toHaveLength(35);
  });

  it("honours the row count for lists and tables", () => {
    const list = render(<PageSkeleton variant="list" rows={3} header={false} />);
    expect(list.container.querySelectorAll(".rounded-full")).toHaveLength(3);
    list.unmount();

    const table = render(<PageSkeleton variant="table" rows={4} header={false} />);
    // heading row + 4 data rows
    expect(table.container.querySelectorAll(".border-b").length).toBeGreaterThanOrEqual(5);
  });

  it("can drop the page header when it stands inside a card", () => {
    const withHeader = render(<PageSkeleton variant="list" rows={1} />);
    const headerBars = withHeader.container.querySelectorAll(".h-8").length;
    withHeader.unmount();

    const without = render(<PageSkeleton variant="list" rows={1} header={false} />);
    expect(without.container.querySelectorAll(".h-8").length).toBeLessThan(headerBars);
  });

  it("uses a custom screen-reader label when given", () => {
    render(<PageSkeleton label="Loading your calendar…" />);
    expect(screen.getByText("Loading your calendar…")).toHaveClass("sr-only");
  });
});
