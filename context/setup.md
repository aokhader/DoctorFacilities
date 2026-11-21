# Setup guide (R9)

Part 1 is for office staff. Part 2 is for whoever maintains the code.

> Note for the builder: Google renames menus now and then. Every menu name below was written 2026-11-21. Re-check each one during the walkthrough (progress.md step 7) and fix this file to match.

---

# Part 1 — Office staff

You do steps A–D **once**. After that you only use step E (and F when the list changes).

## A. Put the doctor list into Google Sheets (once)
If your list is already in Google Sheets, skip to step 5.
1. Go to **sheets.google.com** and click **Blank spreadsheet**.
2. Click **File → Import → Upload**, then pick your Excel file.
3. Under "Import location," choose **Replace spreadsheet**, then click **Import data**.
4. At the top left, click "Untitled spreadsheet" and type a name, e.g. **Doctor List**.
5. At the bottom, double-click the tab name and rename it to **Doctors**.
6. Check that row 1 has these headers (spelled the same; capital letters don't matter):
   `Doctor Name` · `Profession` · `Office Address` · `Facility Name` · `Facility Address` · `Insurance` · `Languages`

## B. Add Doctor Finder to the sheet (once)
You'll copy 3 files from this project's `apps-script` folder into Google.
1. In the sheet, click **Extensions → Apps Script**. A new browser tab opens.
2. At the top left, click **Untitled project**, type **Doctor Finder**, and click **Rename**.
3. **File 1:** on the left, click **Code.gs**. Click inside the big text area, press **Ctrl+A**, then **Delete**. Open `apps-script/Code.js`, copy everything, and paste it in.
4. **File 2:** next to **Files**, click **+** → **Script**. Type **Logic** and press Enter. Clear the text area the same way, then paste everything from `apps-script/Logic.js`.
5. **File 3:** click **+** → **HTML**. Type **Sidebar** and press Enter. Clear it, then paste everything from `apps-script/Sidebar.html`.
6. Click the **Save** icon (or press **Ctrl+S**).
7. Go back to your spreadsheet tab and reload the page (**F5**). After a few seconds a **Doctor Finder** menu appears at the top, next to **Help**.

## C. Give permission (once per person)
The first time you use the menu, Google asks whether this sheet's script may run.
1. Click **Doctor Finder → Look up all addresses**.
2. A box says **Authorization required**. Click **Continue** (or **Review permissions**).
3. Choose your Google account.
4. If you see **"Google hasn't verified this app,"** click **Advanced**, then **Go to Doctor Finder (unsafe)**.
   - *Why this is OK:* Google shows this warning for any script someone writes for their own sheet without sending it to Google for review. The script is only the 3 files you pasted in step B, and it works only inside this spreadsheet.
5. Click **Allow**.

Everyone who uses Doctor Finder needs **edit access** to the sheet and does step C once on their own account.

## D. Look up all addresses (once, then automatic)
1. Click **Doctor Finder → Look up all addresses** (again, if step C interrupted it).
2. Wait. It takes about 1 second per address. When it finishes, a message says how many it found.
3. If it says **"Run Look up all addresses again to finish,"** do that. Google stops scripts after a few minutes, but nothing is lost.
4. A new **Locations** tab appears. Leave it alone. It's the tool's memory of where each address is.

## E. Find doctors for a patient (every time)
1. Click **Doctor Finder → Find doctors…**. A panel opens on the right.
2. Type the patient's **ZIP code or address**. A ZIP is enough. **Don't type the patient's name.**
3. Pick the **Profession**.
4. Optional:
   - change **Max miles** (blank = any distance)
   - pick an **Insurance**
   - pick a **Language**
5. Click **Find doctors**.
6. The **Results** tab shows the best matches first. Click any address to open it in Google Maps for directions.
7. The Results tab is replaced on every search. To keep a result, copy it to another tab or print it.

## F. Update the list from Excel
1. Click the **Doctors** tab at the bottom.
2. Click **File → Import → Upload** and pick the new Excel file.
3. Under "Import location," choose **Replace current sheet**. *Not* "Replace spreadsheet", which would erase the Locations tab.
4. Click **Import data**. Check that the tab is still named **Doctors** and row 1 still has the same headers.
5. That's it. New or changed addresses are looked up on the next search.

## Checking for duplicates
Click **Doctor Finder → Check for duplicates**. A box lists rows that have the same doctor name + profession + facility, e.g. "Rows 12 and 45." **Nothing is deleted.** Fix them yourself if you want to.

## If something goes wrong
| You see | What to do |
|---|---|
| No **Doctor Finder** menu | Reload the sheet (F5) and wait 10 seconds. Still missing? Redo step B6 (Save) |
| "Couldn't find the column '…'" | Row 1 of the Doctors tab is missing that header, or it's spelled differently. Fix the header |
| "Couldn't find that location" | Try just the 5-digit ZIP code |
| Addresses listed as not found | Fix the typo on the Doctors tab, then search again |
| An address is pinned to the wrong place | On the Locations tab, delete that address's row, fix the address on the Doctors tab, and search again |
| "Daily lookup limit was reached" | Wait until tomorrow. Addresses already looked up keep working |
| "No doctors matched" | Make Max miles bigger, or set Insurance/Language to Any |
| "Authorization required" again | Someone changed the code. Repeat step C |

---

# Part 2 — Maintainer

## Where each file goes
| In this project | In the Apps Script editor | What it is |
|---|---|---|
| `apps-script/Code.js` | `Code.gs` | Menu, sidebar, reading Doctors, address lookup + Locations, writing Results |
| `apps-script/Logic.js` | `Logic.gs` | Plain functions: matching, duplicates, distance, ranking |
| `apps-script/Sidebar.html` | `Sidebar.html` | The search panel |

Updating the code: paste the changed file over its copy in the editor, Save, then reload the sheet. Staff may need to repeat step C if the permissions changed.

## Running the tests
- You need Node.js 18 or newer (only the maintainer; staff never need it).
- From the project folder run:

```bash
node --test tests/
```

- The tests cover `Logic.js` only. Anything that touches Google (menus, lookups, tabs) is checked by hand with the sample sheet:
  1. Import `sample/doctors-sample.csv` into a new test sheet and name the tab **Doctors**.
  2. Do steps B–F above.
  3. Tick off each flow in progress.md step 7.

## Limits to know
- Address lookups: about 1,000 per day per person on a personal Gmail account, 10,000 on Google Workspace. Each address is looked up once ever, so this only matters the first time.
- Each script run is cut off after about 6 minutes, which is why "Look up all addresses" stops at about 5 minutes and asks to be run again. Confirm the current limit on Google's Apps Script quotas page during the build.
