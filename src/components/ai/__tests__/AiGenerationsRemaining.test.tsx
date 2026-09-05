// "n of m AI generations left this month" is shown only when it is true:
// the feature is on and the server has answered with a number.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AiGenerationsRemaining } from "@/components/ai/AiGenerationsRemaining";

const { api } = vi.hoisted(() => ({
  api: { status: vi.fn(), usage: vi.fn() },
}));

vi.mock("@/api/endpoints/aiAdvice", () => ({ aiAdviceApi: api }));

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AiGenerationsRemaining />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.status.mockReset();
  api.usage.mockReset();
});
afterEach(cleanup);

describe("<AiGenerationsRemaining />", () => {
  it("renders nothing and never asks for usage while the feature is off", async () => {
    api.status.mockResolvedValue({ configured: false, provider: null });
    mount();
    await waitFor(() => expect(api.status).toHaveBeenCalled());
    expect(screen.queryByTestId("ai-usage")).toBeNull();
    expect(api.usage).not.toHaveBeenCalled();
  });

  it("shows n of m left once the feature is on and the counter has arrived", async () => {
    api.status.mockResolvedValue({ configured: true, provider: "anthropic" });
    api.usage.mockResolvedValue({ periodKey: "2026-09", reportsGenerated: 7, limit: 100, remaining: 93 });
    mount();
    expect(await screen.findByTestId("ai-usage")).toHaveTextContent("93 of 100 AI generations left this month");
  });

  it("says the allowance is used up at zero, without turning red", async () => {
    api.status.mockResolvedValue({ configured: true, provider: "anthropic" });
    api.usage.mockResolvedValue({ periodKey: "2026-09", reportsGenerated: 100, limit: 100, remaining: 0 });
    mount();
    const el = await screen.findByTestId("ai-usage");
    expect(el).toHaveTextContent("All 100 AI generations used this month");
    expect(el.className).not.toMatch(/destructive/);
  });
});
