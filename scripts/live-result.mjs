export class WrongAnswer extends Error {}

export function requireInput(condition, message) {
  if (!condition) throw new Error(message);
}

export async function subjectJson(response) {
  try { return await response.json(); }
  catch (error) {
    if (error instanceof SyntaxError) throw new WrongAnswer("response is not JSON");
    throw error;
  }
}

export function liveResults({ settleMs = 15000 } = {}) {
  let wrong = 0, unavailable = 0, settled = false;
  async function check(name, run, { retry = true } = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const detail = await run();
        console.log(`ok   ${name}${detail ? ` (${detail})` : ""}`);
        return;
      } catch (error) {
        if (error instanceof WrongAnswer && retry && attempt === 0) {
          if (!settled) {
            settled = true;
            await new Promise(resolve => setTimeout(resolve, settleMs));
          }
          continue;
        }
        if (error instanceof WrongAnswer) wrong++;
        else unavailable++;
        console.log(`${error instanceof WrongAnswer ? "FAIL" : "DOWN"} ${name}: ${error instanceof Error ? error.message : "unavailable"}`);
        return;
      }
    }
  }
  return { check, exitCode: () => wrong ? 1 : unavailable ? 3 : 0 };
}
