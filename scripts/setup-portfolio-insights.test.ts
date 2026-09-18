// Owns: `npm run setup:insights` never places a token in any process's
// argument list — every Keychain write goes through
// store-keychain-secret.swift on stdin, that writer rotates an existing item
// instead of failing, the Airtable stage still verifies with one projected GET
// before storing, and the launchd job never carries a token. Retire when the
// report stops reading Airtable and stops storing tokens in the Keychain.
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const scriptUrl = new URL("./setup-portfolio-insights.sh", import.meta.url);
const feedbackUrl = new URL("./setup-portfolio-feedback.sh", import.meta.url);
const writerUrl = new URL("./store-keychain-secret.swift", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);

async function airtableStage() {
  const script = await readFile(scriptUrl, "utf8");
  const start = script.indexOf("# ── Stage 3 · Airtable");
  const end = script.indexOf('rule "Done"');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return { script, stage: script.slice(start, end) };
}

describe("portfolio insights setup: Airtable stage", () => {
  it("is valid bash behind the canonical npm entry point", async () => {
    const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
    expect(packageJson.scripts["setup:insights"]).toBe("bash scripts/setup-portfolio-insights.sh");
    expect(() => execFileSync("bash", ["-n", fileURLToPath(scriptUrl)])).not.toThrow();
  });

  it("asks for a records-read token scoped to the Job Search base only", async () => {
    const { stage } = await airtableStage();
    expect(stage).toContain("data.records:read");
    expect(stage).toContain("Job Search");
    expect(stage).toContain("read -rs AIRTABLE_TOKEN");
  });

  it("verifies one projected Actions GET before storing in the named Keychain entry", async () => {
    const { script, stage } = await airtableStage();
    expect(script).toContain('KEYCHAIN_SERVICE="biv-portfolio-insights"');
    expect(script).toContain('AIRTABLE_BASE="app0LM9NfGL4ZHi3j"');
    expect(script).toContain('AIRTABLE_ACTIONS_TABLE="tblheGY3pSKmWvAS9"');

    const verify = stage.indexOf(
      "https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_ACTIONS_TABLE}?pageSize=1&fields%5B%5D=Action",
    );
    const store = stage.indexOf('store "airtable-read-token"');
    expect(verify).toBeGreaterThan(-1);
    expect(store).toBeGreaterThan(verify);
    // Only a 200 reaches the store call; every other status exits first.
    expect(stage.slice(verify, store)).toMatch(/200\)[^\n]*done_/u);
    expect(stage.slice(verify, store)).toMatch(/\*\)\s+fail /u);
    // GET only: no method override or request body anywhere in the stage.
    expect(stage).not.toMatch(/\s(?:-X|--request|-d|--data\S*)\s/u);
  });

  it("never echoes the token or passes it to curl as an argument", async () => {
    const { stage } = await airtableStage();
    const expansions = stage
      .split("\n")
      .filter((line) => /\$\{?AIRTABLE_TOKEN\b/u.test(line));
    expect(expansions.length).toBeGreaterThan(0);
    for (const line of expansions) {
      expect(line).not.toMatch(/\becho\b/u);
      expect(line).not.toMatch(/-H\s+["']Authorization/iu);
      if (/\bprintf\b/u.test(line)) expect(line).toMatch(/\|\s*curl\b.*-H @-/u);
    }
    expect(stage).toMatch(/\nunset AIRTABLE_TOKEN\n/u);
  });
});

function bashFunction(script: string, name: string) {
  const start = script.indexOf(`${name}() {`);
  expect(start).toBeGreaterThan(-1);
  const end = script.indexOf("\n}\n", start);
  expect(end).toBeGreaterThan(start);
  return script.slice(start, end);
}

// A shell line, with comments dropped and backslash continuations joined, so
// that "which command is this argument attached to" is answerable.
function logicalLines(source: string) {
  return source
    .replace(/\\\n\s*/gu, " ")
    .split("\n")
    .filter((line) => !/^\s*#/u.test(line));
}

const SECRET_EXPANSION = /\$\{?[A-Za-z_]*(?:token|TOKEN)\b/u;
const EXTERNAL_COMMAND =
  /(?:^|\s|\()(?:\/usr\/bin\/\S+|curl|npx|node|open|grep|security|xcrun|swift)\b/u;

// One command's own text. Splitting on `|` is what makes the check sound: each
// segment is a separate process with its own argument vector, so a secret that
// is safely piped in the first segment cannot vouch for the second. `||` and
// `&&` split too — they also start a new command — and the empty pieces that
// leaves are harmless.
function pipelineSegments(line: string) {
  return line.split(/\||&&/u);
}

// Every place a secret is handed to an external command as an argument. Within
// the segment that actually runs the command, a secret may only appear before
// the command name — that is, to the left of the pipe feeding its stdin. A
// secret is also fine in a shell test, a `local`, an `unset`, or a call to one
// of this script's own functions: none of those start a process `ps` can read.
// What this check does not see, so nobody mistakes it for a guarantee:
//   1. Laundering. It keys on names containing `token`/`TOKEN`, so
//      `X="$TOKEN"; curl -u "a:$X"` escapes. Widening it to every variable
//      would flag every benign expansion.
//   2. Quotes. The segment split is not quote-aware, so a literal pipe inside
//      an argument (`curl -d "a|b $TOKEN"`) hides the rest of that argument.
//   3. Unlisted commands. `EXTERNAL_COMMAND` is an allowlist; a leak through
//      `jq`, `logger`, `openssl` or similar is not seen. Add them here when a
//      script starts using them.
//   4. Process substitution. `@<(printf '%s' "$TOKEN")` is safe but is
//      reported as a leak. Nothing in these scripts does it today.
//   5. Argv only. A secret passed through the environment is a different
//      exposure and is not this check's job.
// All but 4 are false negatives, so a clean result is evidence, not proof.
function commandArgumentLeaks(source: string) {
  const leaks: string[] = [];
  for (const line of logicalLines(source)) {
    for (const segment of pipelineSegments(line)) {
      const secret = segment.search(SECRET_EXPANSION);
      if (secret < 0) continue;
      if (/^\s*(?:local|unset)\b/u.test(segment)) continue;
      if (/^\s*(?:if\s+|while\s+)?\[\[/u.test(segment)) continue;
      const command = segment.search(EXTERNAL_COMMAND);
      if (command >= 0 && command < secret) leaks.push(segment.trim());
    }
  }
  return leaks;
}

// The delimited block a Swift declaration opens, matched by nesting rather
// than by a fixed window, so moving code inside it cannot slip past a test.
function withoutComments(source: string) {
  return source
    .split("\n")
    .filter((line) => !/^\s*\/\//u.test(line))
    .join("\n");
}

function swiftBlock(source: string, header: string, open = "{", close = "}") {
  const at = source.indexOf(header);
  expect(at).toBeGreaterThan(-1);
  const start = at + header.length - 1;
  expect(source[start]).toBe(open);

  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open) depth += 1;
    else if (source[index] === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unbalanced ${open}${close} after ${header}`);
}

function swiftWriterAvailable() {
  if (process.platform !== "darwin") return false;
  try {
    execFileSync("/usr/bin/xcrun", ["--find", "swift"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Writing to the real login Keychain is opt-in and never runs as part of an
// ordinary `npm test`. An item this test creates is one whose access controls
// the running user may be asked to approve, and the macOS way of asking is a
// modal password dialog — which an unattended suite cannot answer and a person
// running an unrelated test should never be shown. The default proof below
// reads the writer's source instead and touches no Keychain at all.
const rotationAgainstRealKeychain =
  process.env.BIV_KEYCHAIN_ROTATION_TEST === "1" && swiftWriterAvailable();

describe("portfolio insights setup: Keychain writes", () => {
  it("keeps every secret expansion out of every command's arguments", async () => {
    // The property, not the shapes that happened to break it: a secret may
    // appear only to the left of the pipe that feeds an external command, so
    // it lands on that command's stdin and never in its argument vector. This
    // catches `-w "$TOKEN"` and `-H "Bearer $TOKEN"`, and equally `-u
    // "x:$TOKEN"`, `--data "$TOKEN"`, or any option invented later.
    for (const url of [scriptUrl, feedbackUrl]) {
      const source = await readFile(url, "utf8");
      const offenders = commandArgumentLeaks(source);
      expect(offenders).toEqual([]);
    }
  });

  it("pipes the token into the swift writer on stdin", async () => {
    const script = await readFile(scriptUrl, "utf8");
    const store = bashFunction(script, "store");

    expect(script).toContain(
      'KEYCHAIN_WRITER="scripts/store-keychain-secret.swift"',
    );
    expect(store).toMatch(
      /printf '%s' "\$token" \|\s*\\?\s*\/usr\/bin\/xcrun swift -suppress-warnings/u,
    );
    expect(store).toContain(
      '"$KEYCHAIN_WRITER" "$KEYCHAIN_SERVICE" "$account" "$label"',
    );

    for (const line of store.split("\n")) {
      if (!/\$\{?token\b/u.test(line)) continue;
      // The only places the token may appear are the local declaration, the
      // stdin pipe, and the read-back comparison — never an argument vector.
      expect(line).not.toMatch(/\/usr\/bin\/(?:security|xcrun)[^|]*\$\{?token\b/u);
    }
  });

  it("still reads the stored value back before calling the stage done", async () => {
    const script = await readFile(scriptUrl, "utf8");
    const store = bashFunction(script, "store");

    expect(store).toContain(
      'readback="$(/usr/bin/security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$account" -w)"',
    );
    expect(store).toContain(
      '[[ "$readback" == "$token" ]] || fail "Keychain readback did not match for $account."',
    );
    expect(store).toContain(
      'done_ "Stored in your login Keychain ($KEYCHAIN_SERVICE / $account)"',
    );
  });

  it("stores all three tokens through the same writer", async () => {
    const script = await readFile(scriptUrl, "utf8");
    for (const account of [
      "cloudflare-api-token",
      "clarity-api-token",
      "airtable-read-token",
    ]) {
      expect(script).toContain(`store "${account}"`);
    }
  });

  it("fails loudly when the swift toolchain is missing instead of falling back", async () => {
    const script = await readFile(scriptUrl, "utf8");
    const guard = script.indexOf("/usr/bin/xcrun --find swift");
    const firstStore = script.indexOf('store "cloudflare-api-token"');

    expect(guard).toBeGreaterThan(-1);
    expect(firstStore).toBeGreaterThan(guard);
    expect(script.slice(guard, guard + 400)).toMatch(/fail "[^"]*xcode-select/u);
  });

  it("rotates without asking macOS for an authorization it does not hold", async () => {
    // The item's access controls name /usr/bin/security and nothing else, so
    // only it can remove the old entry silently. Updating in place instead
    // would make macOS raise a password dialog on a re-run.
    for (const [url, account] of [
      [scriptUrl, '-a "$account"'],
      [feedbackUrl, '-a "$KEYCHAIN_ACCOUNT"'],
    ] as const) {
      const source = await readFile(url, "utf8");
      const lines = logicalLines(source);
      const removal = lines.findIndex((line) =>
        /\/usr\/bin\/security delete-generic-password/u.test(line),
      );
      const write = lines.findIndex((line) =>
        /\/usr\/bin\/xcrun swift/u.test(line),
      );

      expect(removal).toBeGreaterThan(-1);
      expect(write).toBeGreaterThan(removal);
      expect(lines[removal]).toContain(account);
      // Nothing stored yet is the normal first run, not a failure.
      expect(lines[removal]).toMatch(/\|\|\s*true/u);
      // Losing the old value is why the failure text says to paste it again.
      expect(lines[write]).toMatch(/fail "[^"]*re-run/u);
    }
  });

  it("stores the reviewer feedback token the same way", async () => {
    const feedback = await readFile(feedbackUrl, "utf8");

    expect(commandArgumentLeaks(feedback)).toEqual([]);
    expect(feedback).toMatch(
      /printf '%s' "\$TOKEN" \|\s*\\?\s*\/usr\/bin\/xcrun swift -suppress-warnings/u,
    );
    expect(feedback).toContain("/usr/bin/xcrun --find swift");
    expect(() =>
      execFileSync("bash", ["-n", fileURLToPath(feedbackUrl)]),
    ).not.toThrow();
  });
});

// The default rotation proof: no Keychain, no toolchain, no prompt. It reads
// the writer and pins the behaviour a re-run depends on — SecItemAdd alone
// returns errSecDuplicateItem, so before this the setup could not rotate a
// token that was already stored.
describe("store-keychain-secret.swift rotation contract", () => {
  it("updates a duplicate item in place instead of failing or deleting it", async () => {
    const writer = await readFile(writerUrl, "utf8");

    const add = writer.indexOf("SecItemAdd(");
    const duplicate = writer.indexOf("status == errSecDuplicateItem");
    const update = writer.indexOf("SecItemUpdate(");
    expect(add).toBeGreaterThan(-1);
    expect(duplicate).toBeGreaterThan(add);
    expect(update).toBeGreaterThan(duplicate);

    // Delete-then-add would replace the item's access controls and open a
    // window with no stored secret; SecItemDelete is also refused on an item
    // whose access list names only /usr/bin/security.
    expect(writer).not.toContain("SecItemDelete(");

    // Whatever the duplicate-item branch does, and wherever in it the
    // dictionary is written, it must not touch the item's access controls.
    const branch = withoutComments(
      swiftBlock(writer, "if status == errSecDuplicateItem {"),
    );
    expect(branch).toContain("SecItemUpdate(");
    expect(branch).toContain("kSecAttrLabel: label");
    expect(branch).toContain("kSecValueData: secret");
    expect(branch).not.toContain("kSecAttrAccess");
    // Access controls belong to the create path, which is the one the setup
    // scripts take every time.
    expect(swiftBlock(writer, "let creation: [CFString: Any] = [", "[", "]"))
      .toContain("kSecAttrAccess: access");

    expect(writer).toContain('fail("Keychain rotation failed with status');
  });

  it("can be told not to raise a dialog nobody is there to answer", async () => {
    const writer = await readFile(writerUrl, "utf8");

    expect(writer).toContain(
      'ProcessInfo.processInfo.environment["BIV_KEYCHAIN_NO_INTERACTION"] == "1"',
    );
    expect(writer).toContain("SecKeychainSetUserInteractionAllowed(false)");
    // Off unless asked for: a person runs `setup:insights` and can answer.
    const setup = await readFile(scriptUrl, "utf8");
    expect(setup).not.toContain("BIV_KEYCHAIN_NO_INTERACTION");
  });

  it("refuses an empty secret before it reaches the Keychain", async () => {
    const writer = await readFile(writerUrl, "utf8");
    const guard = writer.indexOf("Refusing to store an empty Keychain secret");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(writer.indexOf("SecTrustedApplicationCreateFromPath"));
  });
});

// Opt in with BIV_KEYCHAIN_ROTATION_TEST=1 when you want the same property
// proved against the real Keychain. It writes to the login Keychain under a
// throwaway service and deletes what it creates. BIV_KEYCHAIN_NO_INTERACTION
// makes the writer fail with a status rather than prompt, so a run that the
// access controls do not permit produces a test failure, not a dialog.
describe.skipIf(!rotationAgainstRealKeychain)(
  "store-keychain-secret.swift against the login Keychain",
  () => {
    const service = `biv-portfolio-insights-rotation-test-${process.pid}`;
    const account = "rotation-probe";
    const label = "BIV-434 rotation test";

    function write(secret: string) {
      execFileSync(
        "/usr/bin/xcrun",
        [
          "swift",
          "-suppress-warnings",
          fileURLToPath(writerUrl),
          service,
          account,
          label,
        ],
        { input: secret, env: { ...process.env, BIV_KEYCHAIN_NO_INTERACTION: "1" } },
      );
    }

    function read() {
      return execFileSync(
        "/usr/bin/security",
        ["find-generic-password", "-s", service, "-a", account, "-w"],
        { encoding: "utf8" },
      ).trim();
    }

    function remove() {
      execFileSync(
        "/usr/bin/security",
        ["delete-generic-password", "-s", service, "-a", account],
        { stdio: "ignore" },
      );
    }

    afterAll(() => {
      try {
        remove();
      } catch {
        // Already deleted by the test that created it.
      }
    });

    it(
      "rotates an existing item so the second value is the one read back",
      () => {
        write("first-value");
        expect(read()).toBe("first-value");

        write("second-value");
        expect(read()).toBe("second-value");

        remove();
        expect(() => read()).toThrow();
      },
      120_000,
    );
  },
);

describe("portfolio insights setup: verification requests", () => {
  it("authenticates every verification request through curl's stdin", async () => {
    for (const url of [scriptUrl, feedbackUrl]) {
      const source = await readFile(url, "utf8");
      // Same property as the store path: the credential is built to the left
      // of the pipe and read by curl from stdin.
      expect(commandArgumentLeaks(source)).toEqual([]);

      const authLines = logicalLines(source).filter((line) =>
        /Bearer/iu.test(line),
      );
      expect(authLines.length).toBeGreaterThan(0);
      for (const line of authLines) {
        expect(line).toMatch(/\|\s*curl\b/u);
        expect(line).toContain("-H @-");
      }
    }
  });

  it("checks the Cloudflare responses before storing that token", async () => {
    const script = await readFile(scriptUrl, "utf8");
    const start = script.indexOf("# ── Stage 1 · Cloudflare");
    const end = script.indexOf("# ── Stage 2 · Clarity");
    const stage = script.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const rum = stage.indexOf('grep -q \'"rumPageloadEventsAdaptiveGroups"\'');
    const zone = stage.indexOf('grep -q \'"httpRequests1dGroups"\'');
    const store = stage.indexOf('store "cloudflare-api-token"');
    expect(rum).toBeGreaterThan(-1);
    expect(zone).toBeGreaterThan(rum);
    expect(store).toBeGreaterThan(zone);
    // A token that cannot read Web Analytics is never stored; a zone-blind one
    // still is, with a warning.
    expect(stage).toContain(
      'fail "Web Analytics is not readable with that token.',
    );
    expect(stage).toContain('warn "Zone analytics is NOT readable.');
  });

  it("keeps every Clarity status branch, including the unverified 429", async () => {
    const script = await readFile(scriptUrl, "utf8");
    const start = script.indexOf("# ── Stage 2 · Clarity");
    const end = script.indexOf("# ── Stage 3 · Airtable");
    const stage = script.slice(start, end);

    const request = stage.indexOf("project-live-insights?numOfDays=1");
    const branches = stage.indexOf('case "$STATUS" in');
    const store = stage.indexOf('store "clarity-api-token"');
    expect(request).toBeGreaterThan(-1);
    expect(branches).toBeGreaterThan(request);
    expect(store).toBeGreaterThan(branches);
    expect(stage).toContain('200) done_ "Export API answers 200" ;;');
    expect(stage).toContain(
      '401|403) fail "Clarity answered $STATUS: the token is rejected. Mint a fresh one." ;;',
    );
    expect(stage).toContain(
      "429) warn \"Clarity answered 429: today's 10 requests are already spent. Storing the token unverified.\" ;;",
    );
  });

  it("keeps the feedback digest check on its status code", async () => {
    const feedback = await readFile(feedbackUrl, "utf8");
    const request = feedback.indexOf("/_portfolio-feedback/admin/notes");
    const branches = feedback.indexOf('case "$STATUS" in');

    expect(request).toBeGreaterThan(-1);
    expect(branches).toBeGreaterThan(request);
    expect(feedback).toContain(
      '200) done_ "Digest route answers 200 — feedback is live. Try: npm run feedback" ;;',
    );
    expect(feedback).toMatch(/\nunset TOKEN READBACK\n/u);
  });
});
