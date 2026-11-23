# Architecture

Status 2026-11-22: **All three layers are built (steps 1–6) and checked in real Google Sheets (checkpoints A and B).** The map (step 8: P-10, `Map.html`, the map functions in §4) is built and checked in Google Sheets (checkpoint C). This is the target that build steps 1–6 implement. If the code drifts from it, update this file in the same session.

Purpose: show how the pieces fit, and keep the Google-only code small, so **Excel support (§8) only has to replace one layer.**

## 1. The big picture
There are three layers. Only the middle one knows about Google.

```
 Staff
   │  types location, picks profession, clicks
   ▼
 ┌────────────────────────────────────────────┐
 │ 1. SCREEN        Sidebar.html              │  form + messages. No logic
 └────────────────────────────────────────────┘
   │  google.script.run  (the only link to layer 2)
   ▼
 ┌────────────────────────────────────────────┐
 │ 2. PLATFORM      Code.js   (Google only)   │  menu, read/write tabs,
 │                                            │  address lookup, popups
 └────────────────────────────────────────────┘
   │  plain function calls with plain data (§4)
   ▼
 ┌────────────────────────────────────────────┐
 │ 3. LOGIC         Logic.js  (no Google)     │  columns, duplicates,
 │                                            │  grouping, miles, ranking
 └────────────────────────────────────────────┘

 Stored in the spreadsheet:   Doctors (read only) · Locations (cache) · Results (output)
 Outside service:             Google's geocoder (Maps.newGeocoder, no key)
```

| Layer | File | Knows about Google? | Tested by |
|---|---|---|---|
| Screen | `apps-script/Sidebar.html`, `apps-script/Map.html` | Only through `google.script.run` / `google.script.host` calls | Hand (setup.md) |
| Platform | `apps-script/Code.js` | Yes, all of it | Hand (setup.md) |
| Logic | `apps-script/Logic.js` | **Never** (CLAUDE.md rule 5) | `node --test` |

**Why it's split this way:** Logic.js is most of the thinking and is the same on any spreadsheet program. Keeping it free of Google calls means it can be tested on a laptop and reused for Excel without changes.

## 2. Path of one search (flow 1)
The patient's location lives **in memory only** (R7). ⚠ marks each place it passes through.

1. Staff click **Doctor Finder → Find doctors…** → `showSearchPanel()` opens `Sidebar.html`.
2. The sidebar calls `getSearchChoices()`. Code.js reads Doctors, `Logic.readDoctorRows()` → `Logic.listChoices(rows)` + `DEFAULT_MAX_MILES` → dropdowns filled, Max miles pre-filled.
3. Staff fill the form and click **Find doctors**. ⚠ The sidebar sends `{location, profession, maxMiles, insurance, language}` (all text) to `searchDoctors(form)`.
4. ⚠ `Logic.readSearchForm(form)` → `{location, filters}`, or a plain message for a blank location, no profession, or bad Max miles.
5. Code.js reads Doctors → `Logic.readDoctorRows(values)` → rows, or a missing-header message (spec §7).
6. ⚠ Code.js geocodes `location` → `patientPoint` (not saved anywhere), or "Couldn't find that location…".
7. `Logic.listAddresses(rows)` → Code.js looks up any address not yet in Locations (stopping at about 5 min), saves each result, and builds `points` with `Logic.planLookups`.
8. `Logic.groupDoctors(rows)` → doctors. `Logic.rankDoctors(doctors, patientPoint, points, filters)` → results.
9. `Logic.buildResultsTable(results, filters, searchedAtText)` → a 2D array (no patient address). Code.js clears Results, writes it, and switches to it.
10. `Logic.summarizeSearch(...)` → `{message, warnings}` → the sidebar shows "Found 7 doctors — see the Results tab." plus warnings (rows left out, possible duplicates, addresses not found, addresses not looked up yet). ⚠ The typed location is discarded here.
11. ⚠ If doctors were found, the answer also carries `map: {patient: {lat, lng}, pins: Logic.buildMapPins(results, points)}`. The sidebar keeps it in memory and shows **Show on map** (D27). Clicking it sends `map` to `showResultsMap(map)`:
    - `Logic.fitMap` → center + zoom
    - P-10 draws the map picture
    - `Logic.pinPosition` places each pin on it
    - `Map.html` opens as a popup

    ⚠ The patient's point is discarded when the panel or popup closes.

