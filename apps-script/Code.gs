/**
 * DMMMSU SLUC ROTC UNIT — Backend (Google Apps Script)
 * Uses a Google Sheet as the database. Deploy this as a Web App
 * and paste the resulting /exec URL into assets/js/api.js (API_URL).
 *
 * SETUP:
 * 1. Create a new Google Sheet.
 * 2. Extensions > Apps Script. Delete any starter code and paste this file in.
 * 3. Run the `initializeSheets` function once (Run menu > initializeSheets).
 *    - Approve the permissions it asks for.
 *    - This creates all tabs (Students, Officers, Admins, Sessions,
 *      Attendance, Announcements) with headers, and one sample admin
 *      login: ID "admin", Email "admin@rotc.local", Password "admin123".
 *      CHANGE THAT PASSWORD after your first login.
 * 4. Deploy > New deployment > type "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    - Click Deploy, copy the Web App URL (ends in /exec).
 * 5. Paste that URL into assets/js/api.js as API_URL.
 */

const SHEET_NAMES = {
  STUDENTS: "Students",
  OFFICERS: "Officers",
  ADMINS: "Admins",
  SESSIONS: "Sessions",
  ATTENDANCE: "Attendance",
  ANNOUNCEMENTS: "Announcements",
};

const STUDENT_HEADERS = ["ID","Name","Email","Password","Course","Address","Beneficiary","CP","Status","Birthday","Blood","MS1","MS2","PhotoUrl"];
const OFFICER_HEADERS = ["Rank","Name","CP","Address","Role","BankNo","TinNo"];
const ADMIN_HEADERS   = ["ID","Name","Email","Password","Rank","Role","Address","CP","PhotoUrl"];
const SESSION_HEADERS = ["Token","Type","Date","Time","CreatedAt"];
const ATTEND_HEADERS  = ["StudentID","Name","Date","TimeIn","TimeOut"];
const ANNOUNCE_HEADERS = ["Date","Title","Body"];

// ---------------------------------------------------------------
// Spreadsheet menu — lets you add an admin from inside the Sheet,
// no need to open the Apps Script editor each time.
// ---------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("ROTC Tools")
    .addItem("Add New Admin", "addAdminPrompt_")
    .addToUi();
}

function addAdminPrompt_() {
  const ui = SpreadsheetApp.getUi();

  const idResp = ui.prompt("New Admin — Step 1 of 4", "Unique ID (e.g. admin2):", ui.ButtonSet.OK_CANCEL);
  if (idResp.getSelectedButton() !== ui.Button.OK || !idResp.getResponseText()) return;
  const id = idResp.getResponseText().trim();

  const nameResp = ui.prompt("New Admin — Step 2 of 4", "Full name:", ui.ButtonSet.OK_CANCEL);
  if (nameResp.getSelectedButton() !== ui.Button.OK) return;
  const name = nameResp.getResponseText().trim();

  const emailResp = ui.prompt("New Admin — Step 3 of 4", "Email:", ui.ButtonSet.OK_CANCEL);
  if (emailResp.getSelectedButton() !== ui.Button.OK) return;
  const email = emailResp.getResponseText().trim();

  const pwResp = ui.prompt("New Admin — Step 4 of 4", "Password (they'll use this to log in):", ui.ButtonSet.OK_CANCEL);
  if (pwResp.getSelectedButton() !== ui.Button.OK || !pwResp.getResponseText()) return;
  const password = pwResp.getResponseText();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureSheet_(ss, SHEET_NAMES.ADMINS, ADMIN_HEADERS);

  const existing = sheetToObjects_(sheet);
  if (existing.some(r => String(r.ID) === id || String(r.Email).toLowerCase() === email.toLowerCase())) {
    ui.alert("An admin with that ID or email already exists.");
    return;
  }

  appendRow_(sheet, ADMIN_HEADERS, {
    ID: id, Name: name, Email: email, Password: hash_(password),
    Rank: "", Role: "Administrator", Address: "", CP: "", PhotoUrl: "",
  });

  ui.alert("Admin added! They can log in with:\nEmail: " + email + "\nPassword: (what you just typed)");
}

