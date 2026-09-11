# Job Search portfolio link fields implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four idempotent portfolio-link assignment fields to the Job Search Actions table and verify the live schema without changing the five-table v2 model.

**Architecture:** The existing `scripts/migrate_v2.py` schema migration owns the new fields and its verifier checks their names, types, and allowed channel choices. Portfolio links remain Actions linked to People, Jobs, and Companies. The portfolio dashboard gets a separate read-only credential and never writes to this base.

**Tech stack:** Python 3 standard library, Airtable Metadata API, Airtable Records API, `unittest`.

**Spec:** `braininavatgroup/portfolio@3700673561b605e152189774229b572669d1cdab:docs/superpowers/specs/2026-09-11-portfolio-intelligence-dashboard-design.md`

## Global constraints

- Work in a fresh Job Search worktree from fetched `origin/main`, whose merge commit for PR #9 is `082cd55c8d44d5bef66de8e20b46f19e5ad8698e`.
- Keep Actions, Jobs, People, Companies, and Sources as the only active tables.
- Do not revive Applications or add a Portfolio Recipients table.
- The four fields belong to Actions: `Portfolio Campaign Code`, `Portfolio Link Sent`, `Portfolio Link Channel`, and `Portfolio URL`.
- Channel choices are exactly `Email`, `LinkedIn`, `Application`, `Referral`, and `Other`.
- A campaign code must be a unique lowercase value matching `[a-z0-9][a-z0-9_-]{5,63}`. Airtable cannot enforce uniqueness, so the migration verifier must reject duplicates.
- The migration is idempotent and never edits existing Action records merely because it added fields.
- Back up the live schema before applying the migration. Keep the backup in `exports/private/`, which is gitignored.
- Run schema creation with an administrative migration credential. The scheduled portfolio report uses a different read-only credential.

---

### Task 1: Define and test the Action field contract

**Files:**
- Modify: `scripts/migrate_v2.py`
- Create: `scripts/migrate_v2_test.py`

**Interfaces:**
- Produces: `PORTFOLIO_ACTION_FIELDS: list[dict]`
- Produces: `portfolio_schema_problems(schema: Schema, actions: list[dict]) -> list[str]`
- Produces: CLI flag `--portfolio-fields-only`, which never enters the v2 record migration
- Preserves: `migrate()` and `verify()` command behavior

- [ ] **Step 1: Write the failing field-spec test**

```py
def test_portfolio_action_fields_match_the_dashboard_contract(self):
    by_name = {field["name"]: field for field in migrate_v2.PORTFOLIO_ACTION_FIELDS}
    self.assertEqual(by_name["Portfolio Campaign Code"]["type"], "singleLineText")
    self.assertEqual(by_name["Portfolio Link Sent"]["type"], "dateTime")
    self.assertEqual(
        [choice["name"] for choice in by_name["Portfolio Link Channel"]["options"]["choices"]],
        ["Email", "LinkedIn", "Application", "Referral", "Other"],
    )
    self.assertEqual(by_name["Portfolio URL"]["type"], "url")
```

- [ ] **Step 2: Write failing verifier tests**

Pass synthetic schema and Action records to `portfolio_schema_problems`. Require errors for a missing field, wrong type, wrong select choices, malformed code, and duplicate non-empty code. Require no error for blank codes and two distinct valid codes.

- [ ] **Step 3: Run the unit tests and confirm failure**

Run: `python3 -m unittest scripts/migrate_v2_test.py -v`

Expected: FAIL because the field constant and verifier helper do not exist.

- [ ] **Step 4: Implement the exact field specs**

Use:

```py
PORTFOLIO_ACTION_FIELDS = [
    {"name": "Portfolio Campaign Code", "type": "singleLineText", "description": "Unique opaque code assigned to one sent portfolio link. Lowercase letters, numbers, underscores, and hyphens only; 6 to 64 characters."},
    {"name": "Portfolio Link Sent", "type": "dateTime", "description": "When this assigned portfolio link was sent."},
    {"name": "Portfolio Link Channel", "type": "singleSelect", "options": choices("Email", "LinkedIn", "Application", "Referral", "Other"), "description": "Channel used for this assigned portfolio link."},
    {"name": "Portfolio URL", "type": "url", "description": "Canonical bradleyberkman.com URL carrying this Action's opaque campaign code."},
]
```

Call `ensure_field(schema, actions, spec)` for each entry after the existing core Action fields. Do not create or modify records.

- [ ] **Step 5: Add the schema-only command path**

