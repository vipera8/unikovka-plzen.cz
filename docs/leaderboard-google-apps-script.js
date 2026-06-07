const SHEET_NAME = 'Leaderboard';

function doGet(e) {
  const action = String(e.parameter.action || 'list');
  const sheet = getSheet_();

  if (action === 'add') {
    const id = String(e.parameter.id || '');
    if (!id) return json_({ ok: false, error: 'missing id' });

    const rows = sheet.getDataRange().getValues();
    const exists = rows.slice(1).some(row => String(row[0]) === id);
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
    return json_({ ok: true });
  }

  const values = sheet.getDataRange().getValues().slice(1);
  const rows = values
    .filter(row => row[0])
    .map(row => ({
      id: String(row[0]),
      team: String(row[1] || 'Bez nazvu'),
      total: Number(row[2] || 0),
      hints: Number(row[3] || 0),
      solutions: Number(row[4] || 0),
      title: String(row[5] || ''),
      date: String(row[6] || '')
    }))
    .sort((a, b) => a.total - b.total)
    .slice(0, 50);

  return json_({ rows });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'team', 'total', 'hints', 'solutions', 'title', 'date']);
  }
  return sheet;
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
