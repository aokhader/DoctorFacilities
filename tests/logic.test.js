// Tests for apps-script/Logic.js. Run from the project folder: node --test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const logic = require('../apps-script/Logic.js');

const HEADER = Object.values(logic.COLUMN_NAMES);
const rowsOf = (...dataRows) => logic.readDoctorRows([HEADER, ...dataRows]).rows;

// Made-up places due north of the patient: 1 degree of latitude is about 69.1 miles.
const PATIENT_AT_ZERO = { lat: 0, lng: 0 };
const testPoints = {};
function placeNorth(degrees) {
  const address = 'Place ' + degrees + ' north';
  testPoints[logic.normalizeText(address)] = { lat: degrees, lng: 0 };
  return address;
}
function makeDoctor(name, offices, centers, extra) {
  return Object.assign({ name, profession: 'Cardiology', offices, centers, insurance: [], languages: [] }, extra);
}
const center = (name, address) => ({ name, address });
const names = results => results.map(result => result.doctor);
const anyFilters = extra => Object.assign({ profession: 'Cardiology', maxMiles: null, insurance: null, language: null }, extra);

// ---------- Text ----------

test('normalizeText trims, collapses spaces, lowercases, and handles numbers', () => {
  assert.equal(logic.normalizeText('  Dr.   Jane  DOE '), 'dr. jane doe');
  assert.equal(logic.normalizeText(92101), '92101');
  assert.equal(logic.normalizeText(null), '');
});

test('splitList accepts commas and semicolons and drops blanks', () => {
  assert.deepEqual(logic.splitList('Aetna; Cigna,  Blue Shield ,'), ['Aetna', 'Cigna', 'Blue Shield']);
  assert.deepEqual(logic.splitList(''), []);
});

// ---------- Reading the Doctors tab ----------

test('readDoctorRows finds columns by header text, in any order and any case', () => {
  const values = [
    ['languages', '  INSURANCE ', 'Notes', 'facility address', 'Facility Name', 'office address', 'PROFESSION', 'doctor name'],
    ['English; Spanish', 'Aetna, Cigna', 'ignored', '202 C St', 'Harbor', 92101, 'Cardiology', 'Dr. X'],
  ];
  assert.deepEqual(logic.readDoctorRows(values), {
    rows: [{
      rowNumber: 2, doctorName: 'Dr. X', profession: 'Cardiology', officeAddress: '92101',
      facilityName: 'Harbor', facilityAddress: '202 C St',
      insurance: ['Aetna', 'Cigna'], languages: ['English', 'Spanish'],
    }],
    warnings: [],
  });
});

