const LEADERBOARD_SHEET = 'Leaderboard';
const TEAMS_SHEET = 'Teams';
const EVENTS_SHEET = 'Events';
const ADMIN_PASSWORD = 'Groll1813';
const EVENT_HEADERS = [
  'time', 'teamId', 'team', 'accessCode', 'type', 'eventName',
  'station', 'stationTitle', 'hint', 'value', 'detail'
];

function doGet(e) {
  const action = String(e.parameter.action || 'list');

  if (action === 'state') return saveTeamState_(e);
  if (action === 'event') return saveEvent_(e);
  if (action === 'restore') return json_({ team: restoreTeam_(e) }, e);
  if (action === 'admin') {
    if (String(e.parameter.adminPassword || '') !== ADMIN_PASSWORD) {
      return json_({ ok: false, error: 'unauthorized', teams: [], events: [] }, e);
    }
    return json_(adminData_(), e);
  }
  if (action === 'add') return addLeaderboard_(e);

  return json_({ rows: leaderboardRows_() }, e);
}

function saveTeamState_(e) {
  const id = String(e.parameter.id || '');
  if (!id) return json_({ ok: false, error: 'missing id' }, e);

  const sheet = getSheet_(TEAMS_SHEET, [
    'id', 'team', 'accessCode', 'currentStation', 'stationTitle', 'startTime',
    'updatedAt', 'finished', 'finishTime', 'hints', 'solutions', 'wrong',
    'wrongTotal', 'completed', 'lastPos'
  ]);
  const row = findRowById_(sheet, id);
  const values = [
    id,
    String(e.parameter.team || ''),
    String(e.parameter.accessCode || ''),
    Number(e.parameter.currentStation || 1),
    String(e.parameter.stationTitle || ''),
    String(e.parameter.startTime || ''),
    String(e.parameter.updatedAt || new Date().toISOString()),
    String(e.parameter.finished || '0'),
    String(e.parameter.finishTime || ''),
    String(e.parameter.hints || '{}'),
    String(e.parameter.solutions || '{}'),
    String(e.parameter.wrong || '{}'),
    Number(e.parameter.wrongTotal || 0),
    String(e.parameter.completed || '[]'),
    String(e.parameter.lastPos || '')
  ];
  if (row > 0) sheet.getRange(row, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);

  return json_({ ok: true }, e);
}

function saveEvent_(e) {
  const sheet = getSheet_(EVENTS_SHEET, EVENT_HEADERS);
  ensureHeaders_(sheet, EVENT_HEADERS);
  const item = {
    time: String(e.parameter.time || new Date().toISOString()),
    teamId: String(e.parameter.teamId || ''),
    team: String(e.parameter.team || ''),
    accessCode: String(e.parameter.accessCode || ''),
    type: String(e.parameter.type || ''),
    eventName: String(e.parameter.eventName || ''),
    station: Number(e.parameter.station || 1),
    stationTitle: String(e.parameter.stationTitle || ''),
    hint: String(e.parameter.hint || ''),
    value: String(e.parameter.value || ''),
    detail: String(e.parameter.detail || '{}')
  };
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.appendRow(headers.map(header => item[header] !== undefined ? item[header] : ''));
  return json_({ ok: true }, e);
}

function addLeaderboard_(e) {
  const id = String(e.parameter.id || '');
  if (!id) return json_({ ok: false, error: 'missing id' }, e);

  const sheet = getSheet_(LEADERBOARD_SHEET, [
    'id', 'team', 'total', 'hints', 'solutions', 'title', 'date'
  ]);
  const exists = findRowById_(sheet, id) > 0;
  if (!exists) {
    sheet.appendRow([
      id,
      String(e.parameter.team || 'Bez nazvu'),
      Number(e.parameter.total || 0),
      Number(e.parameter.hints || 0),
      Number(e.parameter.solutions || 0),
      String(e.parameter.title || ''),
      String(e.parameter.date || new Date().toISOString())
    ]);
  }
  return json_({ ok: true }, e);
}

function adminData_() {
  return {
    teams: sheetRows_(TEAMS_SHEET).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
    events: sheetRows_(EVENTS_SHEET).slice(-200),
    leaderboard: leaderboardRows_()
  };
}

function restoreTeam_(e) {
  const accessCode = String(e.parameter.accessCode || '').toUpperCase();
  if (!accessCode) return null;
  const rows = sheetRows_(TEAMS_SHEET)
    .filter(row => String(row.accessCode || '').toUpperCase() === accessCode)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return rows[0] || null;
}

function leaderboardRows_() {
  return sheetRows_(LEADERBOARD_SHEET)
    .filter(row => row.id)
    .map(row => ({
      id: String(row.id),
      team: String(row.team || 'Bez nazvu'),
      total: Number(row.total || 0),
      hints: Number(row.hints || 0),
      solutions: Number(row.solutions || 0),
      title: String(row.title || ''),
      date: String(row.date || '')
    }))
    .sort((a, b) => a.total - b.total)
    .slice(0, 50);
}

function sheetRows_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  return values.slice(1).map(row => {
    const item = {};
    headers.forEach((header, index) => item[header] = row[index]);
    return item;
  });
}

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

function ensureHeaders_(sheet, requiredHeaders) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  const missing = requiredHeaders.filter(header => current.indexOf(header) === -1);
  if (!missing.length) return;
  sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
}

function findRowById_(sheet, id) {
  if (sheet.getLastRow() < 2) return -1;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === id) return i + 2;
  }
  return -1;
}

function json_(data, e) {
  const text = JSON.stringify(data);
  const callback = e && e.parameter && e.parameter.callback;
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${text});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}