// ---------------------------------------------------------------
// One-time setup
// ---------------------------------------------------------------
function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_NAMES.STUDENTS, STUDENT_HEADERS);
  ensureSheet_(ss, SHEET_NAMES.OFFICERS, OFFICER_HEADERS);
  ensureSheet_(ss, SHEET_NAMES.ADMINS, ADMIN_HEADERS);
  ensureSheet_(ss, SHEET_NAMES.SESSIONS, SESSION_HEADERS);
  ensureSheet_(ss, SHEET_NAMES.ATTENDANCE, ATTEND_HEADERS);
  ensureSheet_(ss, SHEET_NAMES.ANNOUNCEMENTS, ANNOUNCE_HEADERS);

  const admins = sheetToObjects_(ss.getSheetByName(SHEET_NAMES.ADMINS));
  if (!admins.length) {
    appendRow_(ss.getSheetByName(SHEET_NAMES.ADMINS), ADMIN_HEADERS, {
      ID: "admin", Name: "ROTC Admin", Email: "admin@rotc.local",
      Password: hash_("admin123"), Rank: "", Role: "Administrator",
      Address: "", CP: "", PhotoUrl: "",
    });
  }
  Logger.log("Sheets initialized. Default admin login -> ID/Email: admin@rotc.local  Password: admin123");
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ---------------------------------------------------------------
// Web app entry point
// ---------------------------------------------------------------
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: "Bad request body." });
  }

  const action = body.action;
  const payload = body.payload || {};

  try {
    const fn = ACTIONS[action];
    if (!fn) throw new Error("Unknown action: " + action);
    const result = fn(payload);
    return jsonOut_({ ok: true, result: result });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    "DMMMSU SLUC ROTC UNIT API is running. POST requests only."
  );
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------
// Action router
// ---------------------------------------------------------------
const ACTIONS = {
  enroll, login,
  getProfile, updateProfile,
  getAnnouncements, saveAnnouncement,
  recordAttendance, getMyAttendance,
  createAttendanceSession, getAttendanceRecords,
  getAllStudents, setStudentStatus, deleteStudent, updateStudentGrades,
  getOfficers, saveOfficers,
};

// ---------------------------------------------------------------
// Auth
// ---------------------------------------------------------------
function enroll(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
  const rows = sheetToObjects_(sheet);

  const dup = rows.some(r =>
    String(r.ID).trim() === String(payload.studentId).trim() ||
    String(r.Email).toLowerCase().trim() === String(payload.email).toLowerCase().trim()
  );
  if (dup) return { duplicate: true };

  appendRow_(sheet, STUDENT_HEADERS, {
    ID: payload.studentId,
    Name: payload.name,
    Email: payload.email,
    Password: hash_(payload.password),
    Course: payload.course,
    Address: payload.address,
    Beneficiary: payload.beneficiary,
    CP: payload.cp,
    Status: "Pending",
    Birthday: "", Blood: "", MS1: "", MS2: "", PhotoUrl: "",
  });
  return { duplicate: false };
}

function login(payload) {
  const id = String(payload.id || "").trim().toLowerCase();
  const pwHash = hash_(payload.password || "");
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const students = sheetToObjects_(ss.getSheetByName(SHEET_NAMES.STUDENTS));
  const student = students.find(r =>
    (String(r.ID).toLowerCase().trim() === id || String(r.Email).toLowerCase().trim() === id)
    && String(r.Password) === pwHash
  );
  if (student) {
    return { role: "student", id: student.ID, name: student.Name, status: student.Status };
  }

  const admins = sheetToObjects_(ss.getSheetByName(SHEET_NAMES.ADMINS));
  const admin = admins.find(r =>
    (String(r.ID).toLowerCase().trim() === id || String(r.Email).toLowerCase().trim() === id)
    && String(r.Password) === pwHash
  );
  if (admin) {
    return { role: "admin", id: admin.ID, name: admin.Name, status: "Approved" };
  }

  throw new Error("Invalid email/ID or password.");
}

