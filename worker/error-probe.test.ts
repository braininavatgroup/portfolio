import { describe, expect, it } from "vitest";

import { ERROR_PROBE_HEADER, throwIfErrorProbe } from "./error-probe";

const request = (secret?: string) =>
  new Request("https://bradleyberkman.com/__error-probe", {
    headers: secret ? { [ERROR_PROBE_HEADER]: secret } : undefined,
  });

describe("production error probe", () => {
  it("throws the named probe only when both secrets match", () => {
    expect(() => throwIfErrorProbe(request(), { ERROR_INTAKE_SECRET: "secret" })).not.toThrow();
    expect(() => throwIfErrorProbe(request("wrong"), { ERROR_INTAKE_SECRET: "secret" })).not.toThrow();
    expect(() => throwIfErrorProbe(request("secret"), {})).not.toThrow();
    expect(() => throwIfErrorProbe(request("secret"), { ERROR_INTAKE_SECRET: "secret" }))
      .toThrowError(expect.objectContaining({ name: "ErrorIntakeProbe", message: "deliberate probe of the error route" }));
  });
});
