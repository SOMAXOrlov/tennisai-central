// ============================================================
// jsdom shims for vaul (the bottom-sheet Drawer). vaul's drag handling runs
// on every pointer event inside a sheet and reads two things jsdom lacks:
// pointer capture on Element, and a computed `transform` (jsdom reports "",
// so vaul falls through to `webkitTransform`, which is undefined, and calls
// .match on it). Both get inert versions — enough for a tap to be a tap.
//
// Opt-in per test file (`installVaulJsdomShims()` in a beforeAll), not in
// the global setup: only sheet tests need it, and a global getComputedStyle
// wrapper would touch every other spec.
// ============================================================

export function installVaulJsdomShims(): void {
  const proto = Element.prototype as Element & {
    setPointerCapture?: (id: number) => void;
    releasePointerCapture?: (id: number) => void;
    hasPointerCapture?: (id: number) => boolean;
  };
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.hasPointerCapture ??= () => false;

  const marker = "__vaulTransformShim";
  const win = window as Window & { [marker]?: true };
  if (win[marker]) return;
  win[marker] = true;
  const original = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((el: Element, pseudo?: string | null) => {
    const style = original(el, pseudo);
    if (!style.transform) Object.defineProperty(style, "transform", { value: "none", configurable: true });
    return style;
  }) as typeof window.getComputedStyle;
}
