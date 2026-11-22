/**
 * @OnlyCurrentDoc
 */
// Doctor Finder: the Google parts (menu, popups, tabs, address lookup).
// The rules (columns, duplicates, miles, ranking) live in Logic.gs.
// The line above limits Google's permission screen to this one spreadsheet.

const DOCTORS_TAB = 'Doctors';
const LOCATIONS_TAB = 'Locations';
// Google stops every run at 6 minutes, so lookups stop at 5 and ask to be run again.
const STOP_LOOKUPS_AFTER_MS = 5 * 60 * 1000;
const SLOW_DOWN_MESSAGE = 'Google asked Doctor Finder to slow down. Wait a minute and try again.';

// ---------- Menu ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Doctor Finder')
    .addItem('Check for duplicates', 'showDuplicates')
    .addItem('Look up all addresses', 'lookUpAllAddresses')
    .addToUi();
}

function showDuplicates() {
  showPopup(() => describeDuplicates(findDuplicates(readDoctors().rows)));
}

function lookUpAllAddresses() {
  showPopup(() => {
    const addresses = listAddresses(readDoctors().rows);
    const newCount = lookUpNewAddresses(addresses, Date.now() + STOP_LOOKUPS_AFTER_MS);
    const plan = planLookups(addresses, readTab(LOCATIONS_TAB));
    if (plan.toLookUp.length > 0) {
      return 'Looked up ' + (addresses.length - plan.toLookUp.length) + ' of ' + addresses.length +
        '. Run Look up all addresses again to finish.';
    }
    return ['All ' + addresses.length + ' addresses are looked up (' + newCount + ' new this time).',
      describeNotFound(plan.notFound)].filter(text => text !== '').join('\n\n');
  });
}

// ---------- Address lookup ----------

// Looks up addresses that aren't on the Locations tab yet, saving each one straight away
// so nothing is lost if Google stops the run. Returns how many it looked up.
function lookUpNewAddresses(addresses, stopAt) {
  const tab = openLocationsTab();
  const toLookUp = planLookups(addresses, tab.getDataRange().getValues()).toLookUp;
  const today = formatNow('yyyy-MM-dd');
  let count = 0;
  for (const address of toLookUp) {
    tab.appendRow(locationRow(address, findPlace(address), today));
    count++;
    if (Date.now() > stopAt) break; // checked after each lookup, so every run makes progress
  }
  return count;
}

// Returns { lat, lng, matchedAs }, or null if Google couldn't place the address.
function findPlace(address) {
  let response;
  try {
    response = Maps.newGeocoder().setRegion('us').geocode(address);
  } catch (error) {
    if (/short time/i.test(error.message)) throw new Error(SLOW_DOWN_MESSAGE);
    if (/too many times/i.test(error.message)) throw new Error(DAILY_LIMIT_MESSAGE);
    throw error;
  }
  return readGeocoderAnswer(response);
}

// ---------- Reading and writing tabs ----------

function readDoctors() {
  const tab = SpreadsheetApp.getActive().getSheetByName(DOCTORS_TAB);
  if (!tab) {
    throw new Error("Couldn't find a tab named '" + DOCTORS_TAB + "'. Rename the tab with the doctor list to " +
      DOCTORS_TAB + '.');
  }
  return readDoctorRows(tab.getDataRange().getValues());
}

// A tab's cells, or no rows if the tab isn't there yet.
function readTab(name) {
  const tab = SpreadsheetApp.getActive().getSheetByName(name);
  return tab ? tab.getDataRange().getValues() : [];
}

function getOrCreateTab(name) {
  const spreadsheet = SpreadsheetApp.getActive();
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

// Also puts the headers back if someone emptied the tab.
function openLocationsTab() {
  const tab = getOrCreateTab(LOCATIONS_TAB);
  if (tab.getLastRow() === 0) {
    tab.appendRow(LOCATION_HEADERS);
    tab.getRange(1, 1, 1, LOCATION_HEADERS.length).setFontWeight('bold');
    tab.setFrozenRows(1);
  }
  return tab;
}

// Today's date or time as text, in the spreadsheet's own time zone.
function formatNow(pattern) {
  return Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), pattern);
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
