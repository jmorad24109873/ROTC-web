/* =========================================================
   DMMMSU SLUC ROTC UNIT — API client
   Talks to the Google Apps Script Web App, which reads/writes
   your Google Sheet. See /apps-script/Code.gs for the backend
   and README.md for setup steps.
   ========================================================= */

// 1) After you deploy the Apps Script as a Web App, paste its
//    /exec URL here. Everything else in the site uses this.
const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

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
    const check = () => {
      const u = getSession();
      if (!u || u.role !== role) {
        window.location.href = "login.html";
        return null;
      }
      return u;
    };

    // Fix: hitting the browser Back/Forward button can restore a page from
    // the bfcache (a frozen snapshot) instead of reloading it, which skips
    // this login check entirely and can show a protected page again even
    // after logging out.
    //
    // 1) If a cached page does get restored, force a real reload so the
    //    check above runs again for real.
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        window.location.reload();
      }
    });
    // 2) An (empty) unload listener tells most browsers not to cache this
    //    page for back/forward at all, so Back goes to a fresh page load
    //    in the first place rather than a snapshot.
    window.addEventListener("unload", () => {});

    return check();
  }

  function requireSuperAdmin() {
    const u = requireRole("admin");
    if (u && !u.isSuperAdmin) {
      window.location.href = "admin-home.html";
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

    // super admin: manage admin accounts
    getAllAdmins: (payload) => call("getAllAdmins", payload),
    addAdmin: (payload) => call("addAdmin", payload),
    updateAdmin: (payload) => call("updateAdmin", payload),
    deleteAdmin: (payload) => call("deleteAdmin", payload),

    // session
    saveSession, getSession, clearSession, requireRole, requireSuperAdmin,
  };
})();
