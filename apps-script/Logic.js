// Doctor Finder: the plain rules (columns, duplicates, grouping, miles, ranking).
// No Google calls in this file, so `node --test` can check it on any computer.

// The header text on row 1 of the Doctors tab. Rename a header here only.
const COLUMN_NAMES = {
  doctorName: 'Doctor Name',
  profession: 'Profession',
  officeAddress: 'Office Address',
  facilityName: 'Facility Name',
  facilityAddress: 'Facility Address',
  insurance: 'Insurance',
  languages: 'Languages',
};

const DEFAULT_MAX_MILES = 25;
const TOP_N_WHEN_NO_LIMIT = 20;
const EARTH_RADIUS_MILES = 3958.8;

const RESULT_HEADERS = [
  'Rank', 'Doctor', 'Profession', 'Nearest office', 'Office (mi)',
  'Nearest surgery center', 'Center (mi)', 'Other centers within limit', 'Insurance', 'Languages',
];

const LOCATION_HEADERS = ['Address', 'Latitude', 'Longitude', 'Google matched as', 'Looked up on'];
const NOT_FOUND = 'NOT FOUND';

// ---------- Text ----------

function normalizeText(text) {
  return String(text == null ? '' : text).trim().replace(/\s+/g, ' ').toLowerCase();
}

function cleanText(cell) {
  return String(cell == null ? '' : cell).trim();
}

function splitList(cell) {
  return cleanText(cell).split(/[,;]/).map(item => item.trim()).filter(item => item !== '');
}

// Keeps the first item for each key, in the order they appear.
function uniqueBy(items, keyOf) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Each value once (ignoring case and spacing), spelled as it first appears. Blanks dropped.
function uniqueText(values) {
  return uniqueBy(values.filter(value => normalizeText(value) !== ''), normalizeText);
}