// ---------------------------------------------------------------
// Profile
// ---------------------------------------------------------------
function getProfile(payload) {
  const id = String(payload.id || "").trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const students = sheetToObjects_(ss.getSheetByName(SHEET_NAMES.STUDENTS));
  const student = students.find(r => String(r.ID) === id);
  if (student) {
    return {
      id: student.ID, name: student.Name, email: student.Email,
      course: student.Course, address: student.Address, beneficiary: student.Beneficiary,
      cp: student.CP, birthday: student.Birthday, blood: student.Blood,
      ms1: student.MS1, ms2: student.MS2, photoUrl: student.PhotoUrl,
    };
  }

  const admins = sheetToObjects_(ss.getSheetByName(SHEET_NAMES.ADMINS));
  const admin = admins.find(r => String(r.ID) === id);
  if (admin) {
    return {
      id: admin.ID, name: admin.Name, email: admin.Email, rank: admin.Rank,
      role: admin.Role, address: admin.Address, cp: admin.CP, photoUrl: admin.PhotoUrl,
    };
  }

  throw new Error("Profile not found.");
}

function updateProfile(payload) {
  const id = String(payload.id || "").trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let photoUrl = null;
  if (payload.photoBase64) photoUrl = savePhoto_(payload.photoBase64, id);

  const studentSheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
  const studentRow = findRowIndexByField_(studentSheet, "ID", id);
  if (studentRow) {
    const map = {
      Name: payload.name, Course: payload.course, Address: payload.address,
      Beneficiary: payload.beneficiary, CP: payload.cp, Birthday: payload.birthday,
      Blood: payload.blood,
    };
    if (photoUrl) map.PhotoUrl = photoUrl;
    updateRow_(studentSheet, STUDENT_HEADERS, studentRow, map);
    return { updated: true };
  }

  const adminSheet = ss.getSheetByName(SHEET_NAMES.ADMINS);
  const adminRow = findRowIndexByField_(adminSheet, "ID", id);
  if (adminRow) {
    const map = {
      Name: payload.name, Rank: payload.rank, Role: payload.role,
      Address: payload.address, CP: payload.cp,
    };
    if (photoUrl) map.PhotoUrl = photoUrl;
    updateRow_(adminSheet, ADMIN_HEADERS, adminRow, map);
    return { updated: true };
  }

  throw new Error("Profile not found.");
}

function savePhoto_(base64DataUrl, ownerId) {
  const match = base64DataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("Invalid photo data.");
  const contentType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(bytes, contentType, ownerId + "-photo");

  const folderName = "ROTC Cadet Photos";
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/uc?id=" + file.getId();
}

// ---------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------
function getAnnouncements() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = sheetToObjects_(ss.getSheetByName(SHEET_NAMES.ANNOUNCEMENTS));
  return rows
    .map(r => ({ date: r.Date, title: r.Title, body: r.Body }))
    .reverse();
}

function saveAnnouncement(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  appendRow_(ss.getSheetByName(SHEET_NAMES.ANNOUNCEMENTS), ANNOUNCE_HEADERS, {
    Date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
    Title: payload.title, Body: payload.body,
  });
  return { saved: true };
}

// ---------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------
function createAttendanceSession(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SESSIONS);
  const token = [payload.type, payload.date, payload.time, Utilities.getUuid().slice(0, 8)].join("|");
  appendRow_(sheet, SESSION_HEADERS, {
    Token: token, Type: payload.type, Date: payload.date, Time: payload.time,
    CreatedAt: new Date().toISOString(),
  });
  return { token };
}

function recordAttendance(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sessions = sheetToObjects_(ss.getSheetByName(SHEET_NAMES.SESSIONS));
  const session = sessions.find(s => s.Token === payload.token);
  if (!session) throw new Error("This QR code is not valid or has expired.");
  if (session.Type !== payload.type) {
    throw new Error("Wrong QR code for this action.");
  }

  const sheet = ss.getSheetByName(SHEET_NAMES.ATTENDANCE);
  const rows = sheetToObjects_(sheet);
  let rowIndex = null;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].StudentID === payload.studentId && rows[i].Date === session.Date) {
      rowIndex = i + 2; // header + 1-index
      break;
    }
  }

  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm");

  if (rowIndex) {
    if (payload.type === "timein") {
      updateRow_(sheet, ATTEND_HEADERS, rowIndex, { TimeIn: now });
    } else {
      updateRow_(sheet, ATTEND_HEADERS, rowIndex, { TimeOut: now });
    }
  } else {
    appendRow_(sheet, ATTEND_HEADERS, {
      StudentID: payload.studentId, Name: payload.name, Date: session.Date,
      TimeIn: payload.type === "timein" ? now : "",
      TimeOut: payload.type === "timeout" ? now : "",
    });
  }

  return { message: (payload.type === "timein" ? "Time-In" : "Time-Out") + " recorded at " + now };
}

