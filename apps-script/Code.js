/**
 * @OnlyCurrentDoc
 */
// Doctor Finder: the Google parts (menu, search panel, popups, map, tabs, address lookup).
// The rules (columns, duplicates, miles, ranking) live in Logic.gs.
// The line above limits Google's permission screen to this one spreadsheet.

const DOCTORS_TAB = 'Doctors';
const LOCATIONS_TAB = 'Locations';
const RESULTS_TAB = 'Results';
// Google stops every run at 6 minutes, so lookups stop at 5 and ask to be run again.
const STOP_LOOKUPS_AFTER_MS = 5 * 60 * 1000;
const SLOW_DOWN_MESSAGE = 'Google asked Doctor Finder to slow down. Wait a minute and try again.';
const PATIENT_NOT_FOUND_MESSAGE = "Couldn't find that location. Try just the ZIP code.";
const MAP_LIMIT_MESSAGE = "Google's daily map limit was reached. The Results tab still works — try the map again tomorrow.";

// ---------- Menu ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Doctor Finder')
    .addItem('Find doctors…', 'showSearchPanel')
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

// ---------- Search panel ----------

function showSearchPanel() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Doctor Finder'));
}

// The sidebar calls this when it opens, to fill its dropdowns.
function getSearchChoices() {
  return answerSidebar(() => Object.assign(listChoices(readDoctors().rows), { defaultMaxMiles: DEFAULT_MAX_MILES }));
}

// The sidebar's Find doctors button calls this. The patient's location is used here and never saved (R7).
function searchDoctors(form) {
  return answerSidebar(() => {
    const search = readSearchForm(form);
    const doctors = readDoctors();
    const patientPoint = findPlace(search.location);
    if (!patientPoint) throw new Error(PATIENT_NOT_FOUND_MESSAGE);
    const addresses = listAddresses(doctors.rows);
    lookUpNewAddresses(addresses, Date.now() + STOP_LOOKUPS_AFTER_MS);
    const plan = planLookups(addresses, readTab(LOCATIONS_TAB));
    const results = rankDoctors(groupDoctors(doctors.rows), patientPoint, plan.points, search.filters);
    writeResults(buildResultsTable(results, search.filters, formatNow('yyyy-MM-dd h:mm a')));
    const answer = summarizeSearch({
      foundCount: results.length,
      rowWarnings: doctors.warnings,
      duplicateCount: findDuplicates(doctors.rows).length,
      notFound: plan.notFound,
      notLookedUpCount: plan.toLookUp.length,
    });
    // For the Show on map button. The patient's point goes only to the open sidebar, without Google's
    // matched address text, and is never saved (D27).
    if (results.length > 0) {
      answer.map = { patient: { lat: patientPoint.lat, lng: patientPoint.lng }, pins: buildMapPins(results, plan.points) };
    }
    return answer;
  });
}

// The sidebar's Show on map button calls this with the map from the last search.
function showResultsMap(map) {
  return answerSidebar(() => {
    const view = fitMap(map.pins.map(pin => pin.point).concat(map.patient), MAP_SIZE);
    const page = HtmlService.createTemplateFromFile('Map');
    // Force-printed into Map.html's script, so "<" is escaped: no doctor name can end the script early.
    page.mapJson = JSON.stringify({
      image: drawMap(view, map.pins.map(pin => pin.point).concat(map.patient)),
      width: MAP_SIZE.width,
      height: MAP_SIZE.height,
      patient: pinPosition(map.patient, view, MAP_SIZE),
      pins: map.pins.map(pin => Object.assign({}, pin, pinPosition(pin.point, view, MAP_SIZE))),
    }).replace(/</g, '\\u003c');
    // Room for the details panel beside the map, and the key below it.
    SpreadsheetApp.getUi().showModalDialog(
      page.evaluate().setWidth(MAP_SIZE.width + 380).setHeight(MAP_SIZE.height + 90), 'Doctors on the map');
    return {};
  });
}

// A Google map picture of this view, as text the popup can show.
// A tiny Google marker sits under each of our pins: if our pin math were off, it would peek out.
function drawMap(view, pointList) {
  const map = Maps.newStaticMap().setSize(MAP_SIZE.width, MAP_SIZE.height)
    .setCenter(view.center.lat, view.center.lng).setZoom(view.zoom)
    .setMarkerStyle(Maps.StaticMap.MarkerSize.TINY, Maps.StaticMap.Color.RED, 'X'); // tiny markers hide their label
  pointList.forEach(point => map.addMarker(point.lat, point.lng));
  let picture;
  try {
    picture = map.getBlob();
  } catch (error) {
    throw plainLimitError(error, MAP_LIMIT_MESSAGE);
  }
  return 'data:' + picture.getContentType() + ';base64,' + Utilities.base64Encode(picture.getBytes());
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
    throw plainLimitError(error, DAILY_LIMIT_MESSAGE);
  }
  return readGeocoderAnswer(response);
}

// Google's "Service invoked too many times…" errors, as our plain messages. Other errors pass through.
function plainLimitError(error, dailyLimitMessage) {
  if (/short time/i.test(error.message)) return new Error(SLOW_DOWN_MESSAGE);
  if (/too many times/i.test(error.message)) return new Error(dailyLimitMessage);
  return error;
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

// Replaces the Results tab with the new table and switches to it.
function writeResults(table) {
  const tab = getOrCreateTab(RESULTS_TAB);
  const width = table[0].length;
  tab.clear();
  tab.getRange(1, 1, table.length, width).setValues(table);
  tab.getRange(2, 1, 1, width).setFontWeight('bold');
  tab.setFrozenRows(2);
  tab.autoResizeColumns(2, width - 1); // not column A: its row 1 holds the long search line
  tab.activate();
}

// Today's date or time as text, in the spreadsheet's own time zone.
// Some spreadsheets have no time zone set, so the script's time zone is the backup.
function formatNow(pattern) {
  const timeZone = SpreadsheetApp.getActive().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  return Utilities.formatDate(new Date(), timeZone, pattern);
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

// Sidebar calls return { error } instead of throwing, so the sidebar can show our message as written.
function answerSidebar(work) {
  try {
    return work();
  } catch (error) {
    return { error: messageFor(error) };
  }
}

// Messages we wrote already say what to do next. Anything else (a bug, a Google outage) gets a next step added.
function messageFor(error) {
  const ours = error instanceof Error && error.name === 'Error' && !/^Exception/.test(error.message);
  if (ours) return error.message;
  return 'Something went wrong (' + (error && error.message ? error.message : error) + '). ' +
    'Reload the sheet and try again. If it keeps happening, send a screenshot of this to whoever set up Doctor Finder.';
}
