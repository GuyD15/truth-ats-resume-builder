# Truth ATS Resume Builder

Full-stack ATS resume tailoring app with a truth-first constraint.

## Stack

- Frontend: React + TypeScript + Vite (`client/`)
- Backend: Express API (`server/`)
- Exports: TXT, DOCX, PDF

## Features

- Upload current resume (`.txt`, `.md`, `.pdf`, `.docx`)
- Provide target job by URL or job title
- Optional full job description paste for better keyword alignment
- Optional current-role job listing paste to generate latest-role update prompts
- Tailored output that only reorganizes and highlights existing resume facts
- ATS score + matched/missing keyword insights
- One-click download as TXT, DOCX, and PDF

## Truth-first safeguards

- No invented companies, titles, dates, metrics, tools, or responsibilities
- Missing keywords are shown as potential learning gaps only
- Tailoring focuses on ranking and reframing existing resume bullets

## Run locally

Install dependencies (already done in this workspace):

```powershell
cd "c:\Users\guywa\Resume builder"
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" --prefix client install
& "C:\Program Files\nodejs\npm.cmd" --prefix server install
```

Start both frontend and backend:

```powershell
cd "c:\Users\guywa\Resume builder"
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Default URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8787`

## Build

```powershell
cd "c:\Users\guywa\Resume builder\client"
& "C:\Program Files\nodejs\npm.cmd" run build
```

## Notes

- Some job pages block scraping due to bot/CORS protections. If that happens, paste the job description manually.
- If PowerShell blocks `npm`, use `npm.cmd` as shown above.