**Other menu items:**
- **Check for duplicates:** read Doctors → `readDoctorRows` → `findDuplicates` → popup.
- **Look up all addresses:** read Doctors → `listAddresses` → look up the missing ones until about 5 min → "Looked up X of Y" popup.

## 3. Platform layer (`Code.js`): everything a platform must provide
**This table is the checklist for Excel (§8).**

| # | Job | Google Sheets way (check the docs when building) |
|---|---|---|
| P-1 | Add the menu | `onOpen()` + `SpreadsheetApp.getUi().createMenu()` |
| P-2 | Show the search panel | `HtmlService.createHtmlOutputFromFile('Sidebar')` → `showSidebar()` |
| P-3 | Read a tab as a 2D array | `sheet.getDataRange().getValues()` |
| P-4 | Write a 2D array to a tab (+ bold, freeze row 2) | `range.setValues()` / `setFormulas()` |
| P-5 | Create Locations/Results if missing | `insertSheet()` |
| P-6 | Look up one address → point, or null | `Maps.newGeocoder().setRegion('us').geocode()` |
| P-7 | Show a popup message | `SpreadsheetApp.getUi().alert()` |
| P-8 | Stop long work before the time limit | Check the elapsed time; stop at about 5 min (the limit is about 6) |
| P-9 | Know "today" for `Looked up on`, and the search time for the Results tab | `new Date()`, formatted in the sheet's time zone, or the script's if the sheet has none (D22) (`yyyy-mm-dd`; `yyyy-mm-dd h:mm a`). Logic.js gets ready-made text, so it has no time zones |
| P-10 | Show a map picture with clickable pins in a popup | `Maps.newStaticMap()` `.setSize/.setCenter/.setZoom` → `getBlob()` → a `data:` image (no API key; step 8.0 checked this), then `HtmlService.createTemplateFromFile('Map')` → `ui.showModalDialog()` |

**Entry points (the names the menu and sidebar call):**
- `onOpen()`
- `showSearchPanel()`
- `showDuplicates()`
- `lookUpAllAddresses()`
- `getSearchChoices()` → `{professions, insurances, languages, defaultMaxMiles}` or `{error}`
- `searchDoctors(form)` → `{message, warnings, map?}` or `{error}`
- `showResultsMap(map)` → `{}` (the popup opens) or `{error}`

The two sidebar functions **return** `{error: "<message>"}` instead of throwing, so the sidebar shows our message as written. The sidebar's failure handler is only for problems we couldn't catch, like a lost connection.

**Code.js's own helpers:**

| Helper | Job |
|---|---|
| `readDoctors()` | P-3. Throws the missing-tab message |
| `readTab(name)` | P-3. Returns `[]` if the tab is missing |
| `getOrCreateTab(name)`, `openLocationsTab()` | P-5. Locations gets bold, frozen headers, put back if the tab is emptied |
| `lookUpNewAddresses(addresses, stopAt)` | P-6 + P-8. `appendRow` after each lookup, and checks the clock after each one |
| `findPlace(address)` | P-6. Turns Google's "too many times…" errors into the spec §7 messages |
| `plainLimitError(error, dailyLimitMessage)` | Google's "too many times…" errors → the "slow down" or daily-limit message. Used by `findPlace` and `drawMap` |
| `drawMap(view, pointList)` | P-10. The map picture as a `data:` image. Adds a tiny Google marker under each pin, which peeks out if the pin math is ever wrong |
| `writeResults(table)` | P-4 + P-5. Clears Results, writes the table, bold + frozen header row 2, fits columns B onward (A holds the long search line), switches to the tab |
| `formatNow(pattern)` | P-9 |
| `showPopup(work)`, `answerSidebar(work)`, `messageFor(error)` | P-7. Popups for menu items, `{error}` for the sidebar. Our own messages are shown as written; anything else gets a generic next step |

The first line of Code.js is `@OnlyCurrentDoc`, so Google's permission screen asks only for this one spreadsheet.

Code.js holds **no** matching, distance or ranking rules. If you're about to write an `if` about doctors in Code.js, it belongs in Logic.js.

