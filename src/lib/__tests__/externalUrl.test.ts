// A tournament's `website` goes straight into an `href`. It is filled from a
// feed and from a form a coach types into, so "is this a URL" is not the same
// question as "is this safe to click".

import { describe, it, expect } from "vitest";
import { safeExternalUrl } from "../externalUrl";

describe("safeExternalUrl", () => {
  it("passes an ordinary web address through unchanged", () => {
    expect(safeExternalUrl("https://app.utrsports.net/events/388992")).toBe(
      "https://app.utrsports.net/events/388992",
    );
    // Plain http as well: a club's site may still have no TLS.
    expect(safeExternalUrl("http://tennisclub.example/open")).toBe("http://tennisclub.example/open");
  });

  it("refuses a javascript: link", () => {
    // The one that matters. `new URL("javascript:alert(1)")` parses fine and
    // `z.string().url()` accepts it, so neither is a safety check.
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeExternalUrl("  javascript:alert(1)  ")).toBeNull();
  });

  it("refuses every other scheme that can execute or exfiltrate", () => {
    for (const value of [
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "blob:https://example.test/abc",
    ]) {
      expect(safeExternalUrl(value), value).toBeNull();
    }
  });

  it("refuses anything that is not an absolute URL", () => {
    // A relative value would resolve against this app's own origin, which is
    // never what an organiser's page is.
    for (const value of ["/events/1", "example.test", "", "   ", null, undefined, 42, {}]) {
      expect(safeExternalUrl(value), String(value)).toBeNull();
    }
  });
});
