import { describe, expect, it } from "vitest";
import { PortfolioChatBudgetObject } from "./portfolio-chat-budget";

function storage() {
  const values = new Map<string, unknown>();
  return {
    values,
    storage: {
      transaction: async <T>(
        callback: (transaction: {
          get(key: string): Promise<unknown>;
          put(key: string, value: unknown): Promise<void>;
        }) => Promise<T>,
      ) =>
        callback({
          get: async (key) => values.get(key),
          put: async (key, value) => {
            values.set(key, value);
          },
        }),
    },
  };
}

async function consume(object: PortfolioChatBudgetObject, limit: number) {
  return object.fetch(
    new Request("https://portfolio-chat-budget/consume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit }),
    }),
  );
}

describe("portfolio chat daily request budget", () => {
  it("atomically allows exactly the configured number of provider requests", async () => {
    const state = storage();
    const object = new PortfolioChatBudgetObject(state, {}, () =>
      Date.UTC(2026, 7, 24, 12),
    );

    expect(await (await consume(object, 2)).json()).toEqual({ success: true });
    expect(await (await consume(object, 2)).json()).toEqual({ success: true });
    expect(await (await consume(object, 2)).json()).toEqual({ success: false });
    expect(state.values.get("daily-budget")).toEqual({
      epochDay: 20_689,
      used: 2,
    });
  });

  it("resets only when the object clock advances to a new UTC day", async () => {
    let now = Date.UTC(2026, 7, 24, 23, 59);
    const state = storage();
    const object = new PortfolioChatBudgetObject(state, {}, () => now);

    await consume(object, 1);
    now = Date.UTC(2026, 7, 25, 0, 1);

    expect(await (await consume(object, 1)).json()).toEqual({ success: true });
    expect(state.values.get("daily-budget")).toEqual({
      epochDay: 20_690,
      used: 1,
    });
  });

  it("fails closed on a stale clock without reopening the newer-day cap", async () => {
    let now = Date.UTC(2026, 7, 25, 0, 1);
    const state = storage();
    const object = new PortfolioChatBudgetObject(state, {}, () => now);

    await consume(object, 2);
    now = Date.UTC(2026, 7, 24, 23, 59);
    const stale = await consume(object, 2);
    now = Date.UTC(2026, 7, 25, 0, 2);
    const current = await consume(object, 2);

    expect(stale.status).toBe(503);
    expect(await stale.json()).toEqual({ success: false });
    expect(await current.json()).toEqual({ success: true });
    expect(state.values.get("daily-budget")).toEqual({
      epochDay: 20_690,
      used: 2,
    });
  });

  it.each([
    new Request("https://portfolio-chat-budget/consume", { method: "GET" }),
    new Request("https://portfolio-chat-budget/consume", {
      method: "POST",
      body: JSON.stringify({ limit: 0 }),
    }),
    new Request("https://portfolio-chat-budget/consume", {
      method: "POST",
      body: "not-json",
    }),
  ])("rejects invalid budget requests without changing storage", async (request) => {
    const state = storage();
    const object = new PortfolioChatBudgetObject(state, {}, Date.now);

    const response = await object.fetch(request);

    expect(response.status).toBe(400);
    expect(state.values.size).toBe(0);
  });
});
