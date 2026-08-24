type BudgetRecord = {
  epochDay: number;
  used: number;
};

type BudgetTransaction = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
};

type BudgetState = {
  storage: {
    transaction<T>(
      callback: (transaction: BudgetTransaction) => Promise<T>,
    ): Promise<T>;
  };
};

const budgetKey = "daily-budget";
const millisecondsPerDay = 86_400_000;

function isBudgetRecord(value: unknown): value is BudgetRecord {
  if (!value || typeof value !== "object") return false;
  const epochDay = Reflect.get(value, "epochDay");
  const used = Reflect.get(value, "used");
  return (
    Number.isSafeInteger(epochDay) &&
    Number.isSafeInteger(used) &&
    (epochDay as number) >= 0 &&
    (used as number) >= 0
  );
}

function response(status: number, success: boolean) {
  return Response.json(
    { success },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

export class PortfolioChatBudgetObject {
  constructor(
    private readonly state: BudgetState,
    _env: unknown = {},
    private readonly now: () => number = Date.now,
  ) {
    void _env;
  }

  async fetch(request: Request) {
    if (request.method !== "POST") return response(400, false);

    let limit: unknown;
    try {
      const declaredLength = Number(request.headers.get("content-length") ?? 0);
      if (Number.isFinite(declaredLength) && declaredLength > 256) {
        return response(400, false);
      }
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.byteLength > 256) return response(400, false);
      const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
      limit =
        body && typeof body === "object" ? Reflect.get(body, "limit") : undefined;
    } catch {
      return response(400, false);
    }
    if (!Number.isSafeInteger(limit) || (limit as number) <= 0) {
      return response(400, false);
    }

    const epochDay = Math.floor(this.now() / millisecondsPerDay);
    try {
      const result = await this.state.storage.transaction(async (transaction) => {
        const stored = await transaction.get(budgetKey);
        if (stored !== undefined && !isBudgetRecord(stored)) {
          return { status: 503, success: false };
        }
        if (stored && stored.epochDay > epochDay) {
          return { status: 503, success: false };
        }
        const current =
          !stored || stored.epochDay < epochDay
            ? { epochDay, used: 0 }
            : stored;
        if (current.used >= (limit as number)) {
          return { status: 200, success: false };
        }
        await transaction.put(budgetKey, {
          epochDay,
          used: current.used + 1,
        });
        return { status: 200, success: true };
      });
      return response(result.status, result.success);
    } catch {
      return response(503, false);
    }
  }
}