test('readDoctorRows: a missing header gives the plain-English message', () => {
  const withoutOffice = HEADER.filter(header => header !== 'Office Address');
  assert.throws(() => logic.readDoctorRows([withoutOffice]), {
    message: "Couldn't find the column 'Office Address' on the Doctors tab. Check the header spelling.",
  });
  assert.throws(() => logic.readDoctorRows([]), /Couldn't find the column 'Doctor Name'/);
});

test('readDoctorRows: blank name or profession is left out with a warning; empty rows are skipped quietly', () => {
  const result = logic.readDoctorRows([
    HEADER,
    ['', 'Cardiology', 'a', '', '', '', ''],
    ['Dr. X', '  ', 'a', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Dr. Y', 'Cardiology', '', '', '', '', ''],
  ]);
  assert.deepEqual(result.warnings, [
    "Row 2 has no Doctor Name, so it's left out of searches.",
    "Row 3 has no Profession, so it's left out of searches.",
  ]);
  assert.deepEqual(result.rows.map(row => row.rowNumber), [5]);
});

// ---------- Duplicates and grouping ----------

test('findDuplicates matches name + profession + facility, ignoring case and spacing', () => {
  const rows = rowsOf(
    ['Jane Doe', 'Cardiology', '', 'Harbor Center', '', '', ''],
    ['  jane   DOE ', 'cardiology', '', 'harbor  center', '', '', ''],
    ['Jane Doe', 'Cardiology', '', 'Coast Center', '', '', ''],
    ['Dr. Jane Doe', 'Cardiology', '', 'Harbor Center', '', '', ''], // different text: not flagged (P5)
    ['JANE DOE', 'CARDIOLOGY', '', 'HARBOR CENTER', '', '', ''],
  );
  assert.deepEqual(logic.findDuplicates(rows), [
    { rowNumbers: [2, 3, 6], doctorName: 'Jane Doe', profession: 'Cardiology', facilityName: 'Harbor Center' },
  ]);
  assert.equal(rows.length, 5, 'no row is removed');
});

test('describeDuplicates lists row numbers in plain words', () => {
  assert.equal(logic.describeDuplicates([]), 'No possible duplicates found.');
  assert.equal(logic.describeDuplicates([
    { rowNumbers: [2, 5], doctorName: 'Jane Doe', profession: 'Cardiology', facilityName: 'Harbor Center' },
    { rowNumbers: [3, 7, 9], doctorName: 'Sam Roe', profession: 'Orthopedics', facilityName: '' },
  ]), 'Rows 2 and 5: Jane Doe · Cardiology · Harbor Center\n' +
    'Rows 3, 7 and 9: Sam Roe · Orthopedics\n' +
    '\n' +
    'Nothing was changed. Fix these on the Doctors tab if you want to.');
});

test('groupDoctors joins one doctor across several rows', () => {
  const doctors = logic.groupDoctors(rowsOf(
    ['Dr. X', 'Cardiology', '1 Main St', 'Harbor', '202 C St', 'Aetna, Cigna', 'English'],
    ['dr. x', 'CARDIOLOGY', '1 main  st', 'Coast', '7 Draper Ave', 'aetna; Medicare', 'Spanish'],
    ['Dr. X', 'Cardiology', '9 Oak Ave', 'harbor', '202 c st', '', ''],
    ['Dr. X', 'Neurosurgery', '1 Main St', '', '', '', ''],
  ));
  assert.deepEqual(doctors, [
    {
      name: 'Dr. X', profession: 'Cardiology',
      offices: ['1 Main St', '9 Oak Ave'],
      centers: [center('Harbor', '202 C St'), center('Coast', '7 Draper Ave')],
      insurance: ['Aetna', 'Cigna', 'Medicare'], languages: ['English', 'Spanish'],
    },
    { name: 'Dr. X', profession: 'Neurosurgery', offices: ['1 Main St'], centers: [], insurance: [], languages: [] },
  ]);
});

test('listAddresses and listChoices give each value once', () => {
  const rows = rowsOf(
    ['Dr. X', 'Neurosurgery', '1 Main St', 'Harbor', '202 C St', 'Cigna, Aetna', 'Spanish'],
    ['Dr. Y', 'cardiology', '1 main st', 'Coast', '', 'aetna', 'English'],
    ['Dr. Z', 'Cardiology', '', '', '', '', ''],
  );
  assert.deepEqual(logic.listAddresses(rows), ['1 Main St', '202 C St']);
  assert.deepEqual(logic.listChoices(rows), {
    professions: ['cardiology', 'Neurosurgery'],
    insurances: ['Aetna', 'Cigna'],
    languages: ['English', 'Spanish'],
  });
});

// ---------- The Locations tab ----------

test('planLookups: saved points, not-found addresses, and what is still to look up', () => {
  const locationValues = [
    logic.LOCATION_HEADERS,
    ['1 Main St', 32.7, -117.1, '1 Main St, Town, CA, USA', '2026-11-20'],
    ['9 Bad Rd', '', '', 'NOT FOUND', '2026-11-20'],
    ['5 Oak Ave', '', '', 'someone cleared the numbers', '2026-11-20'],
    ['7 Elm St', '', '', 'NOT FOUND', '2026-11-20'],
    ['  7 elm  st ', 32.9, -117.3, '7 Elm St, Town, CA, USA', '2026-11-21'], // later row wins
  ];
  const addresses = ['1 MAIN ST', '9 Bad Rd', '5 Oak Ave', '7 Elm St', '2 New St'];
  assert.deepEqual(logic.planLookups(addresses, locationValues), {
    points: { '1 main st': { lat: 32.7, lng: -117.1 }, '7 elm st': { lat: 32.9, lng: -117.3 } },
    notFound: ['9 Bad Rd'],
    toLookUp: ['5 Oak Ave', '2 New St'],
  });
  assert.deepEqual(logic.planLookups(['1 Main St'], []).toLookUp, ['1 Main St'], 'no Locations tab yet');
  assert.deepEqual(logic.planLookups(['1 Main St'], [['']]).toLookUp, ['1 Main St'], 'an empty tab');
});

test('locationRow writes a found or NOT FOUND row', () => {
  assert.deepEqual(logic.locationRow('1 Main St', { lat: 1, lng: 2, matchedAs: '1 Main St, USA' }, '2026-11-21'),
    ['1 Main St', 1, 2, '1 Main St, USA', '2026-11-21']);
  assert.deepEqual(logic.locationRow('9 Bad Rd', null, '2026-11-21'), ['9 Bad Rd', '', '', 'NOT FOUND', '2026-11-21']);
});

test('readGeocoderAnswer: a street, ZIP or city counts; a whole state or country does not (D20)', () => {
  const answer = (types, status) => ({
    status: status || 'OK',
    results: [{ formatted_address: 'Somewhere, USA', geometry: { location: { lat: 1, lng: 2 } }, types: types }],
  });
  const found = { lat: 1, lng: 2, matchedAs: 'Somewhere, USA' };
  assert.deepEqual(logic.readGeocoderAnswer(answer(['street_address'])), found);
  assert.deepEqual(logic.readGeocoderAnswer(answer(['postal_code'])), found);
  assert.deepEqual(logic.readGeocoderAnswer(answer(['locality', 'political'])), found);
  assert.equal(logic.readGeocoderAnswer(answer(['administrative_area_level_1', 'political'])), null);
  assert.equal(logic.readGeocoderAnswer(answer(['country', 'political'])), null);
  assert.equal(logic.readGeocoderAnswer({ status: 'ZERO_RESULTS', results: [] }), null);
  assert.equal(logic.readGeocoderAnswer({ status: 'INVALID_REQUEST', results: [] }), null);
  assert.throws(() => logic.readGeocoderAnswer({ status: 'OVER_QUERY_LIMIT', results: [] }),
    { message: logic.DAILY_LIMIT_MESSAGE });
  assert.throws(() => logic.readGeocoderAnswer({ status: 'UNKNOWN_ERROR', results: [] }),
    { message: logic.LOOKUP_PROBLEM_MESSAGE });
});

test('describeNotFound lists the addresses and says how to fix them', () => {
  assert.equal(logic.describeNotFound([]), '');
  assert.equal(logic.describeNotFound(['9 Bad Rd', '8 Odd Ln']),
    "Google couldn't find these addresses, so they're left out of the distances: 9 Bad Rd; 8 Odd Ln. " +
    'Fix the spelling on the Doctors tab and they will be looked up again.');
});

// ---------- The search form ----------

test('readSearchForm trims the form and turns blanks into Any', () => {
  assert.deepEqual(
    logic.readSearchForm({ location: ' 92101 ', profession: 'Cardiology', maxMiles: ' 2.5 ', insurance: '', language: 'Spanish' }),
    { location: '92101', filters: { profession: 'Cardiology', maxMiles: 2.5, insurance: null, language: 'Spanish' } });
  assert.equal(logic.readSearchForm({ location: '92101', profession: 'Cardiology', maxMiles: '' }).filters.maxMiles, null,
    'blank max miles = any distance');
});

test('readSearchForm: each missing or bad field gives its plain-English message', () => {
  const form = extra => Object.assign({ location: '92101', profession: 'Cardiology', maxMiles: '25' }, extra);
  assert.throws(() => logic.readSearchForm(form({ location: '  ' })), { message: "Type the patient's ZIP code or address." });
  assert.throws(() => logic.readSearchForm(form({ profession: '' })), { message: 'Pick a profession.' });
  for (const maxMiles of ['0', '-5', 'abc', '25 miles', 'Infinity']) {
    assert.throws(() => logic.readSearchForm(form({ maxMiles })),
      { message: 'Max miles must be a number above 0, like 25. Leave it blank for any distance.' }, maxMiles);
  }
});

test('summarizeSearch: the found message plus each kind of warning', () => {
  const outcome = extra => Object.assign(
    { foundCount: 7, rowWarnings: [], duplicateCount: 0, notFound: [], notLookedUpCount: 0 }, extra);
  assert.deepEqual(logic.summarizeSearch(outcome()), { message: 'Found 7 doctors — see the Results tab.', warnings: [] });
  assert.equal(logic.summarizeSearch(outcome({ foundCount: 1 })).message, 'Found 1 doctor — see the Results tab.');
  assert.equal(logic.summarizeSearch(outcome({ foundCount: 0 })).message, logic.NO_MATCHES_MESSAGE);
  assert.deepEqual(logic.summarizeSearch(outcome({
    rowWarnings: ["Row 9 has no Doctor Name, so it's left out of searches."],
    duplicateCount: 3, notFound: ['9 Bad Rd'], notLookedUpCount: 1,
  })).warnings, [
    "Row 9 has no Doctor Name, so it's left out of searches.",
    '3 possible duplicates — use Check for duplicates.',
    logic.describeNotFound(['9 Bad Rd']),
    "1 address isn't looked up yet, so some doctors may be missing. " +
      'Run Doctor Finder → Look up all addresses, then search again.',
  ]);
  assert.match(logic.summarizeSearch(outcome({ duplicateCount: 1, notLookedUpCount: 40 })).warnings.join('\n'),
    /^1 possible duplicate — .*\n40 addresses aren't looked up yet/);
});

// ---------- Distance and ranking ----------

test('milesBetween: same point is 0, one degree of latitude is about 69.1 miles', () => {
  assert.equal(logic.milesBetween({ lat: 32.7, lng: -117.1 }, { lat: 32.7, lng: -117.1 }), 0);
  assert.equal(logic.milesBetween({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 69.1);
});

test('rankDoctors sorts by the farther of office and center, then center miles, then name', () => {
  const doctors = [
    makeDoctor('Dr. X', [placeNorth(0.1)], [center('C', placeNorth(0.05))]),   // 6.9 / 3.5
    makeDoctor('Dr. Y', [placeNorth(0.02)], [center('C', placeNorth(0.08))]),  // 1.4 / 5.5
    makeDoctor('Dr. Z', [placeNorth(0.5)], [center('C', placeNorth(0.01))]),   // 34.5 / 0.7
    makeDoctor('Dr. W', [placeNorth(0.08)], [center('C', placeNorth(0.02))]),  // 5.5 / 1.4
    makeDoctor('Dr. Aaa', [placeNorth(0.08)], [center('C', placeNorth(0.02))]),
  ];
  const ranked = logic.rankDoctors(doctors, PATIENT_AT_ZERO, testPoints, anyFilters());
  assert.deepEqual(names(ranked), ['Dr. Aaa', 'Dr. W', 'Dr. Y', 'Dr. X', 'Dr. Z']);
  assert.deepEqual(ranked.map(result => result.rank), [1, 2, 3, 4, 5]);

  const within25 = logic.rankDoctors(doctors, PATIENT_AT_ZERO, testPoints, anyFilters({ maxMiles: 25 }));
  assert.deepEqual(names(within25), ['Dr. Aaa', 'Dr. W', 'Dr. Y', 'Dr. X']);

  const within6 = logic.rankDoctors(doctors, PATIENT_AT_ZERO, testPoints, anyFilters({ maxMiles: 6 }));
  assert.deepEqual(names(within6), ['Dr. Aaa', 'Dr. W', 'Dr. Y'], 'office AND center must both be within the limit');
});

test('rankDoctors: a doctor with only one kind of location is ranked by it, with a note; known offices come first (D25)', () => {
  const doctors = [
    makeDoctor('Dr. No Office', [], [center('C', placeNorth(0.05))]),                // 3.5, but no office
    makeDoctor('Dr. Office Not Found', ['Nowhere'], [center('C', placeNorth(0.06))]), // 4.1, office not placed
    makeDoctor('Dr. No Center', [placeNorth(0.07)], []),                              // 4.8
    makeDoctor('Dr. Center Not Found', [placeNorth(0.08)], [center('C', 'Nowhere')]), // 5.5
    makeDoctor('Dr. Both', [placeNorth(0.2)], [center('C', placeNorth(0.1))]),        // 13.8
    makeDoctor('Dr. Nothing Found', ['Nowhere'], []),
  ];
  const ranked = logic.rankDoctors(doctors, PATIENT_AT_ZERO, testPoints, anyFilters({ maxMiles: 25 }));
  assert.deepEqual(ranked.map(result => [result.doctor, result.note]), [
    ['Dr. No Center', 'No surgery center listed'],
    ['Dr. Center Not Found', 'Surgery center address not found'],
    ['Dr. Both', ''],
    ['Dr. No Office', 'No office listed'],
    ['Dr. Office Not Found', 'Office address not found'],
  ]);
  assert.equal(ranked[3].office, null);
  assert.equal(ranked[3].center.miles, 3.5);
});

test('rankDoctors lists the other centers within the limit, nearest first', () => {
  const doctors = [makeDoctor('Dr. X', [placeNorth(0.01)], [
    center('Far', placeNorth(0.5)), center('Mid', placeNorth(0.1)), center('Near', placeNorth(0.02)),
  ])];
  const [within25] = logic.rankDoctors(doctors, PATIENT_AT_ZERO, testPoints, anyFilters({ maxMiles: 25 }));
  assert.equal(within25.center.name, 'Near');
  assert.deepEqual(within25.otherCenters.map(c => c.name), ['Mid']);
  const [noLimit] = logic.rankDoctors(doctors, PATIENT_AT_ZERO, testPoints, anyFilters());
  assert.deepEqual(noLimit.otherCenters.map(c => [c.name, c.miles]), [['Mid', 6.9], ['Far', 34.5]]);
});

test('rankDoctors filters by profession, insurance and language, ignoring case; blank means Any', () => {
  const doctors = [
    makeDoctor('Dr. X', [placeNorth(0.01)], [], { insurance: ['Aetna', 'Cigna'], languages: ['English'] }),
    makeDoctor('Dr. Y', [placeNorth(0.02)], [], { insurance: ['Medicare'], languages: ['Spanish'] }),
    makeDoctor('Dr. Z', [placeNorth(0.03)], [], { profession: 'Neurosurgery' }),
  ];
  const search = extra => names(logic.rankDoctors(doctors, PATIENT_AT_ZERO, testPoints, anyFilters(extra)));
  assert.deepEqual(search({ profession: ' cardiology ' }), ['Dr. X', 'Dr. Y']);
  assert.deepEqual(search({ insurance: 'CIGNA' }), ['Dr. X']);
  assert.deepEqual(search({ language: 'spanish' }), ['Dr. Y']);
  assert.deepEqual(search({ insurance: '', language: '' }), ['Dr. X', 'Dr. Y']);
  assert.deepEqual(search({ insurance: 'Medicare', language: 'English' }), []);
});

test('rankDoctors shows the top 20 when there is no limit', () => {
  const doctors = [];
  for (let i = 1; i <= 25; i++) {
    doctors.push(makeDoctor('Dr. ' + String(i).padStart(2, '0'), [placeNorth(i / 100)], []));
  }
  const noLimit = logic.rankDoctors(doctors, PATIENT_AT_ZERO, testPoints, anyFilters());
  assert.equal(noLimit.length, 20);
  assert.equal(noLimit[19].rank, 20);
  assert.equal(logic.rankDoctors(doctors, PATIENT_AT_ZERO, testPoints, anyFilters({ maxMiles: 1000 })).length, 25);
});

// ---------- The Results tab ----------

test('buildResultsTable: criteria row, headers, map links with quotes escaped', () => {
  const result = {
    rank: 1, doctor: 'Dr. Q', profession: 'Cardiology', office: null,
    center: { name: 'The "Best" Center', address: '1 Main St, Town, CA', miles: 2.5 },
    otherCenters: [{ name: 'Other', address: '2 Oak St', miles: 3 }],
    insurance: ['Aetna', 'Cigna'], languages: ['English'], note: 'No office listed',
  };
  const filters = { profession: 'Cardiology', maxMiles: null, insurance: 'Aetna', language: 'Spanish' };
  const table = logic.buildResultsTable([result], filters, '2026-11-21 3:42 PM');
  assert.deepEqual(table, [
    ['Cardiology · any distance (top 20) · Insurance: Aetna · Language: Spanish · searched 2026-11-21 3:42 PM',
      '', '', '', '', '', '', '', '', ''],
    logic.RESULT_HEADERS,
    [1, 'Dr. Q', 'Cardiology', 'No office listed', '',
      '=HYPERLINK("https://www.google.com/maps/search/?api=1&query=1%20Main%20St%2C%20Town%2C%20CA", "The ""Best"" Center — 1 Main St, Town, CA")',
      2.5, 'Other (3 mi)', 'Aetna, Cigna', 'English'],
  ]);
  assert.equal(logic.buildResultsTable([], filters, 'now').length, 2, 'no matches still writes the criteria and headers');
});

// ---------- End to end with the sample sheet ----------

// Reads a CSV file the way Google Sheets imports it (quoted fields may hold commas).
function parseCsv(text) {
  const rows = [[]];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes && ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
    else if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ',') { rows[rows.length - 1].push(field); field = ''; }
    else if (!inQuotes && ch === '\n') { rows[rows.length - 1].push(field); field = ''; rows.push([]); }
    else if (ch !== '\r') field += ch;
  }
  rows[rows.length - 1].push(field);
  return rows;
}

// Approximate coordinates for the sample addresses, standing in for the Locations tab.
const SAMPLE_POINTS = {
  '330 Park Blvd, San Diego, CA 92101': { lat: 32.7083, lng: -117.1531 },
  '202 C St, San Diego, CA 92101': { lat: 32.7166, lng: -117.1628 },
  '7555 Draper Ave, La Jolla, CA 92037': { lat: 32.8418, lng: -117.2747 },
  '640 Orange Ave, Coronado, CA 92118': { lat: 32.6830, lng: -117.1795 },
  '201 E Douglas Ave, El Cajon, CA 92020': { lat: 32.7946, lng: -116.9616 },
  '2123 Fenton Pkwy, San Diego, CA 92108': { lat: 32.7820, lng: -117.1240 },
  '300 N Coast Hwy, Oceanside, CA 92054': { lat: 33.1959, lng: -117.3795 },
  '239 S Kalmia St, Escondido, CA 92025': { lat: 33.1196, lng: -117.0855 },
  '1401 National City Blvd, National City, CA 91950': { lat: 32.6780, lng: -117.1000 },
  '365 F St, Chula Vista, CA 91910': { lat: 32.6390, lng: -117.0790 },
  '3701 Voltaire St, San Diego, CA 92107': { lat: 32.7480, lng: -117.2280 },
  '1775 Dove Ln, Carlsbad, CA 92011': { lat: 33.1180, lng: -117.2870 },
};
const SAMPLE_NOT_FOUND = '123 Nowhere Rd, Nowhere, CA 00000';
const DOWNTOWN_PATIENT = { lat: 32.7157, lng: -117.1611 };

test('sample CSV: has every case from data.md and runs end to end through the logic', () => {
  const values = parseCsv(fs.readFileSync(path.join(__dirname, '..', 'sample', 'doctors-sample.csv'), 'utf8'));
  const { rows, warnings } = logic.readDoctorRows(values);
  assert.deepEqual(warnings, []);
  assert.equal(rows.length, 12);

  // The duplicate pair differs only in case and spacing. Both rows stay in use.
  assert.deepEqual(logic.findDuplicates(rows).map(duplicate => duplicate.rowNumbers), [[2, 5]]);

  const doctors = logic.groupDoctors(rows);
  assert.deepEqual(logic.listChoices(rows).professions, ['Cardiology', 'Neurosurgery', 'Orthopedics']);
  assert.ok(doctors.some(d => d.offices.length === 2 && d.centers.length === 3), 'a doctor with 2 offices and 3 centers');
  assert.ok(doctors.some(d => d.offices.length === 0), 'a doctor with no office');
  const listCells = values.slice(1).flatMap(row => [row[HEADER.indexOf('Insurance')], row[HEADER.indexOf('Languages')]]);
  assert.ok(listCells.some(cell => cell.includes(',')) && listCells.some(cell => cell.includes(';')), 'lists use , and ;');

  // Every address has a test coordinate except the one meant to be not found.
  const points = {};
  Object.keys(SAMPLE_POINTS).forEach(address => { points[logic.normalizeText(address)] = SAMPLE_POINTS[address]; });
  const addresses = logic.listAddresses(rows);
  assert.ok(addresses.includes(SAMPLE_NOT_FOUND));
  assert.deepEqual(addresses.filter(a => a !== SAMPLE_NOT_FOUND && !points[logic.normalizeText(a)]), []);
  assert.equal(addresses.length, Object.keys(SAMPLE_POINTS).length + 1);

  const search = extra => logic.rankDoctors(doctors, DOWNTOWN_PATIENT, points, anyFilters(extra));

  const cardiology25 = search({ maxMiles: 25 });
  assert.deepEqual(names(cardiology25), ['Dr. Sample A', 'Dr. Sample C', 'Dr. Sample E'],
    'far Oceanside doctor dropped; E (office not found) after the doctors with offices');
  assert.deepEqual(cardiology25[0].otherCenters.map(c => c.name),
    ['Bayview Surgery Center (sample)', 'Coast Surgery Center (sample)']);
  assert.equal(cardiology25[2].note, 'Office address not found');
  assert.deepEqual(names(search({})), ['Dr. Sample A', 'Dr. Sample C', 'Dr. Sample D', 'Dr. Sample E']);

  const neuro = search({ profession: 'Neurosurgery', maxMiles: 25 });
  assert.deepEqual(names(neuro), ['Dr. Sample F', 'Dr. Sample B']);
  assert.equal(neuro[1].note, 'No office listed');

  assert.deepEqual(names(search({ profession: 'Orthopedics', maxMiles: 25 })), ['Dr. Sample H', 'Dr. Sample J']);
  assert.deepEqual(names(search({ profession: 'Orthopedics' })), ['Dr. Sample H', 'Dr. Sample J', 'Dr. Sample G']);
  assert.deepEqual(names(search({ insurance: 'MEDICARE' })), ['Dr. Sample C', 'Dr. Sample D']);
  assert.deepEqual(names(search({ language: 'spanish' })), ['Dr. Sample A', 'Dr. Sample D']);

  const table = logic.buildResultsTable(cardiology25, anyFilters({ maxMiles: 25 }), '2026-11-21 3:42 PM');
  assert.equal(table[0][0], 'Cardiology · within 25 mi · Insurance: Any · Language: Any · searched 2026-11-21 3:42 PM');
  assert.deepEqual(table[1], logic.RESULT_HEADERS);
  assert.equal(table.length, 5);
  assert.ok(table.every(row => row.length === logic.RESULT_HEADERS.length));
  assert.equal(table[2][3],
    '=HYPERLINK("https://www.google.com/maps/search/?api=1&query=330%20Park%20Blvd%2C%20San%20Diego%2C%20CA%2092101", "330 Park Blvd, San Diego, CA 92101")');
  assert.equal(table[4][3], 'Office address not found');
  assert.ok(!JSON.stringify(table).includes(String(DOWNTOWN_PATIENT.lat)), "the patient's location is not in the table");
});
