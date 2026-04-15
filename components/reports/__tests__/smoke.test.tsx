import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

describe("RTL smoke test", () => {
  it("renders a trivial component with jsdom", () => {
    render(<div>Hola mundo</div>);
    expect(screen.getByText("Hola mundo")).toBeTruthy();
  });
});
