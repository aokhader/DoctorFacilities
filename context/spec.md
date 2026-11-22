# Doctor Finder — Technical Spec

Status: approved 2026-11-21. Items marked PROPOSED still need the owner's sign-off (see decisions.md).

## Why
Staff keep a spreadsheet of doctors: profession, office addresses, contracted surgery centers, insurance and languages. To find "the nearest doctor whose surgery center is also near the patient," they currently click through hand-placed pins on a Google Map. Doctor Finder replaces that clicking: type the patient's location, pick a profession, and get a ranked list.

Main goal: **simple to use, simple to read, simple to understand.** The users are not comfortable with new technology.

## Decisions already made (don't reopen)
| # | Decision |
|---|---|
| D1 | Lives **inside Google Sheets** (custom menu + sidebar, Apps Script). Google Sheets is the master copy. Excel files get imported into it. |
| D2 | Users: **office staff only** (internal). |
| D3 | Sheet has **full street addresses** for offices and surgery centers. |
| D4 | Layout: **one row per doctor + surgery center**, with an **office address column on each row**. |
| D5 | Ranking uses **both office and surgery center**: sort by the farther of the two. |
| D6 | Distance = **straight-line miles**. Each address links to Google Maps for real directions. |
| D7 | Filters: profession (required), **max distance, insurance, language**. Insurance and language columns already exist. |
| D8 | Duplicates (same doctor name + profession + facility): **report them, never delete or skip them in the sheet.** |

## 1. Goal, users, non-goals
- **Goal:** type the patient's ZIP or address, pick a profession, and see a ranked list of doctors whose office and surgery center are both close.
- **Users:** office staff working in Google Sheets. No new app, no login, no install.
- **Non-goals:** driving times, a patient-facing site, replacing the existing Google My Map, editing or cleaning the doctor list, fuzzy name matching ("Dr. Smith" vs "Smith MD").

## 2. Requirements
| ID | Requirement |
|---|---|
| R1 | Search by patient location + profession. It returns a ranked doctor list on a **Results** tab |
| R2 | Rank each doctor by `max(nearest office mi, nearest surgery center mi)`, in straight-line miles |
| R3 | Optional filters: max miles, insurance, language |
| R4 | Each result shows the doctor's nearest surgery center plus their other surgery centers within the limit |
| R5 | Duplicate report (name + profession + facility). Rows are never deleted or skipped in the sheet |
| R6 | Address lookups cached in a **Locations** tab. Addresses that can't be found are reported |
| R7 | Never writes to the **Doctors** tab. Never stores the patient's address |
| R8 | Every failure shows a plain-English message that says what to do next |
| R9 | A setup guide that a non-technical person can follow step by step |

## 3. User flows
1. **Search (R1–R4):** menu **Doctor Finder → Find doctors…** opens the sidebar. Staff enter:
   - the patient's ZIP or address
   - a profession (dropdown)
   - max miles (default 25, PROPOSED; blank means any)
   - insurance (Any or a value from the sheet)
   - language (Any or a value from the sheet)

   Then they click **Find doctors**. The Results tab fills, and the sidebar says "Found 7 doctors — see the Results tab," plus any warnings.
2. **Duplicates (R5):** menu **Doctor Finder → Check for duplicates** opens a popup like "Rows 12 and 45: Jane Doe · Cardiology · Example Surgery Center." Each search also warns "3 possible duplicates — use Check for duplicates."
3. **First-time setup (R6, R9):** paste the 3 files into Extensions → Apps Script, approve Google's permission screen, then run **Doctor Finder → Look up all addresses** once. See setup.md.
4. **Update from Excel:** File → Import → upload the .xlsx → "Replace current sheet" on the Doctors tab. New or changed addresses are looked up on the next search.
5. **Address not found (R6, R8):** the sidebar lists the addresses that couldn't be found. Staff fix the typo on the Doctors tab (the corrected text counts as a new address, so it's looked up again), or delete that address's row on the Locations tab to retry.

## 4. Data (full detail in data.md)
- **Doctors tab** (read only). Columns are found by header text (trimmed, case-insensitive), so column order doesn't matter. PROPOSED headers: `Doctor Name, Profession, Office Address, Facility Name, Facility Address, Insurance, Languages`. Insurance and languages are comma- or semicolon-separated lists in one cell.
- **Locations tab** (owned by the tool; a cache): `Address | Latitude | Longitude | Google matched as | Looked up on`. Addresses that can't be found are stored as `NOT FOUND`, so they don't use up the daily lookup limit again.
- **Results tab** (owned by the tool; cleared each search). Row 1 shows the search criteria and time, **without the patient's address**. Columns: `Rank | Doctor | Profession | Nearest office | Office (mi) | Nearest surgery center | Center (mi) | Other centers within limit | Insurance | Languages`. Clicking an address opens it in Google Maps (destination only).

