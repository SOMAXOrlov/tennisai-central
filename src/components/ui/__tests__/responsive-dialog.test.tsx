// ============================================================================
// ResponsiveDialog — the same form is a Radix dialog on desktop and a vaul
// bottom sheet on a phone. What matters:
//   • the seam is useIsMobile(), and nothing else decides;
//   • the sheet keeps the dialog's contract: title, description, close button,
//     onOpenChange(false) on close, the consumer's onInteractOutside veto;
//   • the sheet's footer is pinned (sticky) above the safe area.
// ============================================================================

import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installVaulJsdomShims } from "@/test/vaulJsdom";

const viewport = { mobile: false };
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => viewport.mobile,
}));

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog";

beforeAll(installVaulJsdomShims);
afterEach(cleanup);

function Fixture({
  onOpenChange = () => {},
  vetoOutside = false,
}: {
  onOpenChange?: (open: boolean) => void;
  vetoOutside?: boolean;
}) {
  return (
    <>
      {/* Plain page content outside the sheet — the thing a stray thumb lands on. */}
      <p>Page behind</p>
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button type="button">Open form</button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => vetoOutside && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Create Training</DialogTitle>
          <DialogDescription>Schedule a session.</DialogDescription>
        </DialogHeader>
        <label>
          Title <input />
        </label>
        <DialogFooter data-testid="footer">
          <button type="button">Cancel</button>
          <button type="submit">Save</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

describe("on desktop (useIsMobile → false)", () => {
  it("renders the Radix dialog, not a sheet", () => {
    viewport.mobile = false;
    render(<Fixture />);
    const dialog = screen.getByRole("dialog", { name: "Create Training" });
    expect(dialog).not.toHaveAttribute("data-vaul-drawer");
    expect(within(dialog).getByText("Schedule a session.")).toBeInTheDocument();
    // The dialog's own footer: no sticky bar on a mouse-and-keyboard surface.
    expect(screen.getByTestId("footer").className).not.toMatch(/sticky/);
  });
});

describe("on a phone (useIsMobile → true)", () => {
  it("renders the same content as a vaul bottom sheet with title, description and a 44px close", () => {
    viewport.mobile = true;
    render(<Fixture />);
    const sheet = screen.getByRole("dialog", { name: "Create Training" });
    expect(sheet).toHaveAttribute("data-vaul-drawer");
    expect(within(sheet).getByText("Schedule a session.")).toBeInTheDocument();
    expect(within(sheet).getByLabelText(/title/i)).toBeInTheDocument();
    const close = within(sheet).getByRole("button", { name: "Close" });
    expect(close.className).toMatch(/\bh-11\b/);
    expect(close.className).toMatch(/\bw-11\b/);
  });

  it("pins the footer above the safe area", () => {
    viewport.mobile = true;
    render(<Fixture />);
    const footer = screen.getByTestId("footer");
    expect(footer.className).toMatch(/\bsticky\b/);
    expect(footer.className).toMatch(/\bbottom-0\b/);
    expect(footer.className).toMatch(/safe-area-inset-bottom/);
  });

  it("reports onOpenChange(false) when the close button is tapped", async () => {
    viewport.mobile = true;
    const onOpenChange = vi.fn();
    render(<Fixture onOpenChange={onOpenChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes on an outside tap when the consumer does not object", async () => {
    viewport.mobile = true;
    const onOpenChange = vi.fn();
    render(<Fixture onOpenChange={onOpenChange} />);
    // Radix puts pointer-events:none on the page while a modal is open; the
    // check is skipped so the tap reaches document, where DismissableLayer
    // listens for outside pointerdowns. (Not the trigger: a trigger TOGGLES,
    // so tapping it would close the sheet for a different reason.)
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await user.click(screen.getByText("Page behind"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("lets the consumer veto an outside tap, exactly as the dialog did", async () => {
    viewport.mobile = true;
    const onOpenChange = vi.fn();
    render(<Fixture onOpenChange={onOpenChange} vetoOutside />);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await user.click(screen.getByText("Page behind"));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog", { name: "Create Training" })).toBeInTheDocument();
  });
});
