/* =========================================================
   DMMMSU SLUC ROTC UNIT — API client
   Talks to the Google Apps Script Web App, which reads/writes
   your Google Sheet. See /apps-script/Code.gs for the backend
   and README.md for setup steps.
   ========================================================= */

// 1) After you deploy the Apps Script as a Web App, paste its
//    /exec URL here. Everything else in the site uses this.
<<<<<<< HEAD
const API_URL = "https://script.google.com/macros/s/AKfycbyoLBMgGBMsdtED-BRVrswP-OiYvuC0i0utwithrgdzjj2rPR86IaZ8qfrfjh2jd0kc/exec";


const ROTC = (() => {

  async function call(action, payload = {}) {
    if (!API_URL || API_URL.includes("PASTE_YOUR")) {
      throw new Error(
        "Backend not connected yet. Open assets/js/api.js and set API_URL " +
        "to your deployed Google Apps Script Web App URL."
      );
    }
    const res = await fetch(API_URL, {
      method: "POST",
      // text/plain avoids a CORS preflight against Apps Script
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload }),
    });
    if (!res.ok) throw new Error("Network error: " + res.status);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Request failed");
    return data.result;
  }

  // ---------- session helpers (simple client-side session) ----------
  function saveSession(user) {
    sessionStorage.setItem("rotc_user", JSON.stringify(user));
  }
  function getSession() {
    try { return JSON.parse(sessionStorage.getItem("rotc_user")); }
    catch { return null; }
  }
  function clearSession() { sessionStorage.removeItem("rotc_user"); }

  function requireRole(role) {
    const u = getSession();
    if (!u || u.role !== role) {
      window.location.href = "/login.html";
      return null;
    }
    return u;
  }

  return {
    // auth
    enroll: (payload) => call("enroll", payload),
    login: (payload) => call("login", payload),

    // student self-service
    getProfile: (id) => call("getProfile", { id }),
    updateProfile: (payload) => call("updateProfile", payload),
    getAnnouncements: () => call("getAnnouncements"),

    // attendance
    recordAttendance: (payload) => call("recordAttendance", payload),
    getMyAttendance: (id) => call("getMyAttendance", { id }),
    createAttendanceSession: (payload) => call("createAttendanceSession", payload),
    getAttendanceRecords: () => call("getAttendanceRecords"),

    // admin: students
    getAllStudents: () => call("getAllStudents"),
    setStudentStatus: (payload) => call("setStudentStatus", payload),
    deleteStudent: (payload) => call("deleteStudent", payload),
    updateStudentGrades: (payload) => call("updateStudentGrades", payload),

    // admin: officers
    getOfficers: () => call("getOfficers"),
    saveOfficers: (payload) => call("saveOfficers", payload),

    // admin: announcements
    saveAnnouncement: (payload) => call("saveAnnouncement", payload),

    // session
    saveSession, getSession, clearSession, requireRole,
  };
})();
