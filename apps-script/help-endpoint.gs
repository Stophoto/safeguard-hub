/* ═══════════════════════════════════════════════════════════════════════════
   Safeguard Hub — "Have a question?" help-question endpoint (Apps Script)

   WHAT THIS IS
   The shared help component on the Hub (sg-nav.js → window.SGHelp) POSTs a
   volunteer's question to the existing Apps Script web app. This file is the
   handler for that POST. It emails the question to the Safeguard administrator
   and (optionally) logs a row to a "Help Questions" tab in the Sheet.

   The POST body is JSON:
     { "type": "help_question", "name": "...", "email": "...",
       "topic": "...", "message": "..." }
   sent with Content-Type: text/plain and redirect: follow (same transport the
   rest of the Hub already uses).

   ─────────────────────────────────────────────────────────────────────────────
   INSTALL (one-time, by the Hub owner)
   1. Open the "Safeguard Framework — Data" spreadsheet → Extensions → Apps Script.
   2. This is an EXTENSION of your existing backend's doPost — you have two
      options:
        A) If you have a single doPost already (the Hub backend), add ONE line
           near the top of its try-block, BEFORE the password/action routing:

               if (data.type === "help_question") return handleHelpQuestion(data);

           then paste the handleHelpQuestion + helpQuestion_* helpers below into
           the same project. (Help questions carry no password — they are a
           public "contact the administrator" form, so they must be handled
           before the password check.)

        B) If this is a standalone deployment, paste this whole file as-is; the
           doPost here will route help questions and reject anything else.
   3. Fill in HELP_RECIPIENT below with the administrator's email address.
   4. Deploy → New deployment → Web app → Execute as "Me" → Who has access
      "Anyone". (After ANY code change you must create a NEW deployment.)
   5. The web app URL must match the one in sg-nav.js (BACKEND_URL). If you
      deploy a brand-new URL, update BACKEND_URL in sg-nav.js to match.

   PRIVACY NOTE: the recipient address lives ONLY here, server-side. It is never
   sent to the browser and never appears in client code.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Configuration ──────────────────────────────────────────────────────────
// REQUIRED: the Safeguard administrator's email address. Fill this in.
var HELP_RECIPIENT = "REPLACE_WITH_ADMINISTRATOR_EMAIL@example.com";

// Optional: the Sheet tab to log questions into. Leave as-is to enable logging;
// the tab is created automatically on first use. Set to "" to disable logging.
var HELP_LOG_TAB = "Help Questions";

// ─── Entry point ────────────────────────────────────────────────────────────
// If you already have a doPost, do NOT paste this one — instead add the routing
// line described in step 2A above and keep just the handler + helpers.
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Public contact form — handled before any password/action routing.
    if (data.type === "help_question") {
      return handleHelpQuestion(data);
    }

    // (Your existing action routing would continue here.)
    return helpQuestion_respond({
      success: false,
      error: "UNKNOWN_TYPE",
      message: "Unsupported request."
    });
  } catch (err) {
    return helpQuestion_respond({
      success: false,
      error: "SERVER_ERROR",
      message: err.toString()
    });
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────
function handleHelpQuestion(data) {
  var name = (data.name || "").toString().trim();
  var email = (data.email || "").toString().trim();
  var topic = (data.topic || "").toString().trim();
  var message = (data.message || "").toString().trim();

  // Message is the one field the volunteer must complete.
  if (!message) {
    return helpQuestion_respond({
      success: false,
      error: "MISSING_MESSAGE",
      message: "A question is required."
    });
  }

  var displayName = name || "A volunteer";
  var contact = email || "no email provided";
  var topicLine = topic || "not specified";

  var subject = "New volunteer question — " + displayName;
  var body =
    displayName + " (" + contact + ") sent a question from the Safeguard Hub.\n" +
    "About: " + topicLine + "\n\n" +
    "Question:\n" + message + "\n\n" +
    "Reply directly to this email to reach them.";

  try {
    var options = {};
    // Reply-To = the submitter, so the administrator can just hit Reply.
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      options.replyTo = email;
    }
    MailApp.sendEmail(HELP_RECIPIENT, subject, body, options);
  } catch (err) {
    return helpQuestion_respond({
      success: false,
      error: "EMAIL_FAILED",
      message: "Could not send the email: " + err.toString()
    });
  }

  // Best-effort logging — never fail the request if the Sheet write hiccups.
  helpQuestion_logRow(name, email, topic, message);

  return helpQuestion_respond({ success: true, message: "Question sent." });
}

// ─── Optional Sheet logging ──────────────────────────────────────────────────
function helpQuestion_logRow(name, email, topic, message) {
  if (!HELP_LOG_TAB) return;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    var sheet = ss.getSheetByName(HELP_LOG_TAB);
    if (!sheet) {
      sheet = ss.insertSheet(HELP_LOG_TAB);
      sheet.appendRow(["Timestamp", "Name", "Email", "Topic", "Message"]);
    }
    sheet.appendRow([new Date(), name, email, topic || "not specified", message]);
  } catch (err) {
    // Logging is best-effort; swallow so the email still counts as success.
  }
}

// ─── Response helper ─────────────────────────────────────────────────────────
// Matches the existing backend's JSON response shape.
function helpQuestion_respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