// Splits items into groups that share a key, keeping the order of first appearance.
function groupBy(items, keyOf) {
  const groups = new Map();
  items.forEach(item => {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return Array.from(groups.values());
}

function matchKey(texts) {
  return JSON.stringify(texts.map(normalizeText));
}

// ---------- Reading the Doctors tab ----------

function readDoctorRows(values) {
  const headers = (values[0] || []).map(normalizeText);
  const columnOf = {};
  Object.keys(COLUMN_NAMES).forEach(field => {
    const index = headers.indexOf(normalizeText(COLUMN_NAMES[field]));
    if (index === -1) {
      throw new Error("Couldn't find the column '" + COLUMN_NAMES[field] +
        "' on the Doctors tab. Check the header spelling.");
    }
    columnOf[field] = index;
  });

  const rows = [];
  const warnings = [];
  values.slice(1).forEach((cells, i) => {
    const rowNumber = i + 2; // row 1 is the header
    if (cells.every(cell => normalizeText(cell) === '')) return; // empty rows at the bottom of the tab

    const row = {
      rowNumber: rowNumber,
      doctorName: cleanText(cells[columnOf.doctorName]),
      profession: cleanText(cells[columnOf.profession]),
      officeAddress: cleanText(cells[columnOf.officeAddress]),
      facilityName: cleanText(cells[columnOf.facilityName]),
      facilityAddress: cleanText(cells[columnOf.facilityAddress]),
      insurance: splitList(cells[columnOf.insurance]),
      languages: splitList(cells[columnOf.languages]),
    };
    if (row.doctorName === '') {
      warnings.push('Row ' + rowNumber + " has no Doctor Name, so it's left out of searches.");
    } else if (row.profession === '') {
      warnings.push('Row ' + rowNumber + " has no Profession, so it's left out of searches.");
    } else {
      rows.push(row);
    }
  });
  return { rows: rows, warnings: warnings };
}

function findDuplicates(rows) {
  return groupBy(rows, row => matchKey([row.doctorName, row.profession, row.facilityName]))
    .filter(group => group.length > 1)
    .map(group => ({
      rowNumbers: group.map(row => row.rowNumber),
      doctorName: group[0].doctorName,
      profession: group[0].profession,
      facilityName: group[0].facilityName,
    }));
}

// "2 and 5", or "2, 3 and 6". A duplicate always has at least 2 rows.
function joinRowNumbers(rowNumbers) {
  return rowNumbers.slice(0, -1).join(', ') + ' and ' + rowNumbers[rowNumbers.length - 1];
}

// The text of the Check for duplicates popup.
function describeDuplicates(duplicates) {
  if (duplicates.length === 0) return 'No possible duplicates found.';
  return duplicates
    .map(duplicate => 'Rows ' + joinRowNumbers(duplicate.rowNumbers) + ': ' +
      [duplicate.doctorName, duplicate.profession, duplicate.facilityName].filter(text => text !== '').join(' · '))
    .concat('', 'Nothing was changed. Fix these on the Doctors tab if you want to.')
    .join('\n');
}

function groupDoctors(rows) {
  return groupBy(rows, row => matchKey([row.doctorName, row.profession])).map(group => ({
    name: group[0].doctorName,
    profession: group[0].profession,
    offices: uniqueText(group.map(row => row.officeAddress)),
    centers: uniqueBy(
      group
        .filter(row => row.facilityName !== '' || row.facilityAddress !== '')
        .map(row => ({ name: row.facilityName, address: row.facilityAddress })),
      center => matchKey([center.name, center.address])),
    insurance: uniqueText(group.flatMap(row => row.insurance)),
    languages: uniqueText(group.flatMap(row => row.languages)),
  }));
}

function listAddresses(rows) {
  return uniqueText(rows.flatMap(row => [row.officeAddress, row.facilityAddress]));
}

function sortAtoZ(values) {
  return values.slice().sort((a, b) => a.localeCompare(b));
}

// The choices for the sidebar dropdowns, A to Z.
function listChoices(rows) {
  return {
    professions: sortAtoZ(uniqueText(rows.map(row => row.profession))),
    insurances: sortAtoZ(uniqueText(rows.flatMap(row => row.insurance))),
    languages: sortAtoZ(uniqueText(rows.flatMap(row => row.languages))),
  };
}

// ---------- The Locations tab (saved address lookups) ----------

const DAILY_LIMIT_MESSAGE = "Google's daily address lookup limit was reached. Try again tomorrow — " +
  'addresses already looked up still work.';
const LOOKUP_PROBLEM_MESSAGE = "Google's address lookup had a problem. Try again in a few minutes.";
// Google's place types for a match that is only a whole state or country: too vague to measure miles from (D20).
const TOO_VAGUE_TYPES = ['administrative_area_level_1', 'country'];

// Sorts the doctors' addresses into saved points, ones Google couldn't find, and ones still to look up.
// If an address is on the Locations tab twice, the later row wins.
function planLookups(addresses, locationValues) {
  const points = {};
  const notFound = new Set();
  locationValues.slice(1).forEach(cells => {
    const key = normalizeText(cells[0]);
    if (key === '') return;
    if (cleanText(cells[3]) === NOT_FOUND) {
      notFound.add(key);
      delete points[key];
    } else if (typeof cells[1] === 'number' && typeof cells[2] === 'number') {
      points[key] = { lat: cells[1], lng: cells[2] };
      notFound.delete(key);
    }
  });
  const isSaved = address => Boolean(points[normalizeText(address)]) || notFound.has(normalizeText(address));
  return {
    points: points,
    notFound: addresses.filter(address => notFound.has(normalizeText(address))),
    toLookUp: addresses.filter(address => !isSaved(address)),
  };
}

// One row for the Locations tab. match is null when Google couldn't find the address.
function locationRow(address, match, todayText) {
  return match
    ? [address, match.lat, match.lng, match.matchedAs, todayText]
    : [address, '', '', NOT_FOUND, todayText];
}

// Reads the answer from Google's geocoder: { lat, lng, matchedAs }, or null if it couldn't place the address.
function readGeocoderAnswer(response) {
  // INVALID_REQUEST is saved as not found too, so one odd address can't block every later lookup.
  if (response.status === 'ZERO_RESULTS' || response.status === 'INVALID_REQUEST') return null;
  if (response.status === 'OVER_QUERY_LIMIT' || response.status === 'OVER_DAILY_LIMIT') {
    throw new Error(DAILY_LIMIT_MESSAGE);
  }
  if (response.status !== 'OK') throw new Error(LOOKUP_PROBLEM_MESSAGE);
  const best = response.results[0];
  if ((best.types || []).some(type => TOO_VAGUE_TYPES.includes(type))) return null;
  return { lat: best.geometry.location.lat, lng: best.geometry.location.lng, matchedAs: best.formatted_address };
}

// A warning that lists the addresses Google couldn't find, or '' if there are none.
function describeNotFound(addresses) {
  if (addresses.length === 0) return '';
  return "Google couldn't find these addresses, so they're left out of the distances: " + addresses.join('; ') +
    '. Fix the spelling on the Doctors tab and they will be looked up again.';
}

// ---------- The search form ----------

const NO_MATCHES_MESSAGE = 'No doctors matched. Try a larger distance or Any insurance.';

// Checks what staff typed in the sidebar and turns it into { location, filters }.
function readSearchForm(form) {
  const location = cleanText(form.location);
  if (location === '') throw new Error("Type the patient's ZIP code or address.");
  const profession = cleanText(form.profession);
  if (profession === '') throw new Error('Pick a profession.');
  const milesText = cleanText(form.maxMiles);
  const maxMiles = milesText === '' ? null : Number(milesText);
  if (maxMiles !== null && !(Number.isFinite(maxMiles) && maxMiles > 0)) {
    throw new Error('Max miles must be a number above 0, like 25. Leave it blank for any distance.');
  }
  return {
    location: location,
    filters: {
      profession: profession,
      maxMiles: maxMiles,
      insurance: cleanText(form.insurance) || null,
      language: cleanText(form.language) || null,
    },
  };
}

function countOf(count, word) {
  return count + ' ' + word + (count === 1 ? '' : 's');
}

// What the sidebar shows after a search: one message, plus warnings that didn't stop the search.
function summarizeSearch(outcome) {
  const left = outcome.notLookedUpCount;
  return {
    message: outcome.foundCount === 0
      ? NO_MATCHES_MESSAGE
      : 'Found ' + countOf(outcome.foundCount, 'doctor') + ' — see the Results tab.',
    warnings: outcome.rowWarnings.concat(
      outcome.duplicateCount > 0
        ? countOf(outcome.duplicateCount, 'possible duplicate') + ' — use Check for duplicates.'
        : '',
      describeNotFound(outcome.notFound),
      left > 0
        ? (left === 1 ? "1 address isn't" : left + " addresses aren't") + ' looked up yet, so some doctors may be ' +
          'missing. Run Doctor Finder → Look up all addresses, then search again.'
        : '',
    ).filter(text => text !== ''),
  };
}

// ---------- Distance and ranking ----------

// Straight-line ("as the crow flies") miles between two { lat, lng } points.
function milesBetween(a, b) {
  const toRadians = degrees => degrees * Math.PI / 180;
  const latChange = toRadians(b.lat - a.lat);
  const lngChange = toRadians(b.lng - a.lng);
  const h = Math.sin(latChange / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(lngChange / 2) ** 2;
  const miles = 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
  return Math.round(miles * 10) / 10;
}

// A blank or missing choice means "Any".
function isAny(choice) {
  return normalizeText(choice) === '';
}

function listHas(list, choice) {
  return isAny(choice) || list.some(value => normalizeText(value) === normalizeText(choice));
}

function matchesFilters(doctor, filters) {
  return normalizeText(doctor.profession) === normalizeText(filters.profession) &&
    listHas(doctor.insurance, filters.insurance) &&
    listHas(doctor.languages, filters.language);
}

function byMiles(a, b) {
  return a.miles - b.miles;
}

function missingNote(doctor, office, center) {
  if (!office) return doctor.offices.length === 0 ? 'No office listed' : 'Office address not found';
  if (!center) return doctor.centers.length === 0 ? 'No surgery center listed' : 'Surgery center address not found';
  return '';
}

// Returns a Result for one doctor, or null if they can't be placed or are too far.
function scoreDoctor(doctor, patientPoint, points, maxMiles) {
  // Addresses that weren't found have no point, so they are left out here.
  const withMiles = place => {
    const point = points[normalizeText(place.address)];
    return point ? Object.assign({}, place, { miles: milesBetween(patientPoint, point) }) : null;
  };
  const offices = doctor.offices.map(address => withMiles({ address: address })).filter(Boolean).sort(byMiles);
  const centers = doctor.centers.map(withMiles).filter(Boolean).sort(byMiles);
  const office = offices[0] || null;
  const center = centers[0] || null;
  if (!office && !center) return null;

  const withinLimit = place => maxMiles == null || place.miles <= maxMiles;
  if ((office && !withinLimit(office)) || (center && !withinLimit(center))) return null;

  return {
    rank: 0,
    doctor: doctor.name,
    profession: doctor.profession,
    office: office,
    center: center,
    otherCenters: centers.slice(1).filter(withinLimit),
    insurance: doctor.insurance,
    languages: doctor.languages,
    note: missingNote(doctor, office, center),
  };
}

// The farther of the nearest office and nearest center (D5).
function scoreOf(result) {
  return Math.max.apply(null, [result.office, result.center].filter(Boolean).map(place => place.miles));
}

function compareResults(a, b) {
  const centerMiles = result => (result.center ? result.center.miles : Infinity);
  // Doctors whose office we can measure come first, even if a doctor without one is closer (D25).
  const noOffice = result => (result.office ? 0 : 1);
  return noOffice(a) - noOffice(b) ||
    scoreOf(a) - scoreOf(b) ||
    centerMiles(a) - centerMiles(b) ||
    a.doctor.localeCompare(b.doctor);
}

function rankDoctors(doctors, patientPoint, points, filters) {
  const results = doctors
    .filter(doctor => matchesFilters(doctor, filters))
    .map(doctor => scoreDoctor(doctor, patientPoint, points, filters.maxMiles))
    .filter(Boolean)
    .sort(compareResults);
  const shown = filters.maxMiles == null ? results.slice(0, TOP_N_WHEN_NO_LIMIT) : results;
  shown.forEach((result, i) => { result.rank = i + 1; });
  return shown;
}

// ---------- The Results tab ----------

// The Google Maps address for one place. Destination only, so no patient data (D12).
function mapUrl(address) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
}

// A Results tab cell that opens Google Maps at the address.
function mapLink(address, label) {
  return '=HYPERLINK("' + mapUrl(address) + '", "' + String(label).replace(/"/g, '""') + '")';
}

// searchedAtText is ready-made text (e.g. "2026-11-21 3:42 PM") so this file has no time zones.
function describeSearch(filters, searchedAtText) {
  return [
    filters.profession,
    filters.maxMiles == null ? 'any distance (top ' + TOP_N_WHEN_NO_LIMIT + ')' : 'within ' + filters.maxMiles + ' mi',
    'Insurance: ' + (isAny(filters.insurance) ? 'Any' : filters.insurance),
    'Language: ' + (isAny(filters.language) ? 'Any' : filters.language),
    'searched ' + searchedAtText,
  ].join(' · ');
}

function centerLabel(center) {
  return [center.name, center.address].filter(text => text !== '').join(' — ');
}

function otherCentersText(result) {
  return result.otherCenters.map(center => (center.name || center.address) + ' (' + center.miles + ' mi)').join('; ');
}

function resultRow(result) {
  return [
    result.rank,
    result.doctor,
    result.profession,
    result.office ? mapLink(result.office.address, result.office.address) : result.note,
    result.office ? result.office.miles : '',
    result.center ? mapLink(result.center.address, centerLabel(result.center)) : result.note,
    result.center ? result.center.miles : '',
    otherCentersText(result),
    result.insurance.join(', '),
    result.languages.join(', '),
  ];
}

// Row 1 = what was searched, row 2 = headers, then one row per doctor.
function buildResultsTable(results, filters, searchedAtText) {
  const criteriaRow = RESULT_HEADERS.map((header, i) => (i === 0 ? describeSearch(filters, searchedAtText) : ''));
  return [criteriaRow, RESULT_HEADERS.slice()].concat(results.map(resultRow));
}

// ---------- The map (D26–D29) ----------

// Google's free map pictures are at most 640 pixels wide.
const MAP_SIZE = { width: 640, height: 480 };
const MAP_MARGIN = 40; // pixels kept clear at the edges, so pins aren't cut off
const MAX_MAP_ZOOM = 15; // a single place still shows its neighborhood

// One pin per place: each doctor's nearest office and nearest surgery center.
// A place shared by several doctors, or a doctor's office and center at one address, is one pin.
function buildMapPins(results, points) {
  const visits = results.flatMap(result => [
    result.office && { role: 'office', address: result.office.address, result: result },
    result.center && { role: 'center', address: result.center.address, centerName: result.center.name, result: result },
  ].filter(Boolean));
  return groupBy(visits, visit => normalizeText(visit.address)).map(group => {
    const hasOffice = group.some(visit => visit.role === 'office');
    const centerVisit = group.find(visit => visit.role === 'center');
    const centerName = centerVisit ? centerVisit.centerName || 'Surgery center' : '';
    const doctors = uniqueBy(group.map(visit => visit.result), result => result.rank).map(mapDetails);
    const place = !centerVisit ? 'Office' : hasOffice ? 'Office and ' + centerName : centerName;
    return {
      kind: !centerVisit ? 'office' : hasOffice ? 'both' : 'center',
      label: doctors.map(doctor => doctor.rank).join(', '),
      place: place,
      address: group[0].address,
      hover: [place].concat(doctors.map(doctor => doctor.heading)).join('\n'),
      link: mapUrl(group[0].address),
      point: points[normalizeText(group[0].address)],
      doctors: doctors,
    };
  });
}

// What a pin shows about one doctor, as ready-made lines of text.
function mapDetails(result) {
  return {
    rank: result.rank,
    heading: result.rank + '. ' + result.doctor + ' · ' + result.profession,
    lines: [
      result.office ? 'Office: ' + result.office.address + ' (' + result.office.miles + ' mi)' : result.note,
      result.center ? 'Surgery center: ' + centerLabel(result.center) + ' (' + result.center.miles + ' mi)' : result.note,
      result.otherCenters.length ? 'Other centers: ' + otherCentersText(result) : '',
      result.insurance.length ? 'Insurance: ' + result.insurance.join(', ') : '',
      result.languages.length ? 'Languages: ' + result.languages.join(', ') : '',
    ].filter(text => text !== ''),
  };
}

// Where a { lat, lng } point sits on Google's whole-world map at zoom 0, which is 256 pixels across.
function worldPixel(point) {
  const sinLat = Math.min(Math.max(Math.sin(point.lat * Math.PI / 180), -0.9999), 0.9999);
  return {
    x: 256 * (0.5 + point.lng / 360),
    y: 256 * (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)),
  };
}

function pointAtWorldPixel(pixel) {
  return {
    lat: (2 * Math.atan(Math.exp((0.5 - pixel.y / 256) * 2 * Math.PI)) - Math.PI / 2) * 180 / Math.PI,
    lng: (pixel.x / 256 - 0.5) * 360,
  };
}

// The center and zoom that fit every point on a picture of this size, inside the margin.
function fitMap(pointList, size) {
  const pixels = pointList.map(worldPixel);
  const xs = pixels.map(pixel => pixel.x);
  const ys = pixels.map(pixel => pixel.y);
  const width = Math.max.apply(null, xs) - Math.min.apply(null, xs);
  const height = Math.max.apply(null, ys) - Math.min.apply(null, ys);
  let zoom = MAX_MAP_ZOOM;
  while (zoom > 0 && (width * Math.pow(2, zoom) > size.width - 2 * MAP_MARGIN ||
    height * Math.pow(2, zoom) > size.height - 2 * MAP_MARGIN)) {
    zoom--;
  }
  return {
    center: pointAtWorldPixel({
      x: (Math.max.apply(null, xs) + Math.min.apply(null, xs)) / 2,
      y: (Math.max.apply(null, ys) + Math.min.apply(null, ys)) / 2,
    }),
    zoom: zoom,
  };
}

// Where a point lands on the map picture, in pixels from its top-left corner.
function pinPosition(point, map, size) {
  const scale = Math.pow(2, map.zoom);
  const spot = worldPixel(point);
  const middle = worldPixel(map.center);
  return {
    x: Math.round((spot.x - middle.x) * scale + size.width / 2),
    y: Math.round((spot.y - middle.y) * scale + size.height / 2),
  };
}

// Lets Node load this file for tests. Apps Script ignores it.
if (typeof module !== 'undefined') {
  module.exports = {
    COLUMN_NAMES, DEFAULT_MAX_MILES, TOP_N_WHEN_NO_LIMIT, RESULT_HEADERS, LOCATION_HEADERS, NOT_FOUND,
    DAILY_LIMIT_MESSAGE, LOOKUP_PROBLEM_MESSAGE, NO_MATCHES_MESSAGE,
    normalizeText, splitList, readDoctorRows, findDuplicates, describeDuplicates, groupDoctors,
    listAddresses, listChoices, planLookups, locationRow, readGeocoderAnswer, describeNotFound,
    readSearchForm, summarizeSearch, milesBetween, rankDoctors, buildResultsTable,
    MAP_SIZE, MAP_MARGIN, MAX_MAP_ZOOM, mapUrl, buildMapPins, fitMap, pinPosition,
  };
}
