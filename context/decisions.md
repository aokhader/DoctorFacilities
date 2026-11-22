# Decisions

Rule: add a line for every decision. Don't rewrite old lines. If a decision changes, add a new line that says which one it replaces.

| Date | # | Decision | Why | Who |
|---|---|---|---|---|
| 2026-11-21 | D1 | Build inside Google Sheets (menu + sidebar, Apps Script). Google Sheets is the master copy; Excel gets imported | The list moves between Excel and Sheets. Sheets needs no install and has a built-in address lookup | Owner (Q&A) |
| 2026-11-21 | D2 | Users are office staff only | Internal tool | Owner (Q&A) |
| 2026-11-21 | D3 | The sheet has full street addresses | Accurate distances | Owner (Q&A) |
| 2026-11-21 | D4 | One row per doctor + surgery center, with an office address column on each row | How the sheet is laid out today | Owner (Q&A) |
| 2026-11-21 | D5 | Rank by the farther of nearest office and nearest surgery center | The patient needs both the office and the center to be close | Owner (Q&A) |
| 2026-11-21 | D6 | Straight-line miles, plus a Google Maps link for real directions | Instant and free | Owner (Q&A) |
| 2026-11-21 | D7 | Filters: profession (required), max miles, insurance, language | These columns already exist | Owner (Q&A) |
| 2026-11-21 | D8 | Duplicates (name + profession + facility) are reported, never deleted or skipped | The owner wants to review them first | Owner |
| 2026-11-21 | D9 | Results go to a Results tab, not the sidebar | The sidebar is too narrow; a tab can be sorted, copied and printed | Claude, approved with spec |
| 2026-11-21 | D10 | Use the built-in `Maps.newGeocoder()`, no API key | No billing or key setup for staff | Claude, approved with spec |
| 2026-11-21 | D11 | Cache every address lookup in a Locations tab | Each address is looked up once ever, so searches stay under the daily limit | Claude, approved with spec |
| 2026-11-21 | D12 | The patient's address is never stored, and map links are destination only | Privacy | Claude, approved with spec |
| 2026-11-21 | D13 | No libraries, no build step, no clasp. Install is copy and paste | Nothing for staff to install or learn | Claude, approved with spec |
| 2026-11-21 | D14 | Google-free logic lives in `Logic.js` and is tested with `node --test` | It's the only part that can be tested outside Google | Claude, approved with spec |
| 2026-11-21 | D15 | Column header names (`COLUMN_NAMES`) live in `Logic.js`, not `Code.js` | Sheets and a future Excel version must share one copy | Claude, with architecture.md |
| 2026-11-21 | D16 | Excel support (running inside Excel) is a planned future step. The approach is still open: see architecture.md §8 | Owner wants Excel support later; the Sheets version comes first | Owner |
| 2026-11-21 | D17 | Rows with a blank `Profession` are left out of searches and listed in the warnings, the same as blank names (P7). They stay in the sheet | A doctor with no profession can never match a search, so leaving it out silently would hide it | Claude, phase 1 plan approved by owner |
| 2026-11-21 | D18 | If a doctor's office or center is in the sheet but Google couldn't find it, the Results cell says "Office address not found" / "Surgery center address not found", not "No office listed" | Staff shouldn't be told an address is missing when it's there and just needs fixing | Claude, phase 1 plan approved by owner |
| 2026-11-21 | D19 | The test command is `node --test` (no folder name) | Node 22 reads `node --test tests/` as a file pattern and finds nothing. Plain `node --test` finds `*.test.js` files on Node 18 through 22 | Claude, step 1 |
| 2026-11-21 | D20 | If Google can only place an address at state or country level, it counts as NOT FOUND. This applies to doctor addresses and the patient's. A ZIP or a city still counts | A mistyped address pinned to the middle of California would give wrong miles with no warning | Owner (steps 3–6 plan) |
| 2026-11-21 | D21 | If Google answers `INVALID_REQUEST` for an address, it's saved as NOT FOUND, the same as `ZERO_RESULTS`. Only temporary problems (`UNKNOWN_ERROR`, limits) stop the run without saving | An error that isn't saved would be retried first on every run, so one odd address could block all later lookups | Claude, step 4 |
| 2026-11-22 | D22 | Dates use the spreadsheet's time zone. If the sheet has none set, they use the script's time zone (`Session.getScriptTimeZone()`) | At checkpoint A the owner's new sheet returned no time zone, and Look up all addresses failed with "Invalid argument: timeZone" | Claude, checkpoint A fix |
| 2026-11-22 | D23 | The "N possible duplicates — use Check for duplicates." warning shows with each search's result, not when the search panel opens | That's where spec flow 2 puts it, and the panel opens faster without it | Claude, step 5 |
| 2026-11-22 | D24 | Max miles is a plain text box, and the sidebar does no browser checks of its own (`novalidate`). Doctor Finder checks every field itself | A browser number box silently turns "25 mi" into blank, which would mean "any distance". Checking once in Logic.js gives the same plain message everywhere, and it carries over to Excel | Claude, step 5 |

## Needs sign-off (PROPOSED)
The build can start with these as written. Each one is a single line to change later.
- [ ] **P1** Tab names: `Doctors`, `Locations`, `Results`.
- [ ] **P2** Column headers: `Doctor Name, Profession, Office Address, Facility Name, Facility Address, Insurance, Languages`. **Owner: please send your real header row.**
- [ ] **P3** Default max distance of 25 mi. With no limit, show the top 20.
- [ ] **P4** The Results tab shows the search criteria but not the patient's address.
- [ ] **P5** Duplicates match on exact text after trimming and ignoring case, so "Dr. Jane Doe" and "Jane Doe" are **not** flagged.
- [ ] **P6** A doctor is identified by name + profession. Two different doctors with the same name and profession would be merged.
- [ ] **P7** Rows with a blank `Doctor Name` are left out of searches and listed in the warnings. (They stay in the sheet.)

## Open questions for the owner
- Personal Gmail account or Google Workspace? That decides the daily lookup limit: about 1,000 vs 10,000.
- Roughly how many rows and distinct addresses? That decides how long the first "Look up all addresses" takes.
