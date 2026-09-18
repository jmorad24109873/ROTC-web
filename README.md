# DMMMSU SLUC ROTC Unit — Website

A website for the DMMMSU-SLUC ROTC Unit: public landing page, cadet enrollment,
login, a student dashboard (announcements, QR attendance, profile with grades),
and an admin dashboard (approve enrollments, manage officers, generate
attendance QR codes, view attendance records).

**Stack:** plain HTML/CSS/JS (works on GitHub Pages, no build step) +
**Google Sheets as the database**, accessed through a Google Apps Script Web
App that acts as the backend API.

---

## 1. Set up the database (Google Sheets + Apps Script)

1. Go to [sheets.google.com](https://sheets.google.com) and create a new,
   blank spreadsheet. Name it something like `ROTC Database`.
2. In the sheet, go to **Extensions > Apps Script**.
3. Delete the placeholder `Code.gs` content and paste in the contents of
   this project's `apps-script/Code.gs` file.
4. In the Apps Script editor toolbar, select the function `initializeSheets`
   from the dropdown next to the "Run" (▶) button, and click **Run**.
   - The first time, Google will ask you to authorize the script — approve it
     (click "Advanced" > "Go to project (unsafe)" if you see a warning; this
     is expected for your own script).
   - This creates all the tabs you need (`Students`, `Officers`, `Admins`,
     `Sessions`, `Attendance`, `Announcements`) with the right headers, and
     one starter admin login:
     - **Email:** `admin@rotc.local`
     - **Password:** `admin123`
   - Change that password (edit the `Admins` sheet row directly, or add an
     "edit password" flow later) once you're up and running.
5. Click **Deploy > New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, then **authorize** again if asked.
   - Copy the **Web app URL** (it ends in `/exec`).

## 2. Connect the frontend to the backend

1. Open `assets/js/api.js` in VS Code.
2. Replace:
   ```js
   const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
   ```
   with your deployed `/exec` URL.

That's it — every page (`login.html`, `enroll.html`, the student pages, the
admin pages) calls through this one file.

> Whenever you edit `Code.gs` later, you must go to **Deploy > Manage
> deployments > Edit (pencil) > New version > Deploy** for the changes to go
> live at the same URL.

## 3. Run it locally in VS Code

No build step needed. Easiest options:
- Install the **Live Server** extension in VS Code, right-click `index.html`,
  and choose "Open with Live Server".
- Or run `python3 -m http.server` in the project folder and open
  `http://localhost:8000`.

## 4. Put it on GitHub / GitHub Pages

```bash
git init
git add .
git commit -m "Initial ROTC unit website"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Then in the GitHub repo: **Settings > Pages > Source: Deploy from branch >
main / (root)**. Your site will be live at
`https://<your-username>.github.io/<your-repo>/`.

## Project structure

```
index.html                    Landing page
enroll.html                   Cadet enrollment form
login.html                    Login (routes to student or admin dashboard)
student-home.html             Student: announcements
student-attendance.html       Student: scan QR to time in/out (camera)
student-profile.html          Student: profile + grades + photo
student-about.html            Student: about the unit
admin-home.html                Admin: links to student & officer management
admin-students.html           Admin: approve/decline/delete/grade students
admin-officers.html           Admin: instructors & officers roster
admin-attendance.html         Admin: generate Time-In/Time-Out QR codes
admin-attendance-records.html Admin: attendance log
admin-profile.html            Admin: own profile
admin-about.html              Admin: about the unit
assets/css/style.css          Shared styling (colors match the mockups)
assets/js/api.js              Talks to the Apps Script backend + session helpers
assets/img/                   Logos
apps-script/Code.gs           Backend — paste into Google Sheets > Apps Script
```

## How attendance works

1. On **Attendance** (admin), the admin picks a date/time and clicks
   **Create QR Code** for Time-In or Time-Out. This creates a one-time
   "session" row in the `Sessions` sheet and renders it as a QR code
   (the QR just encodes a token, no camera/photo data).
2. A cadet on the **Attendance** page (student) taps **Open Camera for
   Time-In** (or **Time-Out**), which opens their device camera in-browser
   (via the `html5-qrcode` library) and scans that QR code.
3. The scan sends the cadet's ID + the token to the backend, which looks up
   the session and stamps the cadet's row in the `Attendance` sheet with the
   current time.

## Notes & next steps

- Passwords are stored as SHA-256 hashes, not plaintext — reasonable for a
  school project, but this is not a substitute for a real auth provider if
  this ever needs production-grade security.
- Since **Who has access: Anyone** is required for the frontend to reach the
  Apps Script Web App, avoid putting sensitive data you don't want anyone
  with the URL to reach through the API actions in `Code.gs`.
- Photos uploaded from the Profile pages are saved to a Google Drive folder
  named "ROTC Cadet Photos" (auto-created) and linked by URL.
- `saveAnnouncement` exists in the backend/API client so you can post
  announcements (e.g., by calling it from the Apps Script editor's console,
  or you can wire up a small admin form later); the student Home page
  already reads and displays them.
