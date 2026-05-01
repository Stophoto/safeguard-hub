# Safeguard Hub Retention Policy

## Abuse Reports

Suspected abuse reports are retained until the subject reaches age 25, plus 7 years.

Every abuse report is created with `legalHold: true` by default. Version 1 does not auto-delete abuse reports. Any deletion, export, or legal-hold release must be designed and approved in a later governance review before it is implemented.

## Phase A Limitation

Phase A does not automate retention calculation because the report subject's date of birth is embedded in submitted form data, not yet normalized into a trusted field. Until Phase B or a later data model update, retention review is manual.
