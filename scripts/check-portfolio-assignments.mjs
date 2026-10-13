#!/usr/bin/env node
// Private, read-only check of the deployed assignment register. Never print
// campaign codes or assignment labels: those belong only in the gated report.
import { execFileSync } from "node:child_process";

import {
  AIRTABLE_KEYCHAIN,
  fetchPortfolioAssignments,
  resolveAirtableToken,
} from "./portfolio-insights-airtable.mjs";

const token = await resolveAirtableToken({
  env: process.env,
  readKeychain: async (service, account) => execFileSync("security", [
    "find-generic-password", "-s", service, "-a", account, "-w",
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
});
if (!token) throw new Error(`Missing ${AIRTABLE_KEYCHAIN.service}/${AIRTABLE_KEYCHAIN.account} read credential`);

const assignments = await fetchPortfolioAssignments({ token });
const minimum = Number(process.argv[2] ?? 0);
if (!Number.isSafeInteger(minimum) || minimum < 0) throw new Error("Minimum assignment count must be a nonnegative integer");
if (assignments.length < minimum) throw new Error(`Assignment count ${assignments.length} is below ${minimum}`);
console.log(`Private assignment read passed: ${assignments.length} assignments, ${assignments.filter((item) => item.person).length} named`);
