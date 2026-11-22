# Progress

Rule: update this file at the end of every session. Change only the rows you worked on, plus **Now / Next / Blocked**.

**Where we are (2026-11-21):**
- Steps 1–2 are done.
- Steps 3–4 are built on branch `steps-3-6-sheets`: `Code.js` has the menu, Check for duplicates, and Look up all addresses with the Locations tab.
- 21 tests pass.
- A throwaway stand-in for Google (fake tabs, popups and geocoder, kept outside the repo) ran every step 3–4 "Done when" offline.
- Not yet checked in real Google Sheets.

## Now / Next / Blocked
- **Now:** Google checkpoint A (owner), which covers steps 3–4 on a test sheet made from `sample/doctors-sample.csv`.
- **Next:** step 5 (`Sidebar.html` + search → Results tab), then step 6 and Google checkpoint B.
- **Blocked:** step 5 waits on checkpoint A. If Google saves `123 Nowhere Rd, Nowhere, CA 00000` with coordinates instead of NOT FOUND, the vague-match rule (D20) needs adjusting first.

## Build steps (in order)
| # | Step | Requirements | Done when | Status |
|---|---|---|---|---|
| 1 | `apps-script/Logic.js` + `tests/logic.test.js` | R2 R3 R4 R5 | `node --test` passes every case in spec §9 | done 2026-11-21 |
| 2 | `sample/doctors-sample.csv` | R9 | Has every case listed in data.md "sample/doctors-sample.csv" | done 2026-11-21 (checked by the end-to-end test) |
| 3 | `Code.js`: menu, read Doctors by header, **Check for duplicates** popup | R5 R7 R8 | The menu appears. The popup lists the sample's duplicate rows. A missing header shows its message. The Doctors tab is unchanged | built 2026-11-21, passes offline; waiting for checkpoint A |
| 4 | `Code.js`: address lookup, Locations tab, **Look up all addresses** | R6 R8 | Sample addresses are saved. The bad address shows NOT FOUND. A second run looks nothing up again. It stops at about 5 min with the "run again" message | built 2026-11-21, passes offline; waiting for checkpoint A |
| 5 | `Sidebar.html` + search → Results tab | R1 R2 R3 R4 R7 | A search fills Results in the right order. Filters work. Address links open Google Maps. The patient's address appears on no tab | todo |
| 6 | Failure messages | R8 | Every row of spec §7 triggered once by hand, and each message matches | todo |
| 7 | `README.md` + real walkthrough (**owner**) | R9 | The owner completes setup.md Part 1 on the sample sheet alone. Menu names in setup.md fixed to match Google | todo |
| E | **Future:** Excel support (after step 7) | R1–R9 on Excel | The owner answers architecture.md §8 "Decide before starting," and the choice is logged in decisions.md. Then follow §8's plan | not started |

## Requirements coverage
| ID | Requirement (short) | Steps | Status |
|---|---|---|---|
| R1 | Search → ranked Results tab | 5 | todo |
| R2 | Rank by farther of office / center | 1, 5 | logic done (step 1); Results tab in step 5 |
| R3 | Filters: miles, insurance, language | 1, 5 | logic done (step 1); sidebar in step 5 |
| R4 | Nearest center + other centers within limit | 1, 5 | logic done (step 1); Results tab in step 5 |
| R5 | Duplicate report, never delete or skip | 1, 3 | logic done (step 1); popup built (step 3), passes offline |
| R6 | Locations cache + not-found report | 4 | built (step 4), passes offline |
| R7 | Never write Doctors; never store the patient's address | 3, 5 | Doctors unchanged offline (steps 3–4); patient address in step 5 |
| R8 | Plain-English failure messages | 3, 4, 6 | steps 3–4 messages built and in spec §7; full pass in step 6 |
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
