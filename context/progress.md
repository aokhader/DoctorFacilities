# Progress

Rule: update this file at the end of every session. Change only the rows you worked on, plus **Now / Next / Blocked**.

**Where we are (2026-11-21):** the spec and context folder are done. Code not started.

## Now / Next / Blocked
- **Now:** nothing in progress.
- **Next:** the owner reviews P1–P7 and the open questions in decisions.md, then step 1.
- **Blocked:** nothing. Steps 1–6 can use the PROPOSED headers. Step 7 needs the owner and a real Google account.

## Build steps (in order)
| # | Step | Requirements | Done when | Status |
|---|---|---|---|---|
| 1 | `apps-script/Logic.js` + `tests/logic.test.js` | R2 R3 R4 R5 | `node --test tests/` passes every case in spec §9 | todo |
| 2 | `sample/doctors-sample.csv` | R9 | Has every case listed in data.md "sample/doctors-sample.csv" | todo |
| 3 | `Code.js`: menu, read Doctors by header, **Check for duplicates** popup | R5 R7 R8 | The menu appears. The popup lists the sample's duplicate rows. A missing header shows its message. The Doctors tab is unchanged | todo |
| 4 | `Code.js`: address lookup, Locations tab, **Look up all addresses** | R6 R8 | Sample addresses are saved. The bad address shows NOT FOUND. A second run looks nothing up again. It stops at about 5 min with the "run again" message | todo |
| 5 | `Sidebar.html` + search → Results tab | R1 R2 R3 R4 R7 | A search fills Results in the right order. Filters work. Address links open Google Maps. The patient's address appears on no tab | todo |
| 6 | Failure messages | R8 | Every row of spec §7 triggered once by hand, and each message matches | todo |
| 7 | `README.md` + real walkthrough (**owner**) | R9 | The owner completes setup.md Part 1 on the sample sheet alone. Menu names in setup.md fixed to match Google | todo |

## Requirements coverage
| ID | Requirement (short) | Steps | Status |
|---|---|---|---|
| R1 | Search → ranked Results tab | 5 | todo |
| R2 | Rank by farther of office / center | 1, 5 | todo |
| R3 | Filters: miles, insurance, language | 1, 5 | todo |
| R4 | Nearest center + other centers within limit | 1, 5 | todo |
| R5 | Duplicate report, never delete or skip | 1, 3 | todo |
| R6 | Locations cache + not-found report | 4 | todo |
| R7 | Never write Doctors; never store the patient's address | 3, 5 | todo |
| R8 | Plain-English failure messages | 3, 4, 6 | todo |
| R9 | Setup guide a non-technical person can follow | 2, 7 | todo |

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
