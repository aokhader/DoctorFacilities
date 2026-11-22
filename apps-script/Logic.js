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
  return scoreOf(a) - scoreOf(b) ||
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

// A link that opens Google Maps at the address. Destination only, so no patient data (D12).
function mapLink(address, label) {
  const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
  return '=HYPERLINK("' + url + '", "' + String(label).replace(/"/g, '""') + '")';
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

function resultRow(result) {
  return [
    result.rank,
    result.doctor,
    result.profession,
    result.office ? mapLink(result.office.address, result.office.address) : result.note,
    result.office ? result.office.miles : '',
    result.center ? mapLink(result.center.address, centerLabel(result.center)) : result.note,
    result.center ? result.center.miles : '',
    result.otherCenters.map(center => (center.name || center.address) + ' (' + center.miles + ' mi)').join('; '),
    result.insurance.join(', '),
    result.languages.join(', '),
  ];
}

// Row 1 = what was searched, row 2 = headers, then one row per doctor.
function buildResultsTable(results, filters, searchedAtText) {
  const criteriaRow = RESULT_HEADERS.map((header, i) => (i === 0 ? describeSearch(filters, searchedAtText) : ''));
  return [criteriaRow, RESULT_HEADERS.slice()].concat(results.map(resultRow));
}

// Lets Node load this file for tests. Apps Script ignores it.
if (typeof module !== 'undefined') {
  module.exports = {
    COLUMN_NAMES, DEFAULT_MAX_MILES, TOP_N_WHEN_NO_LIMIT, RESULT_HEADERS,
    normalizeText, splitList, readDoctorRows, findDuplicates, groupDoctors,
    listAddresses, listChoices, milesBetween, rankDoctors, buildResultsTable,
  };
}
