# MRANTI Workspace — AI Brain Full Production Package

## Contents

### Frontend

- Approved login retained
- CRM-sibling authenticated shell
- Live Drive, Docs, Sheets, Slides, Gmail and Calendar conversations
- Live Google Workspace link permission checks
- Real Slides metadata, slide text and thumbnails
- Firestore-persisted conversations and validation jobs
- Live Gemini claim extraction and Google Search-grounded validation
- Evidence Inspector with real internal and external source links
- Explicitly confirmed Google Slides revisions
- Citation-footnote insertion
- Report and source-appendix export to Google Drive
- Responsive desktop, tablet and mobile layouts

### Backend

`BrainT_MRANTI_Full_Production.json` is a complete import-ready n8n workflow. It preserves the original search, document-analysis and health services and adds the production AI Brain endpoints.

### Security

- Authorised `@mranti.my` accounts only
- Per-user Google OAuth tokens
- Google returns only content already accessible to the employee
- Firebase ID-token verification on every protected endpoint
- Read scopes at login; write scopes requested only for confirmed actions
- Firestore rules isolate each user's conversations and jobs
- n8n execution-data saving disabled
- No credentials embedded in the frontend or workflow export

## Required action

Follow `PRODUCTION_SETUP.md` before deployment. The frontend will not fabricate fallback data if a backend service or permission is missing; it will show an honest error state instead.