function getMyAttendance(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = sheetToObjects_(ss.getSheetByName(SHEET_NAMES.ATTENDANCE));
  return rows.filter(r => r.StudentID === payload.id)
    .map(r => ({ date: r.Date, timeIn: r.TimeIn, timeOut: r.TimeOut }));
}

function getAttendanceRecords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = sheetToObjects_(ss.getSheetByName(SHEET_NAMES.ATTENDANCE));
  return rows.map(r => ({
    id: r.StudentID, name: r.Name, date: r.Date, timeIn: r.TimeIn, timeOut: r.TimeOut,
  }));
}

// ---------------------------------------------------------------
// Admin: students
// ---------------------------------------------------------------
function getAllStudents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = sheetToObjects_(ss.getSheetByName(SHEET_NAMES.STUDENTS));
  return rows.map(r => ({
    id: r.ID, name: r.Name, email: r.Email, course: r.Course, address: r.Address,
    beneficiary: r.Beneficiary, cp: r.CP, status: r.Status, ms1: r.MS1, ms2: r.MS2,
  }));
}

function setStudentStatus(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
  const rowIndex = findRowIndexByField_(sheet, "ID", payload.id);
  if (!rowIndex) throw new Error("Student not found.");
  updateRow_(sheet, STUDENT_HEADERS, rowIndex, { Status: payload.status });
  return { updated: true };
}

function deleteStudent(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
  const rowIndex = findRowIndexByField_(sheet, "ID", payload.id);
  if (!rowIndex) throw new Error("Student not found.");
  sheet.deleteRow(rowIndex);
  return { deleted: true };
}

function updateStudentGrades(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
  const rowIndex = findRowIndexByField_(sheet, "ID", payload.id);
  if (!rowIndex) throw new Error("Student not found.");
  updateRow_(sheet, STUDENT_HEADERS, rowIndex, { MS1: payload.ms1, MS2: payload.ms2 });
  return { updated: true };
}

// ---------------------------------------------------------------
// Admin: officers roster
// ---------------------------------------------------------------
function getOfficers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = sheetToObjects_(ss.getSheetByName(SHEET_NAMES.OFFICERS));
  return rows.map(r => ({
    rank: r.Rank, name: r.Name, cp: r.CP, address: r.Address,
    role: r.Role, bankNo: r.BankNo, tinNo: r.TinNo,
  }));
}

function saveOfficers(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.OFFICERS);
  sheet.clear();
  sheet.appendRow(OFFICER_HEADERS);
  (payload.officers || []).forEach(o => {
    sheet.appendRow([o.rank, o.name, o.cp, o.address, o.role, o.bankNo, o.tinNo]);
  });
  return { saved: true };
}

// ---------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------
function sheetToObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function appendRow_(sheet, headers, dataObj) {
  const row = headers.map(h => (dataObj[h] !== undefined ? dataObj[h] : ""));
  sheet.appendRow(row);
}

function findRowIndexByField_(sheet, field, value) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const col = headers.indexOf(field);
  if (col === -1) return null;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][col]) === String(value)) return i + 1; // 1-indexed row
  }
  return null;
}

function updateRow_(sheet, headers, rowIndex, dataObj) {
  Object.keys(dataObj).forEach(key => {
    if (dataObj[key] === undefined) return;
    const col = headers.indexOf(key);
    if (col !== -1) sheet.getRange(rowIndex, col + 1).setValue(dataObj[key]);
  });
}

function hash_(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text));
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");
}
