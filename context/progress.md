# Progress

Rule: update this file at the end of every session. Change only the rows you worked on, plus **Now / Next / Blocked**.

**Where we are (2026-11-22):**
- Steps 1–2 are done.
- Steps 3–4 are built on branch `steps-3-6-sheets`: `Code.js` has the menu, Check for duplicates, and Look up all addresses with the Locations tab.
- 21 tests pass.
- A throwaway stand-in for Google (fake tabs, popups and geocoder, kept outside the repo) ran every step 3–4 "Done when" offline.
- Checkpoint A passed in real Google Sheets on 2026-11-22, after a time zone fix (D22). Nowhere was saved as NOT FOUND, so D20 holds.
- Steps 5–6 are done: `Sidebar.html`, Find doctors → Results tab, and every spec §7 message. Checkpoint B passed in real Google Sheets on 2026-11-22, after the owner's ranking change (D25).
- Steps 3–6 were merged to `main` (PR #2).
- Step 8 (map view, D26–D29) is done on branch `map-view`, not committed yet. Checkpoint C passed in Google on 2026-11-22. 27 tests pass, plus 21 stand-in checks.

## Now / Next / Blocked
- **Now:** the owner commits `map-view` and opens its pull request.
- **Next:** the step 7 walkthrough of setup.md Part 1, which now includes the map's "File 4".
- **Blocked:** nothing.

## Checkpoint C (step 8.3, owner, on the sample sheet)
1. In **Extensions → Apps Script**, paste the new `Code.js`, `Logic.js` and `Sidebar.html` over their copies.
2. Click **+ → HTML**, name it `Map`, and paste `apps-script/Map.html`.
3. Save, then delete the `MapTest` file from step 8.0.
4. Reload the sheet.
5. **Search A:** ZIP `92103`, Cardiology, 25 mi. Then click **Show on map**.
6. **Search B:** ZIP `92103`, Orthopedics, Max miles blank. Then click **Show on map**.

| # | Check |
|---|---|
| 1 | The map opens with no new permission screen and no key error |
| 2 | Search A: the patient star is near Hillcrest, Dr. C's office pin is in El Cajon (east), and Dr. E has only a center pin, in National City (south). No small red Google dot peeks out from under any pin |
| 3 | The pin numbers match Rank on the Results tab. Clicking a pin 1 shows the same miles as Results row 1 |
| 4 | Search B: Dr. H's Coronado office and center (the same address) are one half-blue, half-green pin, on Coronado. Dr. G's center is on the La Jolla coast |
| 5 | A pin's "Open in Google Maps" opens just that address; the patient's ZIP is not in the URL |
| 6 | A new search hides the button until results come back, and the new map matches the new Results |
| 7 | When no doctors match (Neurosurgery + Medicare), there's no map button |
| 8 | Privacy: **Edit → Find and replace** "92103" with "Search all sheets" finds nothing, and Apps Script → **Executions** shows no patient text |

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
| 8.0 | Map go/no-go test in Google (**owner**) | R10 | A map picture shows in a popup with no API key, the dots sit on Google's pins, and the link opens | done 2026-11-22 (owner: the map showed in Sheets as planned) |
| 8.1 | `Logic.js`: `mapUrl`, `buildMapPins`, `fitMap`, `pinPosition` + tests | R10 | `node --test` passes, including Google's documented Chicago pixel example | done 2026-11-22 (27 tests pass) |
| 8.2 | `Code.js` `showResultsMap`, "Show on map" in `Sidebar.html`, new `Map.html` | R7 R8 R10 | The stand-in shows that the patient's ZIP is on no tab and in no map data, and that names are escaped. The Map.html and sidebar previews work | done 2026-11-22 (21 stand-in checks pass; previews checked in the browser) |
| 8.3 | Google checkpoint C (**owner**) | R7 R10 | All 8 checks in the map plan pass on the sample sheet | done 2026-11-22 (owner: every check passed) |
| M | **Future:** interactive map (D26 Option 2: Google Maps JavaScript API with a key + billing; or Option 3: Leaflet + OpenStreetMap) | R10 | The owner picks one and logs it in decisions.md. It reuses `buildMapPins`, the sidebar button and the Map.html details panel; only the map underneath changes | not started |
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
| R10 | Show a search's results on a map: numbered pins for each doctor's nearest office and center, click for details, patient star in memory only (D26–D29) | 8 | done (step 8), checked in Google (checkpoint C) |

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
| 2026-11-22 | Map view planned (step 8, branch `map-view`). Checked against Google's docs: a google.com/maps link holds only one place, so the map is drawn in a popup instead. Owner chose the built-in map picture with clickable pins (D26), with an interactive Google map or OpenStreetMap kept as future upgrades. Pins, the patient star and the sidebar button are in D27–D29. The owner ran the step 8.0 test: the map picture shows in Sheets with no API key | Step 8.1 |
| 2026-11-22 | Steps 8.1–8.2:
- `Logic.js` gained `mapUrl`, `buildMapPins`, `fitMap` and `pinPosition`. 27 tests pass, including Google's Chicago example and the step 8.0 dot.
- `Code.js` gained `showResultsMap` and `drawMap`, and `searchDoctors` returns `map`. `plainLimitError` is now shared with `findPlace`.
- `Sidebar.html` has the Show on map button, and `Map.html` is new.
- The stand-in now fakes the map picture, template and dialog (21 checks). It checks that the ZIP is in no tab or answer, that names are escaped, the limit messages, and §7 word for word.
- Popup and sidebar previews were driven in the browser: pins, details, keyboard, Close, button show/hide, the map error.
- Docs: spec R10 / flow 6 / §7 / §8, architecture P-10 / §9 map upgrades, setup File 4 / E7, README | Owner runs checkpoint C |
| 2026-11-22 | Checkpoint C passed in Google: all 8 checks, including no key error, pins in the right places with no red dot showing, the half-blue, half-green Coronado pin, destination-only links, and the patient ZIP found on no tab. Step 8 done | Owner commits `map-view` + PR, then the step 7 walkthrough |
