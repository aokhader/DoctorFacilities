# Doctor Finder

A "Doctor Finder" menu inside a Google Sheet. Office staff type a patient's ZIP or address, pick a profession, and get a ranked list of doctors whose office **and** contracted surgery center are both nearby. The users aren't comfortable with technology, so **simple to use and simple to read beats clever, every time.**

Status: spec approved, code not started. See `context/progress.md`.

## Hard rules
1. **Never write to the Doctors tab.** The tool writes only to its own Locations and Results tabs. (R7)
2. **Never delete, hide or skip duplicate rows.** Report them with row numbers. (R5, D8)
3. **Never store the patient's address**: not on a tab, in a log, or in a link. Map links are destination only. (R7, D12)
4. **No libraries, API keys, build step or clasp.** Plain Apps Script + one HTML file, installed by copy and paste. (D10, D13)
5. **Keep Google calls out of `Logic.js`**, so `node --test` can run it. Google-only code lives in `Code.js`. (D14)
6. **Write for a non-technical reader:**
   - plain-English names and short functions
   - a one-line comment only for a *why*
   - every error message says what to do next (R8)
7. **Check the Apps Script docs** (developers.google.com/apps-script) before writing any Google call. Don't guess method names or limits.
8. **Never commit the real doctor list.** Only `sample/doctors-sample.csv` (made-up names) goes in git.
9. **Ask first** before adding a file not listed in spec §6, adding a dependency, changing a PROPOSED item, or running destructive git commands.

## Where things are
| File | Read it when |
|---|---|
| `context/progress.md` | **Every session start.** What's done, what's next |
| `context/spec.md` | Before building any step: requirements R1–R9, flows, logic, files, failure messages |
| `context/architecture.md` | Before writing code: layers, what goes in Code.js vs Logic.js, function list, data shapes. Also the plan for Excel support |
| `context/data.md` | When touching columns, tabs, matching rules, or the sample CSV |
| `context/setup.md` | When changing anything staff see (menus, sidebar, messages) or how it's installed |
| `context/decisions.md` | Before changing behavior. Log any new decision here |

Code (once built): `apps-script/Code.js`, `apps-script/Logic.js`, `apps-script/Sidebar.html`, `tests/logic.test.js`, `sample/doctors-sample.csv`.

## Every session
**Start**
1. Read this file and `context/progress.md`.
2. Name the one build step you're doing.
3. Read the spec sections it lists.

**Work**
- Build the smallest version that meets the step's "Done when."
- Run `node --test tests/` and show the output.
- Steps 3–7 touch Google and can't run here. Say exactly what the owner should click to check them.

**End**
1. Update the step's row, the requirements table, Now / Next / Blocked and the session log in `progress.md`.
2. Add any decision to `decisions.md`.
3. Commit only if the owner asks. Use `[step N] verb: what`.

## Commands
```bash
node --test tests/
```
