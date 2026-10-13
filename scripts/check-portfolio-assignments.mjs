#!/usr/bin/env node
// Private, read-only check of the deployed assignment register. Never print
// campaign codes or assignment labels: those belong only in the gated report.
import { execFileSync } from "node:child_process";

import {
  AIRTABLE_KEYCHAIN,
  fetchPortfolioAssignments,
  resolveAirtableToken,
} from "./portfolio-insights-airtable.mjs";
import { checkPrivateAssignments } from "./portfolio-insights-private-check.mjs";

const token = await resolveAirtableToken({
  env: process.env,
  readKeychain: async (service, account) => execFileSync("security", [
    "find-generic-password", "-s", service, "-a", account, "-w",
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
});
if (!token) throw new Error(`Missing ${AIRTABLE_KEYCHAIN.service}/${AIRTABLE_KEYCHAIN.account} read credential`);

const minimum = Number(process.argv[2] ?? 0);
console.log(await checkPrivateAssignments(() => fetchPortfolioAssignments({ token }), minimum));