Add `migrate_portfolio_fields()` that loads the existing Actions table, fails if it is missing, runs `ensure_field` for only `PORTFOLIO_ACTION_FIELDS`, and calls the portfolio field verifier. Route `--portfolio-fields-only` to this function before the existing `migrate()` branch. Combining it with `--verify` performs the same portfolio-specific verification without a write. Unit-test that this path never calls `list_records` for People or Sources and never calls `upsert_by_key`.

- [ ] **Step 6: Implement live verification**

Have `portfolio_schema_problems` inspect the Actions table fields and records. Validate `Portfolio URL` only when present: it must use HTTPS, host `bradleyberkman.com` or `www.bradleyberkman.com`, and contain `campaign=<matching code>`. Add its returned problems to the existing `verify()` list.

- [ ] **Step 7: Run unit and syntax checks**

Run: `python3 -m unittest scripts/migrate_v2_test.py -v && python3 -m py_compile scripts/migrate_v2.py`

Expected: PASS. These tests own field type, select choice, code uniqueness, code syntax, and URL-code agreement until portfolio assignment leaves Actions.

- [ ] **Step 8: Commit the migration code**

```bash
git add scripts/migrate_v2.py scripts/migrate_v2_test.py
git commit -m "feat(BIV-421): add portfolio link fields to actions"
```

### Task 2: Apply and document the live schema migration

**Files:**
- Modify: `docs/airtable-implementation.md`
- Modify: `docs/airtable-views.md`
- External state: Airtable base `app0LM9NfGL4ZHi3j`

**Interfaces:**
- Consumes: `PORTFOLIO_ACTION_FIELDS` from Task 1
- Produces: a live Actions schema accepted by the portfolio read adapter

- [ ] **Step 1: Export the pre-change schema**

Use the migration credential to write the current metadata response to a new timestamped directory under `exports/private/`. Confirm the backup includes table `tblheGY3pSKmWvAS9` and does not enter `git status`.

- [ ] **Step 2: Dry-run the migration**

Run: `AIRTABLE_API_TOKEN=<migration credential> python3 scripts/migrate_v2.py --portfolio-fields-only --dry-run`

Expected: output proposes only the four missing Actions fields. It must not propose a table, retirement, record update, or record deletion.

- [ ] **Step 3: Draft the schema record and daily view guidance**

Add the four field names, types, Actions table ID, and backup path to `docs/airtable-implementation.md`, marking the live run as pending. Add the fields to a Portfolio links view in `docs/airtable-views.md`; keep the daily Next actions view at eight visible columns or fewer.

- [ ] **Step 4: Commit the planned migration record**

```bash
git add docs/airtable-implementation.md docs/airtable-views.md
git commit -m "docs(BIV-421): define portfolio link schema migration"
```

- [ ] **Step 5: Run candidate checks**

Run: `python3 -m unittest scripts/migrate_v2_test.py -v && python3 -m py_compile scripts/migrate_v2.py && git diff --check origin/main...HEAD`

Expected: PASS against one clean candidate head.

- [ ] **Step 6: Publish and review before the live write**

Push both commits and open a pull request against `main`. Record the exact base, head, backup path, and dry-run output. Run elevated review because the change mutates production schema and validates personal job-search data. Fix important findings and repeat Step 5 against the new exact head. Never approve or admin-merge as Bradley.

- [ ] **Step 7: Apply the reviewed migration once**

From the exact reviewed head, run: `AIRTABLE_API_TOKEN=<migration credential> python3 scripts/migrate_v2.py --portfolio-fields-only`

Expected: four field creations followed by `VERIFY OK`. Stop if the output includes any existing record mutation.

- [ ] **Step 8: Prove idempotence and live verification**

Run the schema-only migration again, then run `AIRTABLE_API_TOKEN=<migration credential> python3 scripts/migrate_v2.py --portfolio-fields-only --verify`.

Expected: the second migration creates no fields or records, and verification prints `VERIFY OK`.

- [ ] **Step 9: Record the live result and re-review the exact head**

Replace the pending marker in `docs/airtable-implementation.md` with the UTC run time and the two successful verification results, then commit:

```bash
git add docs/airtable-implementation.md
git commit -m "docs(BIV-421): record portfolio link schema migration"
```

Push only after confirming the pull request remains open. Repeat Step 5 and elevated review against the new exact head.

- [ ] **Step 10: Queue the reviewed pull request**

Use the repository's normal merge queue after required checks and review pass. Do not push to protected `main`, approve as Bradley, or use admin merge.
