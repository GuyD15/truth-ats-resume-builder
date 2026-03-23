import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs";

const els = {
  resumeFile: document.getElementById("resumeFile"),
  jobUrl: document.getElementById("jobUrl"),
  jobTitle: document.getElementById("jobTitle"),
  jobPaste: document.getElementById("jobPaste"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  downloadDocxBtn: document.getElementById("downloadDocxBtn"),
  downloadPdfBtn: document.getElementById("downloadPdfBtn"),
  status: document.getElementById("status"),
  scoreValue: document.getElementById("scoreValue"),
  matchCount: document.getElementById("matchCount"),
  tailoredOutput: document.getElementById("tailoredOutput"),
  missingList: document.getElementById("missingList"),
  urlInputGroup: document.getElementById("urlInputGroup"),
  titleInputGroup: document.getElementById("titleInputGroup"),
};

let lastOutputText = "";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "at",
  "by",
  "from",
  "is",
  "are",
  "be",
  "as",
  "that",
  "this",
  "will",
  "your",
  "you",
  "our",
  "we",
  "their",
  "they",
  "job",
  "role",
  "position",
  "years",
  "year",
  "plus",
  "required",
  "preferred",
  "experience",
  "ability",
]);

const TITLE_KEYWORDS = {
  "software engineer": [
    "javascript",
    "typescript",
    "python",
    "api",
    "debugging",
    "testing",
    "git",
    "sql",
    "agile",
    "performance",
    "backend",
    "frontend",
  ],
  "data analyst": [
    "sql",
    "excel",
    "python",
    "dashboard",
    "tableau",
    "power bi",
    "reporting",
    "statistics",
    "kpi",
    "analysis",
  ],
  "project manager": [
    "stakeholder",
    "roadmap",
    "timeline",
    "budget",
    "risk",
    "scope",
    "agile",
    "scrum",
    "communication",
    "delivery",
  ],
  "product manager": [
    "roadmap",
    "user research",
    "kpi",
    "requirements",
    "prioritization",
    "experimentation",
    "stakeholder",
    "go-to-market",
  ],
  "marketing manager": [
    "seo",
    "sem",
    "content",
    "campaign",
    "analytics",
    "conversion",
    "a/b testing",
    "brand",
  ],
};

for (const radio of document.querySelectorAll('input[name="jobMode"]')) {
  radio.addEventListener("change", handleModeChange);
}

els.analyzeBtn.addEventListener("click", onAnalyze);
els.downloadBtn.addEventListener("click", onDownloadTxt);
els.downloadDocxBtn.addEventListener("click", onDownloadDocx);
els.downloadPdfBtn.addEventListener("click", onDownloadPdf);

function handleModeChange() {
  const mode = getJobMode();
  const urlMode = mode === "url";
  els.urlInputGroup.classList.toggle("hidden", !urlMode);
  els.titleInputGroup.classList.toggle("hidden", urlMode);
}

function getJobMode() {
  return document.querySelector('input[name="jobMode"]:checked')?.value || "url";
}

async function onAnalyze() {
  try {
    setStatus("Reading resume...");
    els.downloadBtn.disabled = true;
    els.downloadDocxBtn.disabled = true;
    els.downloadPdfBtn.disabled = true;

    const resumeText = await parseResumeFromUpload();
    if (!resumeText.trim()) {
      throw new Error("Could not read resume text. Try another file format.");
    }

    setStatus("Collecting job target details...");
    const jobDetails = await getJobTargetText();
    if (!jobDetails.combinedText.trim()) {
      throw new Error("Provide a job URL, job title, or pasted description.");
    }

    setStatus("Tailoring resume using only existing facts...");
    const result = tailorResumeTruthfully(resumeText, jobDetails);

    renderResult(result);
    lastOutputText = result.tailoredText;
    els.downloadBtn.disabled = false;
    els.downloadDocxBtn.disabled = false;
    els.downloadPdfBtn.disabled = false;
    setStatus("Tailoring complete.");
  } catch (error) {
    setStatus(error.message || "Something went wrong.");
  }
}

