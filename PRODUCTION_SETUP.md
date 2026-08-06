# MRANTI Workspace — AI Brain Production Setup

This package contains no mock records, invented evidence, simulated conversations or demo validation reports. Every populated result comes from the signed-in employee's authorised Google Workspace data, Gemini, Google Search grounding or Firestore.

## 1. Google Cloud APIs

Enable these APIs in the Google Cloud project used by `mranticrm`:

- Google Drive API
- Google Slides API
- Google Docs API
- Gmail API
- Google Calendar API
- Cloud Firestore API
- Generative Language API

Keep the OAuth application restricted to the MRANTI Google Workspace organisation.

## 2. OAuth scopes

The standard sign-in requests read-only access:

- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/presentations.readonly`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/calendar.readonly`

The application requests additional access only after explicit user action:

- Slides revision: `https://www.googleapis.com/auth/presentations`
- Save report/source appendix: `https://www.googleapis.com/auth/drive.file`
- Create Google Doc: `https://www.googleapis.com/auth/documents`

Add the same scopes to the OAuth consent-screen configuration and have the Google Workspace administrator trust the application.

## 3. Firestore

Create the default Firestore database in the `mranticrm` project, then publish `firestore.rules` from this package.

Collections are created automatically under each authenticated user:

```text
users/{uid}/conversations/{conversationId}
users/{uid}/validationJobs/{jobId}
```

The frontend uses Firebase Authentication and Firestore Security Rules. The n8n validation workflow updates the user's job document using the same short-lived Firebase ID token, so it remains subject to those rules.

## 4. n8n Gemini credential

Create an n8n **HTTP Header Auth** credential:

- Credential name: `Gemini API Key Header`
- Header name: `x-goog-api-key`
- Header value: your Gemini API key

After importing the workflow, open these three nodes and select that credential:

- `Call Gemini AI Brain Query`
- `Validation Extract Claims with Gemini`
- `Run Grounded Validation with Gemini`

The existing `Google Gemini(PaLM) Api account 5` credential remains attached to the original document-analysis node.

## 5. Import and activate n8n workflow

Import:

```text
BrainT_MRANTI_Full_Production.json
```

Review the existing Gemini credential mapping, map the new HTTP Header Auth credential, then activate the workflow.

The workflow exposes:

```text
POST /webhook/mranti-ai-brain-search
POST /webhook/mranti-ai-brain-document
POST /webhook/mranti-ai-brain-query
POST /webhook/mranti-ai-brain-workspace-file
POST /webhook/mranti-ai-brain-presentation
POST /webhook/mranti-ai-brain-validation-start
POST /webhook/mranti-ai-brain-revision-apply
POST /webhook/mranti-ai-brain-export
GET  /webhook/mranti-ai-brain-health
```

Execution-data saving remains disabled because requests contain short-lived user tokens.

## 6. GitHub Pages deployment

Upload every frontend file in this directory to the root of the `datamranti/mranti-workspace` repository, replacing the current files.

Required frontend files:

- `index.html`
- `styles.css`
- `app.js`
- `services.js`
- `ui-copy.js`
- `config.js`
- `site.webmanifest`
- all favicon, Apple and Android icon files
- `mranti-workspace-mark.png`

Do not upload `firestore.rules`, the n8n JSON or the setup documents to the public website unless you intentionally want those files public.

## 7. Production test sequence

1. Sign in with an authorised `@mranti.my` account.
2. Confirm the health badge shows an active connection.
3. Ask AI Brain to summarise unread email.
4. Ask what is on today's calendar.
5. Paste an authorised Google Slides link.
6. Confirm real presentation name, slide count and thumbnails load.
7. Select a slide and submit a validation request.
8. Confirm Firestore progress changes are real and the completed report contains live source URLs.
9. Open internal and external evidence links.
10. Review a revision, grant Slides write access and apply it to a test presentation.
11. Save the report and source appendix to Drive.
12. Confirm a user who lacks file permission receives a clear access error.
13. Confirm another MRANTI user cannot read the first user's Firestore conversations or jobs.

## 8. Operational limits

- Google Slides thumbnail URLs are temporary and may need to be refreshed when reopening an old conversation.
- Google API, Gemini and Google Search grounding quotas apply.
- A validation is only as strong as the available source material. The report explicitly retains uncertainty when a claim cannot be verified.
- Revisions use the presentation revision ID to reduce the risk of overwriting a presentation that changed after validation.
