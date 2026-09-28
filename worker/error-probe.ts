export const ERROR_PROBE_HEADER = "x-biv-error-probe";

export type ErrorProbeEnv = {
  ERROR_INTAKE_SECRET?: string;
};

function sameSecret(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

/** A harmless, secret-gated exception that proves the Worker's tail route. */
export function throwIfErrorProbe(request: Request, env: ErrorProbeEnv): void {
  const supplied = request.headers.get(ERROR_PROBE_HEADER);
  const expected = env.ERROR_INTAKE_SECRET;
  if (!supplied || !expected || !sameSecret(supplied, expected)) return;

  const error = new Error("deliberate probe of the error route");
  error.name = "ErrorIntakeProbe";
  throw error;
}
