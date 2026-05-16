import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement ResizeObserver — Radix UI primitives (Tooltip,
// Popover, etc.) call it on open. Stub with a noop class so tests don't crash.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