async function parseResumeFromUpload() {
  const file = els.resumeFile.files?.[0];
  if (!file) {
    throw new Error("Upload your current resume first.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "";

  if (extension === "txt" || extension === "md") {
    return await file.text();
  }

  if (extension === "pdf") {
    return await parsePdf(file);
  }

  if (extension === "docx") {
    return await parseDocx(file);
  }

  throw new Error("Unsupported file type. Use TXT, MD, PDF, or DOCX.");
}

async function parsePdf(file) {
  const bytes = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = content.items.map((item) => item.str).join(" ");
    pages.push(line);
  }

  return pages.join("\n");
}

async function parseDocx(file) {
  const bytes = await file.arrayBuffer();
  if (!window.mammoth) {
    throw new Error("DOCX parser failed to load.");
  }
  const result = await window.mammoth.extractRawText({ arrayBuffer: bytes });
  return result.value || "";
}

async function getJobTargetText() {
  const mode = getJobMode();
  const pasted = (els.jobPaste.value || "").trim();
  let fetchedText = "";
  let sourceLabel = "";

  if (mode === "url") {
    const url = (els.jobUrl.value || "").trim();
    if (url) {
      sourceLabel = url;
      fetchedText = await fetchJobTextByUrl(url);
    }
  } else {
    const title = (els.jobTitle.value || "").trim();
    if (title) {
      sourceLabel = title;
      fetchedText = buildSyntheticTextFromTitle(title);
    }
  }

  const combinedText = [fetchedText, pasted].filter(Boolean).join("\n\n");
  return { mode, sourceLabel, fetchedText, pastedText: pasted, combinedText };
}

async function fetchJobTextByUrl(url) {
  const normalized = normalizeUrl(url);
  const readerUrl = `https://r.jina.ai/http://${normalized.replace(/^https?:\/\//i, "")}`;

  const readerRes = await fetch(readerUrl);
  if (readerRes.ok) {
    const readerText = await readerRes.text();
    return sanitizeText(readerText);
  }

  const directRes = await fetch(normalized, { mode: "cors" });
  if (!directRes.ok) {
    throw new Error("Could not read the job URL. Paste the description manually.");
  }

  const html = await directRes.text();
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  return sanitizeText(cleaned);
}

function buildSyntheticTextFromTitle(title) {
  const lower = title.toLowerCase();
  let matchedKeywords = [];

  for (const [role, words] of Object.entries(TITLE_KEYWORDS)) {
    if (lower.includes(role)) {
      matchedKeywords = matchedKeywords.concat(words);
    }
  }

  const deduped = [...new Set(matchedKeywords)];
  return `${title}\n${deduped.join(" ")}`;
}

function normalizeUrl(raw) {
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
}

function sanitizeText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tailorResumeTruthfully(resumeText, jobDetails) {
  const normalizedResume = sanitizeText(resumeText);
  const sections = splitSections(normalizedResume);

  const jobKeywords = extractKeywords(jobDetails.combinedText, 80);
  const resumeKeywords = extractKeywords(normalizedResume, 260);
  const resumeKeywordSet = new Set(resumeKeywords);

  const matchedKeywords = jobKeywords.filter((word) => resumeKeywordSet.has(word));
  const missingKeywords = jobKeywords.filter((word) => !resumeKeywordSet.has(word));

  const score = jobKeywords.length
    ? Math.round((matchedKeywords.length / jobKeywords.length) * 100)
    : 0;

  const summaryText = buildSummary(sections, matchedKeywords, jobDetails);
  const skillsText = buildSkillSection(sections, matchedKeywords);
  const experienceText = buildExperienceSection(sections, matchedKeywords);
  const educationText = sections.education?.join("\n") || "";
  const certText = sections.certifications?.join("\n") || "";
  const projectsText = sections.projects?.join("\n") || "";

  const parts = [];
  parts.push("TAILORED RESUME (TRUTH-FIRST)");
  parts.push("This output only re-orders and reframes details found in your original resume.");
  parts.push("");

  if (summaryText) {
    parts.push("PROFESSIONAL SUMMARY");
    parts.push(summaryText);
    parts.push("");
  }

  if (skillsText) {
    parts.push("TARGETED SKILLS");
    parts.push(skillsText);
    parts.push("");
  }

  if (experienceText) {
    parts.push("EXPERIENCE HIGHLIGHTS");
    parts.push(experienceText);
    parts.push("");
  }

  if (projectsText) {
    parts.push("PROJECTS");
    parts.push(projectsText);
    parts.push("");
  }

  if (educationText) {
    parts.push("EDUCATION");
    parts.push(educationText);
    parts.push("");
  }

  if (certText) {
    parts.push("CERTIFICATIONS");
    parts.push(certText);
    parts.push("");
  }

  parts.push("ATS ALIGNMENT");
  parts.push(`Matched keywords: ${matchedKeywords.slice(0, 35).join(", ") || "none detected"}`);
  parts.push(`Potential gaps to study: ${missingKeywords.slice(0, 35).join(", ") || "none"}`);

  return {
    score,
    matchedKeywords,
    missingKeywords: missingKeywords.slice(0, 20),
    tailoredText: parts.join("\n").trim(),
  };
}

function splitSections(text) {
  const lines = text.split("\n").map((line) => line.trim());
  const sections = {
    summary: [],
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    other: [],
  };

  let current = "other";
  for (const line of lines) {
    if (!line) {
      continue;
    }
    const key = detectSectionKey(line);
    if (key) {
      current = key;
      continue;
    }
    sections[current].push(line);
  }

  if (!sections.summary.length) {
    sections.summary = sections.other.slice(0, 3);
  }

  return sections;
}

function detectSectionKey(line) {
  const s = line.toLowerCase();
  if (/^summary|professional summary|profile$/.test(s)) return "summary";
  if (/^skills|technical skills|core competencies$/.test(s)) return "skills";
  if (/^experience|work experience|employment history$/.test(s)) return "experience";
  if (/^education$/.test(s)) return "education";
  if (/^projects?$/.test(s)) return "projects";
  if (/^certifications?$/.test(s)) return "certifications";
  return "";
}

function extractKeywords(text, maxCount) {
  const wordList = text
    .toLowerCase()
    .replace(/[^a-z0-9+.#/\-\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .filter((word) => !STOPWORDS.has(word));

  const frequencies = new Map();
  for (const word of wordList) {
    frequencies.set(word, (frequencies.get(word) || 0) + 1);
  }

  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([word]) => word);
}

function buildSummary(sections, matchedKeywords, jobDetails) {
  const baseSummary = sections.summary.join(" ").trim();
  const summarySeed = baseSummary || sections.experience.slice(0, 2).join(" ");

  if (!summarySeed) {
    return "";
  }

  const highlights = matchedKeywords.slice(0, 8).join(", ");
  const targetLabel = jobDetails.sourceLabel ? `Target role: ${jobDetails.sourceLabel}.` : "";

  return `${summarySeed} ${targetLabel} Strong overlap areas: ${highlights || "transferable execution and collaboration"}.`.trim();
}

function buildSkillSection(sections, matchedKeywords) {
  const skillLines = sections.skills.join(" ");
  const explicitSkills = skillLines
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const selected = matchedKeywords
    .filter((word) => explicitSkills.some((skill) => skill.toLowerCase().includes(word)))
    .slice(0, 18);

  const merged = [...new Set([...selected, ...explicitSkills.slice(0, 18)])];
  return merged.join(", ");
}

function buildExperienceSection(sections, matchedKeywords) {
  const lines = sections.experience;
  if (!lines.length) {
    return "";
  }

  const bullets = lines
    .flatMap((line) => splitPotentialBullets(line))
    .map((text) => text.trim())
    .filter((text) => text.length > 8);

  const scored = bullets.map((bullet) => ({
    bullet,
    score: scoreBullet(bullet, matchedKeywords),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, 12)
    .map((item) => `- ${normalizeBullet(item.bullet)}`)
    .join("\n");
}

function splitPotentialBullets(line) {
  if (/^[\-*•]/.test(line)) {
    return [line.replace(/^[\-*•]\s*/, "")];
  }

  if (line.includes(";")) {
    return line.split(";");
  }

  if (line.includes(". ")) {
    return line.split(". ");
  }

  return [line];
}

function scoreBullet(bullet, matchedKeywords) {
  const lower = bullet.toLowerCase();
  let score = 0;

  for (const keyword of matchedKeywords) {
    if (lower.includes(keyword)) {
      score += 3;
    }
  }

  if (/\d/.test(bullet)) {
    score += 1;
  }

  if (/led|built|implemented|improved|managed|designed|optimized|delivered/.test(lower)) {
    score += 1;
  }

  return score;
}

function normalizeBullet(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "")
    .trim();
}

function renderResult(result) {
  els.scoreValue.textContent = `${result.score}%`;
  els.matchCount.textContent = `${result.matchedKeywords.length}`;
  els.tailoredOutput.textContent = result.tailoredText;

  els.missingList.innerHTML = "";
  if (!result.missingKeywords.length) {
    const li = document.createElement("li");
    li.textContent = "No major keyword gaps detected from the provided target job text.";
    els.missingList.append(li);
    return;
  }

  for (const word of result.missingKeywords) {
    const li = document.createElement("li");
    li.textContent = word;
    els.missingList.append(li);
  }
}

function onDownloadTxt() {
  if (!lastOutputText) {
    return;
  }

  const blob = new Blob([lastOutputText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "tailored_resume_truth_first.txt";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function onDownloadDocx() {
  if (!lastOutputText) {
    return;
  }

  if (!window.htmlDocx) {
    setStatus("DOCX export library failed to load.");
    return;
  }

  const html = textToSimpleHtml(lastOutputText);
  const docxBlob = window.htmlDocx.asBlob(html);
  downloadBlob(docxBlob, "tailored_resume_truth_first.docx");
}

function onDownloadPdf() {
  if (!lastOutputText) {
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    setStatus("PDF export library failed to load.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const marginY = 56;
  const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2;
  const lineHeight = 15;
  let y = marginY;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const lines = doc.splitTextToSize(lastOutputText, maxWidth);
  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - marginY) {
      doc.addPage();
      y = marginY;
    }
    doc.text(line, marginX, y);
    y += lineHeight;
  }

  doc.save("tailored_resume_truth_first.pdf");
}

function textToSimpleHtml(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const paragraphs = escaped
    .split("\n\n")
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("\n");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        font-family: Calibri, Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.4;
      }
      p {
        margin: 0 0 10pt 0;
      }
    </style>
  </head>
  <body>
    ${paragraphs}
  </body>
</html>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function setStatus(message) {
  els.status.textContent = message;
}