## 5. Logic
1. **Normalize text:** trim, collapse repeated spaces, lowercase. Used for matching only, never written back.
2. **Group rows** into doctors by name + profession (PROPOSED). For each doctor, collect the distinct office addresses, the distinct facilities (name + address), and all of their insurance and language values.
3. **Duplicates:** rows that share the normalized name + profession + facility name, reported with sheet row numbers (row 1 is the header).
4. **Geocode:** `Maps.newGeocoder()` (built into Apps Script, no API key) with the region set to US. Each address is looked up once ever, through the Locations cache. The patient's location is looked up on every search and kept in memory only.
5. **Distance:** haversine formula, in miles, rounded to 0.1.
6. **Filter:** profession matches the chosen one, and insurance/language contain the chosen value (unless Any).
7. **Rank:**
   - score = max(nearest office mi, nearest center mi)
   - A doctor with only one kind of location uses that one, with a note such as "No office listed."
   - With max miles set, both distances must be within it.
   - Sort by score, then center miles, then name.
   - With no limit, show the top 20 (PROPOSED).

## 6. Files
```
README.md                 What it is + link to the setup guide
CLAUDE.md                 Rules for every Claude Code session
context/                  Spec, architecture, data, setup, decisions, progress
apps-script/Code.js       Google parts: menu, sidebar, read Doctors, geocode + Locations cache, write Results
apps-script/Logic.js      Plain functions: normalize, findDuplicates, milesBetween, rankDoctors
apps-script/Sidebar.html  The search form
tests/logic.test.js       `node --test`, no installs. Tests Logic.js only
sample/doctors-sample.csv Made-up doctors at public San Diego addresses
```
- The full function list, data shapes and layers are in architecture.md.
- `Logic.js` ends with `if (typeof module !== 'undefined') module.exports = {...}` so Node can test it. Apps Script ignores that line.
- No libraries, no build step, no clasp. Staff copy and paste the 3 files in `apps-script/` into the Apps Script editor. There, `.js` files become `.gs`.

## 7. Limits and failures (R8)
| Situation | Message / behavior |
|---|---|
| A header is missing | "Couldn't find the column 'Office Address' on the Doctors tab. Check the header spelling." |
| The Doctors tab is missing (renamed) | "Couldn't find a tab named 'Doctors'. Rename the tab with the doctor list to Doctors." |
| Patient address not found (or found only as a whole state, D20) | "Couldn't find that location. Try just the ZIP code." |
| Patient location left blank | "Type the patient's ZIP code or address." |
| No profession picked | "Pick a profession." |
| Max miles isn't a number above 0 (e.g. 0, -5, "abc") | "Max miles must be a number above 0, like 25. Leave it blank for any distance." |
| An office or center address not found | Ignored for ranking, marked NOT FOUND on the Locations tab, and listed in the sidebar warnings: "Google couldn't find these addresses, so they're left out of the distances: 123 Nowhere Rd, Nowhere, CA 00000. Fix the spelling on the Doctors tab and they will be looked up again." |
| Daily lookup limit (1,000/day on a personal Gmail account, 10,000 on Workspace, per the Apps Script quotas page, checked 2026-11-21) | "Google's daily address lookup limit was reached. Try again tomorrow — addresses already looked up still work." |
| Google's short-term rate limit ("too many times in a short time") | "Google asked Doctor Finder to slow down. Wait a minute and try again." |
| Any other Google lookup problem (e.g. `UNKNOWN_ERROR`) | "Google's address lookup had a problem. Try again in a few minutes." Nothing is saved for that address, so it's retried next time |
| Script time limit (6 min per run, per the quotas page) | Lookup stops after the first lookup past 5 min: "Looked up 180 of 400. Run Look up all addresses again to finish." |
| A search runs out of time looking up new doctor addresses | Results are still written from the addresses already looked up, with the warning "12 addresses aren't looked up yet, so some doctors may be missing. Run Doctor Finder → Look up all addresses, then search again." |
| All addresses looked up | "All 400 addresses are looked up (12 new this time)." Plus the not-found list, if any |
| The search panel can't read the Doctors tab when it opens | The tab or header message above, then "Then close this panel and open Doctor Finder → Find doctors… again." |
| Anything unexpected (a bug, a Google outage, a lost connection while the search panel is open) | "Something went wrong (…). Reload the sheet and try again. If it keeps happening, send a screenshot of this to whoever set up Doctor Finder." No stack trace |
| No matches | "No doctors matched. Try a larger distance or Any insurance." |

## 8. Privacy
- Internal staff tool.
- The patient's location goes to Google's geocoder (the same as typing it into Google Maps) and is never written to the sheet.
- Staff shouldn't type patient names into the sidebar.
- Doctor data stays in the owner's own Google account.

## 9. Testing
- `node --test` covers:
  - haversine: same point = 0; 1° of latitude ≈ 69.1 mi
  - duplicate detection with case and spacing variants
  - grouping one doctor across several rows
  - ranking order and the max-miles filter
  - a doctor with no office listed
- Manual: import `sample/doctors-sample.csv` into a test Google Sheet and run every flow in §3.