## 4. Logic layer (`Logic.js`): functions and data shapes
Plain JavaScript. No Google or Excel calls, no libraries. It ends with `if (typeof module !== 'undefined') module.exports = {...}` so Node can test it, and Apps Script and browsers ignore that line.

In Apps Script every file shares one scope, so Code.js calls these by plain name (`readDoctorRows(...)`). The `Logic.` prefix in this doc is only a label. Logic.js also has small helpers (`groupBy`, `uniqueBy`, `uniqueText`, `isAny`, `mapLink`, …), so **Code.js must not define functions with those names.**

**Settings at the top:**
- `COLUMN_NAMES`: the header text for each field. It lives here, not in Code.js, so every platform uses the same names (D15).
- `DEFAULT_MAX_MILES = 25`
- `TOP_N_WHEN_NO_LIMIT = 20` (P3)
- `LOCATION_HEADERS`, `NOT_FOUND`: the Locations tab layout (data.md)

| Function | In | Out |
|---|---|---|
| `normalizeText(text)` | any cell | trimmed, single-spaced, lowercase string |
| `splitList(cell)` | `"Aetna; Cigna"` | `["Aetna", "Cigna"]` |
| `readDoctorRows(values)` | 2D array, header row first | `{rows: Row[], warnings: string[]}`. **Throws** a plain-English Error if any of the 7 headers is missing. Rows with a blank name or profession are left out, with a warning (P7, D17) |
| `findDuplicates(rows)` | `Row[]` | `[{rowNumbers: [2, 5], doctorName, profession, facilityName}]` |
| `describeDuplicates(duplicates)` | output of `findDuplicates` | popup text: "Rows 2 and 5: …", or "No possible duplicates found." |
| `planLookups(addresses, locationValues)` | addresses + the Locations tab's 2D array | `{points, notFound: [address], toLookUp: [address]}`. NOT FOUND rows are not retried. If an address is on the tab twice, the later row wins |
| `locationRow(address, match, todayText)` | a match or `null` | the 5 Locations cells, or a `NOT FOUND` row |
| `readGeocoderAnswer(response)` | Google's geocoder answer | `{lat, lng, matchedAs}` or `null` (not found, or only a state or country, D20). **Throws** the daily-limit message or the "had a problem" message |
| `describeNotFound(addresses)` | addresses not found | a warning that says how to fix them, or `''` |
| `readSearchForm(form)` | the sidebar's text fields | `{location, filters}`. **Throws** the plain message for a blank location, no profession, or a Max miles that isn't a number above 0. Blank Max miles = any distance |
| `summarizeSearch(outcome)` | `{foundCount, rowWarnings, duplicateCount, notFound, notLookedUpCount}` | `{message, warnings}` for the sidebar |
| `groupDoctors(rows)` | `Row[]` | `Doctor[]` |
| `listAddresses(rows)` | `Row[]` | distinct office + facility addresses (original text) |
| `listChoices(rows)` | `Row[]` | `{professions, insurances, languages}` for the dropdowns: each value once, spelled as it first appears, A to Z |
| `milesBetween(a, b)` | two `Point`s | miles, rounded to 0.1 |
| `rankDoctors(doctors, patientPoint, points, filters)` | see shapes below | `Result[]`, best first, already cut to the limit or the top 20 |
| `mapUrl(address)` | an address | the destination-only Google Maps link (used by `mapLink` and the map pins) |
| `buildMapPins(results, points)` | `Result[]` + `points` | `MapPin[]`: one per place, the nearest office and nearest center of each doctor (D29) |
| `fitMap(pointList, size)` | `Point[]`, `MAP_SIZE` | `{center: Point, zoom}`: the closest whole zoom (≤ `MAX_MAP_ZOOM`) that fits every point inside `MAP_MARGIN` |
| `pinPosition(point, map, size)` | a `Point`, `{center, zoom}`, `MAP_SIZE` | `{x, y}` pixels on the picture (Web Mercator, as Google draws it) |
| `buildResultsTable(results, filters, searchedAtText)` | `Result[]`, Filters, text like `"2026-11-21 3:42 PM"` | 2D array for the Results tab (row 1 criteria, row 2 headers, then rows). Links are `=HYPERLINK(url, label)`, which **works in both Sheets and Excel** |

