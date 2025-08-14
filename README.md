# Taskify It - AI Study Planner

Taskify It converts syllabus PDFs into actionable study plans using an Express backend and a React frontend. The app extracts syllabus text, uses an AI agent to structure content and generate modules/tasks, and provides client-side tools to plan, track, and export study work.

## What changed / New & notable features
- Server-side agent pipeline that processes syllabus PDFs asynchronously (Extract -> Structure -> Plan -> Save).
- Job-based processing with status polling and retry support (`/agent/syllabus-plan/start`, `/agent/jobs/:jobId`).
- Improved server security and reliability: Helmet, data sanitization, compression, enhanced CORS, graceful shutdown.
- PDF upload endpoint with validation and size limits (`/upload-pdf`).
- Direct AI generation endpoint for unauthenticated users (`/generate-tasks`).
- Authentication and account features: register, login, password reset, protected `/me` endpoint and history saving.
- Persistent history storage in MongoDB and a client-side history view.
- Client-side features: PDF upload, agent integration, auto-suggested deadlines, dark mode, progress tracking, overdue detection, rescheduling, and export-to-PDF.

## Architecture
- Client: React app in `client/` (components, modals, auth flows, localStorage persistence).
- Server: Express app in `server/` (routes for auth, agent, history; PDF parsing; Gemini API integration; Puppeteer for PDF export).
- Database: MongoDB (Mongoose models for users and history entries).

## Client features
- Upload syllabus PDF and extract text.
- Start an authenticated agent job to generate a detailed study plan (async with job polling).
- Fallback: unauthenticated users can use `/generate-tasks` to get immediate plans.
- Modules/tasks list with checkboxes to mark progress.
- Assign deadlines to tasks, auto-suggested dates, overdue detection and quick reschedule.
- Dashboard with completion percentage and estimated upcoming deadlines.
- Local persistence via `localStorage` (modules, checked tasks, task dates, dark mode, syllabus text).
- Export study plan to PDF from the client view.
- Authentication UI: register, login, forgot/reset password flows.

## Server features
- Endpoints:
  - `GET /health` — health check
  - `POST /upload-pdf` — upload a PDF, server parses and returns extracted text
  - `POST /generate-tasks` — generate tasks directly from syllabus text (uses Gemini)
  - `POST /agent/syllabus-plan/start` — authenticated start for async agent processing
  - `GET /agent/jobs/:jobId` — check job status (authenticated)
  - `POST /agent/jobs/:jobId/retry` — retry failed job steps (authenticated)
  - `/auth` routes for register, login, forgot/reset password and `/auth/me`
  - `/history` routes to save and view generated plans
- Uses `multer` for uploads, `pdf-parse` for extracting text, Axios to call Gemini, Puppeteer for PDF generation, and Mongoose for persistence.
- Input validation, rate limiting on auth routes, and careful JSON parsing of AI responses with error handling.

## Security & reliability
- Helmet headers, express-mongo-sanitize, xss-clean, and compression are enabled server-side.
- CORS is configured to allow local dev, common hosting providers (Vercel/Render), and a production `CLIENT_URL` env var.
- Uploads are limited to PDF files under 10 MB.

## Environment variables
Create a `.env` file for local development with at least these keys:

- `MONGO_URI` — MongoDB connection string
- `GEMINI_API_KEY` — API key for the Gemini generative language model
- `CLIENT_URL` — URL of the frontend (used by some email links / CORS)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` — (optional) for password reset emails
- `NODE_ENV` — `development` or `production`

## Run locally (basic)
Open a PowerShell terminal and run:

```powershell
cd client; npm install
cd ..\server; npm install

# Start server (from server folder)
cd server; npm run start

# Start client (from client folder)
cd ..\client; npm start
```

Notes:
- The exact `start` scripts depend on this repo's `package.json` in `client/` and `server/`. If a different script is specified (e.g., `dev`), use that instead.
- Ensure `.env` in `server/` contains `MONGO_URI` and `GEMINI_API_KEY` before starting the server.

## Quick API usage
- Upload PDF and get extracted text:

  POST /upload-pdf (multipart/form-data, field `pdf`) -> { data: { text, numPages, info } }

- Generate tasks (unauthenticated):

  POST /generate-tasks { syllabusText }

- Start authenticated agent job:

  POST /agent/syllabus-plan/start { pdfText } (Bearer token required) -> { jobId }

  Poll job status: GET /agent/jobs/:jobId (Bearer token)

## Troubleshooting
- If uploads fail with file size errors, ensure the PDF is under 10 MB.
- If AI responses fail to parse, check that `GEMINI_API_KEY` is valid and network access to the API is available.
- For email/password reset to work, configure the email env vars or use a development mail provider.

## Contributing
- Report issues or open PRs. Follow existing code style when modifying components or server routes.

## License
- See `package.json` for license information.
