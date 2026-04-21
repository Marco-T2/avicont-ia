/**
 * WARNING-2 fix — nav card to Sumas y Saldos in /accounting/reports.
 *
 * Spec C9.S3: Given a GET to /[orgSlug]/accounting/reports, When the page
 * renders, Then a card or link element exists with text containing
 * 'Sumas y Saldos' and href pointing to /[orgSlug]/accounting/trial-balance.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

// next/link renders an <a> in jsdom
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// Stub fetch so the legacy inline table doesn't error on mount
const mockFetch = vi.fn();
global.fetch = mockFetch;
mockFetch.mockResolvedValue({ ok: false, json: async () => [] });

import ReportsPageClient from "@/components/accounting/reports-page-client";

afterEach(cleanup);

const ORG_SLUG = "avicont-sa";

describe("ReportsPageClient — Sumas y Saldos nav card (C9.S3)", () => {
  it("renders a link with text matching /Sumas y Saldos/i", () => {
    render(<ReportsPageClient orgSlug={ORG_SLUG} />);
    expect(screen.getByText(/Sumas y Saldos/i)).toBeInTheDocument();
  });

  it("renders a link whose href points to /[orgSlug]/accounting/trial-balance", () => {
    render(<ReportsPageClient orgSlug={ORG_SLUG} />);
    const link = screen.getByRole("link", { name: /Sumas y Saldos/i });
    expect(link).toHaveAttribute("href", `/${ORG_SLUG}/accounting/trial-balance`);
  });
});