**Data shapes** (examples are made up):
```
Row      { rowNumber: 2, doctorName: "Dr. Sample A", profession: "Cardiology",
           officeAddress: "330 Park Blvd, San Diego, CA 92101",
           facilityName: "Harbor Surgery Center (sample)",
           facilityAddress: "202 C St, San Diego, CA 92101",
           insurance: ["Aetna", "Cigna"], languages: ["English", "Spanish"] }
Doctor   { name, profession, offices: ["<address>", ...],
           centers: [{ name, address }, ...], insurance: [...], languages: [...] }
Point    { lat: 32.7157, lng: -117.1611 }
points   { "<normalized address>": Point, ... }   // not-found addresses are simply absent
Filters  { profession: "Cardiology", maxMiles: 25 | null,
           insurance: "Aetna" | null, language: null }   // null or "" = Any
Result   { rank: 1, doctor, profession,
           office: { address, miles } | null,
           center: { name, address, miles } | null,
           otherCenters: [{ name, address, miles }], insurance, languages,
           note: "" | "No office listed" | "No surgery center listed"
                    | "Office address not found" | "Surgery center address not found" }   // D18
MapPin   { kind: "office" | "center" | "both", label: "1" | "1, 3", place: "Harbor Surgery Center (sample)",
           address, hover: "<place>\n1. Dr. Sample A · Cardiology", link: "<mapUrl>", point: Point,
           doctors: [{ rank, heading: "1. Dr. Sample A · Cardiology", lines: ["Office: … (2.7 mi)", ...] }] }
                    // never holds the patient's location; showResultsMap adds x, y
```
Map settings: `MAP_SIZE = {width: 640, height: 480}` (Google's free maximum is 640 wide), `MAP_MARGIN = 40`, `MAX_MAP_ZOOM = 15`.

## 5. Stored data
Full columns are in data.md. In short:

| Tab | Read by | Written by | Notes |
|---|---|---|---|
| Doctors | P-3 → `readDoctorRows` | **nobody** (R7) | Columns found by header text |
| Locations | P-3 → builds `points` | P-4 after each lookup | Cache keyed by normalized address. `NOT FOUND` rows aren't retried |
| Results | staff | P-4 from `buildResultsTable` | Cleared each search. No patient address |

## 6. Errors
- **Logic.js:** throws `Error("<plain-English message>")`, or returns `warnings` for problems that shouldn't stop a search.
- **Code.js:** catches errors at each entry point and shows the message through P-7 (menu items) or returns `{error}` (sidebar calls). It never shows a raw stack trace to staff.
- The messages themselves live in spec §7. Use that wording.

## 7. Rules for every platform (now and Excel)
R5 (report duplicates, never delete or skip), R7 (never write Doctors, never store the patient's address), R8 (plain messages) and the data.md layout are **platform rules, not Google rules.** Any new platform layer must keep them.

---

## 8. Adding Excel (future step, not started)
**Today Excel is supported by import:** staff import the .xlsx into the Google Sheet (D1, setup.md F). This section is about running Doctor Finder **inside Excel itself.**

### What carries over unchanged
- `Logic.js` and its tests: the same file, no edits.
- The data layout: the same 3 tabs and the same headers. Excel's `range.values` is also a 2D array, the same shape as P-3.
- The Results table, including the `HYPERLINK` formulas.
- The form layout in `Sidebar.html`. Only its few `google.script.run` calls change, so keep them together near the bottom of that file.

### What must be rebuilt: the platform layer (§3, P-1 to P-9)
| # | Excel option (verify against Microsoft's docs at that step) |
|---|---|
| P-1, P-2 | A button that opens a **task pane** (an Office Add-in; the panel is an HTML page) |
| P-3, P-4, P-5 | Office.js: `Excel.run(...)`, `range.values`, `worksheets.add()` |
| **P-6** | **No built-in geocoder in Excel. This is the hardest part.** Options below |
| P-7 | A message in the task pane, or the Office dialog API |
| P-8 | No 6-minute cutoff, but the geocoder's rate limit sets the pace instead |
| P-9 | `new Date()`, the same as now |
| P-10 | No built-in map picture in Excel. Use one of the map upgrades in §9 (both work in a task pane). `buildMapPins` carries over |

### Ways to run inside Excel
| Option | Reuses Logic.js? | Install for staff | Address lookup | Notes |
|---|---|---|---|---|
| **A. Office Add-in (task pane)**: PROPOSED | **Yes**, the same file | Harder: files hosted on HTTPS (e.g. GitHub Pages), plus a manifest that's sideloaded or deployed by an M365 admin | Outside service (below) | The closest match to the Sheets version |
| B. Office Scripts | Partly (TypeScript; copy and adjust) | Needs a business or education M365 license (personal plans: preview only) | `fetch`, but only to services that allow CORS `*` | No side panel. Input goes in cells |
| C. VBA macro workbook (.xlsm) | **No**, it's a rewrite in VBA (two copies of the logic to keep in sync) | Open the file. Macro security warnings and blocks on downloaded files | Web call from VBA | Desktop Excel only, not Excel on the web |
| D. Keep importing into Sheets | n/a | Nothing new | Google's | What we have today. Zero work |

### Address lookup options for Excel (P-6)
| Service | Key? | Limits / catches |
|---|---|---|
| US Census Geocoder | No | Free, US addresses only. **No CORS**, so a browser task pane must use its JSONP mode. Reported to have downtime |
| OpenStreetMap Nominatim | No | About 1 request/second and a usage policy to follow (attribution, no bulk use). Check the current policy |
| Paid services (Azure Maps, Google Geocoding API, etc.) | **Yes** | Breaks D10 (no keys, no billing) unless the owner agrees |

The Locations cache carries over, so each address is still looked up only once per workbook.

### Decide before starting the Excel step
1. Which Excel do staff use: desktop (Windows/Mac), Excel on the web, or both?
2. Which Microsoft 365 plan: business/education or personal/family? That decides whether Office Scripts or admin deployment is possible.
3. Is it OK to host the add-in files on a free HTTPS host (e.g. GitHub Pages)? Who installs the add-in?
4. Which geocoder? A free one with limits, or a paid one with a key (that would reopen D10)?
5. Is the Sheets version kept alongside Excel, or replaced?

### Rough plan if Option A is chosen (log the choice in decisions.md first)
1. New folder `excel-addin/` (needs owner OK, CLAUDE.md rule 9): `manifest.xml`, `taskpane.html` (adapted from Sidebar.html), `Excel.js` (P-1 to P-9). The task pane loads `apps-script/Logic.js` as-is.
2. Build P-6 with the chosen geocoder, keeping the same `points` shape.
3. Hand-test the same flows as progress.md step 7, in Excel.
4. Add an "Excel" part to setup.md (install the add-in, then use it).
5. Rules check: Office.js comes from Microsoft's own CDN. Log that as an exception to rule 4 in decisions.md.

---

## 9. Map upgrades (future, not started)
Today's map (D26) is a Google map **picture**, so it can't be dragged or zoomed. Two upgrades were weighed with the owner and kept for later. Both reuse `buildMapPins`, the sidebar's **Show on map** button and the details panel in `Map.html`; only the map under the pins changes, and `fitMap` / `pinPosition` are no longer needed.

| | Option 2: Google Maps JavaScript API | Option 3: Leaflet + OpenStreetMap |
|---|---|---|
| What staff get | A real Google map that drags and zooms, with clickable pins | A drag-and-zoom map with clickable pins, drawn by OpenStreetMap (not Google) |
| Cost / setup | A Google Cloud project with billing turned on (a card on file). The free cap was 10,000 map loads a month when checked on 2026-11-22. An API key restricted to `*.googleusercontent.com`, kept in Script Properties, never in git | None |
| Rules it changes | Reopens D10 (no keys). Exception to rule 4 for Google's map loader | Exception to rule 4 (a library from cdnjs). Must show "© OpenStreetMap contributors" |
| Risks | Billing set up by a non-technical owner | OpenStreetMap's tile policy: no SLA, "may block access, without notice" |

**Decide before starting:**
1. Do staff need drag and zoom enough to justify the change?
2. For Option 2: who owns the Cloud billing account?
3. For Option 3: is a non-Google map acceptable?

Log the choice in decisions.md and update R10.
