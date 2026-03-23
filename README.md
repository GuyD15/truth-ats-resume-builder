# Truth ATS Resume Builder

Static web app that tailors an uploaded resume to a target job while keeping content truthful.

## Live usage

- Upload your current resume (`txt`, `md`, `pdf`, `docx`)
- Add a target role by job URL or job title
- Optionally paste a full job description for better ATS keyword matching
- Download tailored output as TXT, DOCX, or PDF

## Truth-first guardrails

- Reorders and highlights only existing resume facts
- Does not invent employers, responsibilities, dates, or achievements
- Lists missing keywords as learning gaps instead of fabricated claims

## Local run (optional)

Open `index.html` in any modern browser.

## Full-stack version

A separate full-stack (React + Express) implementation exists in local workspace folders `client/` and `server/`.

## Deployment notes

GitHub Pages deploys from `.github/workflows/pages.yml` on pushes to `main`.
