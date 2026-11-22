/**
 * @OnlyCurrentDoc
 */
// Doctor Finder: the Google parts (menu, popups, reading tabs).
// The rules (columns, duplicates, miles, ranking) live in Logic.gs.
// The line above limits Google's permission screen to this one spreadsheet.

const DOCTORS_TAB = 'Doctors';

// ---------- Menu ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Doctor Finder')
    .addItem('Check for duplicates', 'showDuplicates')
    .addToUi();
}

function showDuplicates() {
  showPopup(() => describeDuplicates(findDuplicates(readDoctors().rows)));
}

// ---------- Reading tabs ----------

function readDoctors() {
  const tab = SpreadsheetApp.getActive().getSheetByName(DOCTORS_TAB);
  if (!tab) {
    throw new Error("Couldn't find a tab named '" + DOCTORS_TAB + "'. Rename the tab with the doctor list to " +
      DOCTORS_TAB + '.');
  }
  return readDoctorRows(tab.getDataRange().getValues());
}

// ---------- Messages ----------

function showPopup(work) {
  let text;
  try {
    text = work();
  } catch (error) {
    text = messageFor(error);
  }
  const ui = SpreadsheetApp.getUi();
  ui.alert('Doctor Finder', text, ui.ButtonSet.OK);
}

// Messages we wrote already say what to do next. Anything else (a bug, a Google outage) gets a next step added.
function messageFor(error) {
  const ours = error instanceof Error && error.name === 'Error' && !/^Exception/.test(error.message);
  if (ours) return error.message;
  return 'Something went wrong (' + (error && error.message ? error.message : error) + '). ' +
    'Reload the sheet and try again. If it keeps happening, send a screenshot of this to whoever set up Doctor Finder.';
}
