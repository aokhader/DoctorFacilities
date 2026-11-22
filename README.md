# Doctor Finder

A **Doctor Finder** menu inside a Google Sheet. Type a patient's ZIP code or address, pick a profession, and get a list of doctors whose office **and** surgery center are both close to the patient, best match first.

It replaces clicking through pins on a Google Map by hand.

## What's on the menu
| Menu item | What it does |
|---|---|
| **Find doctors…** | Opens a search panel. The matches go to the **Results** tab. Click any address to open it in Google Maps |
| **Check for duplicates** | Lists rows with the same doctor, profession and surgery center, by row number. Nothing is deleted |
| **Look up all addresses** | Finds every address on the map once and saves it on the **Locations** tab, so searches stay fast |

How the list is ordered:
- Each doctor gets the farther of two distances: to their nearest office and to their nearest surgery center. Distances are straight-line miles.
- Doctors whose office was found come first.
- You can also filter by max miles, insurance and language.

## What it never does
- It never changes the **Doctors** tab. It only writes to its own Locations and Results tabs.
- It never deletes or hides duplicate rows. It only reports them.
- It never saves the patient's address: not on a tab, in a log, or in a map link.
- It needs no API keys, add-ons or installs. It's 3 files pasted into the sheet's Apps Script editor.

## Get started
- **Office staff:** follow [Part 1 of the setup guide](context/setup.md#part-1--office-staff).
- **To practise first:** import [`sample/doctors-sample.csv`](sample/doctors-sample.csv) into a new Google Sheet. It has made-up doctors at public San Diego buildings.
- **Whoever maintains the code:** see [Part 2 of the setup guide](context/setup.md#part-2--maintainer).

## Project files
| Path | What it is |
|---|---|
| `apps-script/Code.js` | The Google parts: the menu, search panel, address lookups, and the Locations and Results tabs |
| `apps-script/Logic.js` | The rules: matching, duplicates, distances and ranking. It has no Google calls, so it can be tested on its own |
| `apps-script/Sidebar.html` | The search panel |
| `tests/logic.test.js` | Tests for `Logic.js` |
| `sample/doctors-sample.csv` | A made-up doctor list for testing |
| `context/` | The spec, setup guide, decisions and progress |
| `CLAUDE.md` | Rules for Claude Code sessions |

The real doctor list stays in Google Sheets. Only the made-up sample goes in this repository.

## Running the tests
You need Node.js 18 or newer, with nothing else to install. From the project folder, run:

```bash
node --test
```

The tests cover `Logic.js` only. The Google parts are checked by hand on the sample sheet (setup guide, Part 2).

## Status
Build steps 1–6 are done and checked in Google Sheets. Next, the owner walks through the setup guide alone. See [progress](context/progress.md).
