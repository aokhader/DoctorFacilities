# Progress

Rule: update this file at the end of every session. Change only the rows you worked on, plus **Now / Next / Blocked**.

**Where we are (2026-11-22):**
- Steps 1–2 are done.
- Steps 3–4 are built on branch `steps-3-6-sheets`: `Code.js` has the menu, Check for duplicates, and Look up all addresses with the Locations tab.
- 21 tests pass.
- A throwaway stand-in for Google (fake tabs, popups and geocoder, kept outside the repo) ran every step 3–4 "Done when" offline.
- Checkpoint A passed in real Google Sheets on 2026-11-22, after a time zone fix (D22). Nowhere was saved as NOT FOUND, so D20 holds.
- Steps 5–6 are done: `Sidebar.html`, Find doctors → Results tab, and every spec §7 message. Checkpoint B passed in real Google Sheets on 2026-11-22, after the owner's ranking change (D25).
- Steps 3–6 are on branch `steps-3-6-sheets`, not yet merged to `main`.

## Now / Next / Blocked
- **Now:** owner opens the pull request for `steps-3-6-sheets` (steps 3–6, plus `README.md` from step 7).
- **Next:** the rest of step 7: the owner's walkthrough of setup.md Part 1, fixing any Google menu names that changed.
- **Blocked:** nothing.

## Build steps (in order)
| # | Step | Requirements | Done when | Status |
|---|---|---|---|---|
| 1 | `apps-script/Logic.js` + `tests/logic.test.js` | R2 R3 R4 R5 | `node --test` passes every case in spec §9 | done 2026-11-21 |
| 2 | `sample/doctors-sample.csv` | R9 | Has every case listed in data.md "sample/doctors-sample.csv" | done 2026-11-21 (checked by the end-to-end test) |
| 3 | `Code.js`: menu, read Doctors by header, **Check for duplicates** popup | R5 R7 R8 | The menu appears. The popup lists the sample's duplicate rows. A missing header shows its message. The Doctors tab is unchanged | done 2026-11-22 (checkpoint A checks 1–2 passed in Google) |
| 4 | `Code.js`: address lookup, Locations tab, **Look up all addresses** | R6 R8 | Sample addresses are saved. The bad address shows NOT FOUND. A second run looks nothing up again. It stops at about 5 min with the "run again" message | done 2026-11-22 (checkpoint A passed in Google after the D22 time zone fix) |
| 5 | `Sidebar.html` + search → Results tab | R1 R2 R3 R4 R7 | A search fills Results in the right order. Filters work. Address links open Google Maps. The patient's address appears on no tab | done 2026-11-22 (checkpoint B passed in Google, with D25) |
| 6 | Failure messages | R8 | Every row of spec §7 triggered once by hand, and each message matches | done 2026-11-22 (every §7 message matched offline word for word, and by hand in checkpoint B) |
| 7 | `README.md` + real walkthrough (**owner**) | R9 | The owner completes setup.md Part 1 on the sample sheet alone. Menu names in setup.md fixed to match Google | in progress: `README.md` written 2026-11-22; owner walkthrough next |
| E | **Future:** Excel support (after step 7) | R1–R9 on Excel | The owner answers architecture.md §8 "Decide before starting," and the choice is logged in decisions.md. Then follow §8's plan | not started |

## Requirements coverage
| ID | Requirement (short) | Steps | Status |
|---|---|---|---|
| R1 | Search → ranked Results tab | 5 | done (step 5), checked in Google |
| R2 | Rank by farther of office / center | 1, 5 | done (steps 1, 5), checked in Google. Found offices rank first (D25) |
| R3 | Filters: miles, insurance, language | 1, 5 | done (steps 1, 5), checked in Google |
| R4 | Nearest center + other centers within limit | 1, 5 | done (steps 1, 5), checked in Google |
| R5 | Duplicate report, never delete or skip | 1, 3 | logic done (step 1); popup done (step 3), checked in Google |
| R6 | Locations cache + not-found report | 4 | done (step 4), checked in Google |
| R7 | Never write Doctors; never store the patient's address | 3, 5 | done: Doctors unchanged, and a searched ZIP found on no tab (Find and replace, all sheets), checked in Google |
| R8 | Plain-English failure messages | 3, 4, 6 | done: every spec §7 message, checked offline and in Google |
| R9 | Setup guide a non-technical person can follow | 2, 7 | sample done (step 2); walkthrough in step 7 |

