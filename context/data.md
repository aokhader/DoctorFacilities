# Data — tabs, columns, rules

The tool uses three tabs in one Google Sheet. It **only reads** Doctors. It owns Locations and Results and creates them if they're missing.

| Tab | Who edits it | What it holds |
|---|---|---|
| `Doctors` (PROPOSED name) | Staff (or an Excel import) | The doctor list. One row per doctor + surgery center |
| `Locations` | The tool | Saved map coordinates for every address it has looked up |
| `Results` | The tool | The latest search. Cleared at the start of each search |

## Doctors tab (read only — R7)
Row 1 holds the headers. Columns are found **by header text** (trimmed, case-insensitive), so order doesn't matter and extra columns are ignored. The header names live in one block (`COLUMN_NAMES`) at the top of `Logic.js`, so renaming a header means changing only that line. It's in Logic.js so a future Excel version uses the same names (D15).

| Header (PROPOSED — owner to confirm real names) | Needed? | Example (made up) | Notes |
|---|---|---|---|
| `Doctor Name` | Yes | Dr. Sample A | Rows with a blank name are skipped and listed in the warnings |
| `Profession` | Yes | Cardiology | Fills the Profession dropdown |
| `Office Address` | No | 330 Park Blvd, San Diego, CA 92101 | Full street address. Blank is allowed |
| `Facility Name` | No | Harbor Surgery Center (sample) | The surgery center's name |
| `Facility Address` | No | 202 C St, San Diego, CA 92101 | Full street address. Blank is allowed |
| `Insurance` | No | Aetna, Cigna | A list. Commas or semicolons both work |
| `Languages` | No | English; Spanish | A list. Commas or semicolons both work |

### Example rows (made-up names at public buildings, not real offices)
| Row | Doctor Name | Profession | Office Address | Facility Name | Facility Address | Insurance | Languages |
|---|---|---|---|---|---|---|---|
| 2 | Dr. Sample A | Cardiology | 330 Park Blvd, San Diego, CA 92101 | Harbor Surgery Center (sample) | 202 C St, San Diego, CA 92101 | Aetna, Cigna | English, Spanish |
| 3 | Dr. Sample A | Cardiology | 7555 Draper Ave, La Jolla, CA 92037 | Coast Surgery Center (sample) | 7555 Draper Ave, La Jolla, CA 92037 | Aetna | English |
| 4 | Dr. Sample B | Neurosurgery | | South Bay Surgery Center (sample) | 365 F St, Chula Vista, CA 91910 | Cigna | English |
| 5 | dr. sample a | cardiology | 330 Park Blvd, San Diego, CA 92101 | harbor surgery center (sample) | 202 C St, San Diego, CA 92101 | Aetna | English |

What the tool makes of these rows:
- **Dr. Sample A (Cardiology)** = rows 2, 3 and 5 (same name + profession after normalizing).
  - Offices: 330 Park Blvd and 7555 Draper Ave.
  - Centers: Harbor and Coast.
  - Insurance: Aetna, Cigna. Languages: English, Spanish.
- **Dr. Sample B (Neurosurgery)** = row 4. No office, so it's ranked by its center only, with the note "No office listed."
- **Rows 2 and 5 are possible duplicates** (same name + profession + facility name). Both rows stay in the sheet and both are used. The tool just reports "Rows 2 and 5" (R5).

## Matching rules
| Rule | How |
|---|---|
| Normalize (for matching only) | Trim, collapse repeated spaces, lowercase. Never written back |
| Same doctor | Normalized `Doctor Name` + `Profession` (PROPOSED) |
| Possible duplicate | Normalized `Doctor Name` + `Profession` + `Facility Name` (D8) |
| Same address | Normalized address text, which is also the Locations key |
| List cells (Insurance, Languages) | Split on `,` or `;`, trim, drop blanks. Dropdowns show each value once, spelled as it first appears |
| Not caught | "Dr. Jane Doe" vs "Jane Doe, MD", or "St" vs "Street". Exact text only (PROPOSED) |

## Locations tab (owned by the tool — R6)
| Column | Example | Notes |
|---|---|---|
| `Address` | 330 Park Blvd, San Diego, CA 92101 | Exactly as typed on the Doctors tab |
| `Latitude` | 32.70… | Blank when not found |
| `Longitude` | -117.15… | Blank when not found |
| `Google matched as` | 330 Park Blvd, San Diego, CA 92101, USA | What Google thinks the address is, or `NOT FOUND`. Lets staff spot a wrong match |
| `Looked up on` | 2026-11-21 | `yyyy-mm-dd` |

- Each address is looked up only once. Later searches read the saved coordinates.
- `NOT FOUND` rows aren't retried, which saves the daily limit. To retry one, fix the address on the Doctors tab, or delete that row here.
- If Google matched an address to the wrong place, delete that row, fix the address on the Doctors tab, and search again.
- **The patient's address is never written here.**

## Results tab (owned by the tool — R1–R4, R7)
- **Row 1:** what was searched, **without the patient's address** (PROPOSED). Example: `Cardiology · within 25 mi · Insurance: Any · Language: Spanish · searched 2026-11-21 3:42 PM`
- **Row 2:** headers (bold, frozen).
- **Rows 3 and down:** one row per doctor, best first.

| Column | Example (illustrative numbers) | Notes |
|---|---|---|
| `Rank` | 1 | 1 = best (the smallest farther-of-the-two distance) |
| `Doctor` | Dr. Sample A | |
| `Profession` | Cardiology | |
| `Nearest office` | 330 Park Blvd, San Diego, CA 92101 | A link that opens Google Maps. Shows "No office listed" when there isn't one |
| `Office (mi)` | 2.4 | Straight-line miles, 1 decimal place |
| `Nearest surgery center` | Harbor Surgery Center (sample) — 202 C St, San Diego… | A link that opens Google Maps |
| `Center (mi)` | 2.1 | |
| `Other centers within limit` | Coast Surgery Center (sample) (11.8 mi) | Separated by `;`. With no limit: all of the doctor's other centers |
| `Insurance` | Aetna, Cigna | |
| `Languages` | English, Spanish | |

- Links use `=HYPERLINK("https://www.google.com/maps/search/?api=1&query=<address>", "<address>")`. That's the destination only, so no patient data goes into the link.
- With a max distance: every doctor whose office **and** center are both within it. With no limit: the top 20 (PROPOSED).
- The tab is overwritten on every search. To keep a result, copy it to another tab or print it.

## sample/doctors-sample.csv (made during the build)
The same headers as the Doctors tab, about 12 rows, built to exercise every rule:
- 3 professions (e.g. Cardiology, Neurosurgery, Orthopedics)
- one doctor with 2 offices and 3 centers
- one doctor with no office
- one pair of duplicate rows that differ only in case and spacing
- one address that can't be found (e.g. `123 Nowhere Rd, Nowhere, CA 00000`)
- insurance and language cells using both `,` and `;`

Names are clearly fake ("Dr. Sample A"). Addresses are public San Diego-area buildings (libraries, civic centers), so the lookups work. They're **not** real medical facilities.
