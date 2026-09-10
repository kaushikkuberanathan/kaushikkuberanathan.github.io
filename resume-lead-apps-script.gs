// Google Apps Script — résumé lead capture + auto-email
//
// Setup (one-time):
// 1. Go to https://sheet.new to create a blank Google Sheet. Name it something
//    like "Resume Leads". Row 1 can stay empty — the script appends rows below it.
// 2. In that Sheet: Extensions > Apps Script.
// 3. Delete the default "Code.gs" contents and paste this entire file in.
// 4. Update RESUME_URL below if your résumé filename/path ever changes.
// 5. Click Deploy > New deployment > select type "Web app".
//    - Execute as: Me
//    - Who has access: Anyone
// 6. Click Deploy, authorize the requested Gmail/Sheets permissions (it's your
//    own script acting on your own account), then copy the Web app URL
//    (ends in /exec).
// 7. Paste that URL into index.html's résumé link, replacing
//    data-lead-endpoint="PASTE_APPS_SCRIPT_WEB_APP_URL_HERE".
//
// Every time someone submits their email on the site, this script:
//   - appends a row to the Sheet (timestamp, email, browser/device, referrer)
//   - fetches the live résumé PDF from the portfolio site and emails it to them

const RESUME_URL = 'https://kaushikkuberanathan.github.io/Kaushik%20Kuberanathan%20-%20Resume.pdf';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const email = String(body.email || '').trim();

    if (!isValidEmail(email)) {
      return jsonResponse({ status: 'error', message: 'Invalid email address' });
    }

    logRequest(email, String(body.userAgent || ''), String(body.referrer || ''));
    sendResumeEmail(email);

    return jsonResponse({ status: 'ok' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function logRequest(email, userAgent, referrer) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.appendRow([new Date(), email, userAgent, referrer]);
}

function sendResumeEmail(email) {
  const pdfBlob = UrlFetchApp.fetch(RESUME_URL).getBlob().setName('Kaushik Kuberanathan - Resume.pdf');
  MailApp.sendEmail({
    to: email,
    subject: "Kaushik Kuberanathan — Résumé",
    body:
      "Thanks for your interest — Kaushik's résumé is attached.\n\n" +
      'Portfolio: https://kaushikkuberanathan.github.io/',
    attachments: [pdfBlob],
    name: 'Kaushik Kuberanathan (Portfolio site)',
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