## Step 7 checklist (spec §3 flows, on the sample sheet)
- [ ] Flow 1 — Search: Results filled, best first, links work
- [ ] Flow 2 — Duplicates: popup lists the sample pair, and both rows are still in the sheet
- [ ] Flow 3 — First-time setup: done from setup.md alone, including the "unverified app" screen
- [ ] Flow 4 — Update from Excel: "Replace current sheet" keeps the Locations tab and the tab name
- [ ] Flow 5 — Address not found: listed in the sidebar; fixing it gets it looked up again

## Session log
| Date | What was done | Next |
|---|---|---|
| 2026-11-21 | Spec, data, setup, decisions, progress and CLAUDE.md written | Owner sign-off, then step 1 |
| 2026-11-21 | architecture.md added (layers, contracts, Excel plan). Column names moved to Logic.js (D15) | Owner sign-off, then step 1 |
| 2026-11-21 | Steps 1–2: `Logic.js`, `tests/logic.test.js` (16 pass), `sample/doctors-sample.csv`. Added `listChoices`; D17–D19. Test command is now `node --test` | Step 3 |
| 2026-11-21 | Steps 3–4 on branch `steps-3-6-sheets`: `Code.js` (menu, duplicates popup, Look up all addresses, Locations tab). New Logic.js helpers: `describeDuplicates`, `planLookups`, `locationRow`, `readGeocoderAnswer`, `describeNotFound` (21 tests pass). Checked offline with a stand-in for Google. D20–D21 | Google checkpoint A, then step 5 |
| 2026-11-22 | Checkpoint A: checks 1–2 passed in Google. Check 3 failed with "Invalid argument: timeZone" because the sheet had no time zone set. `formatNow` now falls back to the script's time zone (D22). The stand-in now rejects a non-text time zone and reproduces the failure on the old code | Owner re-runs checkpoint A checks 3–5, then step 5 |
| 2026-11-22 | Checkpoint A passed. Step 5: `Sidebar.html`, "Find doctors…" menu item, `getSearchChoices`, `searchDoctors`, `writeResults`. New Logic.js `readSearchForm`, `summarizeSearch` (24 tests pass). Stand-in checks the search, filters, no matches, form messages, and that the patient ZIP is on no tab. The sidebar was previewed at 300 px with a fake Google. D23–D24 | Step 6, then checkpoint B |
| 2026-11-22 | Step 6: spec §7 gained the form messages, the not-found warning text, the search time-limit warning and the panel-loading failure. The stand-in triggers all 16 situations and matches each message to §7 word for word (17 checks pass) | Google checkpoint B |
| 2026-11-22 | Checkpoint B, in progress: the owner asked for doctors with a found office to rank first (D25). Done in `compareResults`. Downtown Cardiology is now A, C, E (was A, E, C). 24 tests + 17 stand-in checks pass | Owner finishes checkpoint B with the new Logic.js |
| 2026-11-22 | Checkpoint B passed in Google: search, filters, map links, privacy (Find and replace for the patient ZIP found nothing) and every §7 message. Steps 3–6 done | Owner decides on the PR, then step 7 |
| 2026-11-22 | Step 7, part 1: `README.md` written (what it is, the menu, what it never does, links to setup.md Parts 1–2, files, tests, status). Added to the `steps-3-6-sheets` PR | Owner walks through setup.md Part 1 alone |
