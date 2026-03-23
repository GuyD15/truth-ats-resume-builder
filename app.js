import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs";

const els = {
  resumeFile: document.getElementById("resumeFile"),
  jobUrl: document.getElementById("jobUrl"),
  jobTitle: document.getElementById("jobTitle"),
  jobPaste: document.getElementById("jobPaste"),
  currentRoleUrl: document.getElementById("currentRoleUrl"),
  currentRoleTitle: document.getElementById("currentRoleTitle"),
  currentRoleStart: document.getElementById("currentRoleStart"),
  currentRoleTenure: document.getElementById("currentRoleTenure"),
  currentRoleListing: document.getElementById("currentRoleListing"),
  latestRoleDraft: document.getElementById("latestRoleDraft"),
  suggestionsList: document.getElementById("suggestionsList"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  loadDraftBtn: document.getElementById("loadDraftBtn"),
  applySuggestionsBtn: document.getElementById("applySuggestionsBtn"),
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
let lastLatestRoleDraftTemplate = "";
let lastSuggestions = [];
let lastResumeKeywordSet = new Set();
let lastFilteredJobKeywords = [];

const WEAK_KEYWORDS = new Set([
  "through",
  "trust",
  "prove",
  "many",
  "successful",
  "early",
  "across",
  "making",
  "drive",
  "vision",
  "mission",
  "within",
  "now",
  "book",
  "businesses",
]);

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
  "warning",
  "page",
  "url",
  "source",
  "http",
  "https",
  "markdown",
  "content",
  "loaded",
  "timeout",
  "captcha",
  "access",
  "authorized",
  "success",
  "title",
  "not",
  "yet",
  "fully",
  "consider",
  "explicitly",
  "specify",
  "requiring",
  "all",
  "any",
  "can",
  "could",
  "get",
  "got",
  "had",
  "has",
  "have",
  "just",
  "like",
  "made",
  "make",
  "more",
  "most",
  "much",
  "only",
  "other",
  "over",
  "same",
  "than",
  "then",
  "them",
  "there",
  "these",
  "those",
  "very",
  "was",
  "were",
  "while",
  "who",
  "why",
  "how",
]);

const SCRAPE_NOISE_PATTERNS = [
  /captcha/i,
  /access denied/i,
  /please (enable|verify|confirm)/i,
  /warning:/i,
  /not yet fully loaded/i,
  /cloudflare/i,
  /bot/i,
  /rate limit/i,
  /forbidden/i,
];

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

const ROLE_RESPONSIBILITY_LIBRARY = {
  retention: [
    "reduced churn and improved customer retention",
    "handled escalations and account-risk conversations",
    "used objection handling to save at-risk accounts",
    "documented root causes and follow-up actions in CRM",
  ],
  customer_service: [
    "resolved high-volume customer inquiries across channels",
    "improved first-contact resolution",
    "de-escalated complex complaints",
    "partnered with operations to close recurring issues",
  ],
  sales: [
    "managed pipeline and follow-up cadence",
    "qualified leads and advanced opportunities",
    "improved conversion through discovery and objection handling",
    "maintained CRM hygiene and reporting accuracy",
  ],
  operations: [
    "improved process consistency and handoffs",
    "created SOP updates based on recurring defects",
    "tracked KPI trends and action items",
    "coordinated cross-team issue resolution",
  ],
  manager: [
    "coached team members on performance and quality",
    "managed queue/coverage planning",
    "standardized workflows and accountability",
    "reported performance trends to leadership",
  ],
};

for (const radio of document.querySelectorAll('input[name="jobMode"]')) {
  radio.addEventListener("change", handleModeChange);
}

els.analyzeBtn.addEventListener("click", onAnalyze);
if (els.loadDraftBtn) {
  els.loadDraftBtn.addEventListener("click", onLoadDraftTemplate);
}
if (els.suggestionsList) {
  els.suggestionsList.addEventListener("click", onSuggestionListClick);
}
if (els.latestRoleDraft) {
  els.latestRoleDraft.addEventListener("input", refreshAtsFromDraft);
}
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

    setStatus("Reading current role listing context...");
    const currentRoleListingText = await getCurrentRoleListingText();

    if (jobDetails.fetchWarning) {
      setStatus(jobDetails.fetchWarning);
    }

    setStatus(jobDetails.fetchWarning
      ? `Note: ${jobDetails.fetchWarning} — tailoring now...`
      : "Tailoring resume using only existing facts...");

    const currentRoleMeta = buildCurrentRoleMeta(currentRoleListingText);
    const result = tailorResumeTruthfully(
      resumeText,
      jobDetails,
      currentRoleListingText,
      currentRoleMeta
    );

    renderResult(result);
    lastOutputText = result.tailoredText;
    lastLatestRoleDraftTemplate = result.latestRoleDraftTemplate || "";
    lastSuggestions = result.suggestions || [];
    lastResumeKeywordSet = new Set(result.scoringModel?.baseResumeKeywords || []);
    lastFilteredJobKeywords = result.scoringModel?.filteredJobKeywords || [];
    if (els.loadDraftBtn) {
      els.loadDraftBtn.disabled = !lastLatestRoleDraftTemplate;
    }
    renderSuggestions(lastSuggestions);
    refreshAtsFromDraft();
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
  let fetchWarning = "";

  if (mode === "url") {
    const url = (els.jobUrl.value || "").trim();
    if (url) {
      sourceLabel = url;
      try {
        fetchedText = await fetchJobTextByUrl(url);
      } catch {
        // Site blocked scraping — extract keywords from URL path as minimal fallback
        fetchedText = extractKeywordsFromUrl(url);
        fetchWarning = "Job URL could not be fetched (site may block scrapers). Using URL path keywords only. Paste the job description above for accurate results.";
      }
    }
  } else {
    const title = (els.jobTitle.value || "").trim();
    if (title) {
      sourceLabel = title;
      if (looksLikeUrl(title)) {
        try {
          fetchedText = await fetchJobTextByUrl(title);
        } catch {
          fetchedText = extractKeywordsFromUrl(title);
          fetchWarning = "Job URL could not be fetched (site may block scrapers). Paste the job description for accurate results.";
        }
      } else {
        fetchedText = buildSyntheticTextFromTitle(title);
      }
    }
  }

  const combinedText = [fetchedText, pasted].filter(Boolean).join("\n\n");
  return { mode, sourceLabel, fetchedText, pastedText: pasted, combinedText, fetchWarning };
}

async function getCurrentRoleListingText() {
  const urlVal = (els.currentRoleUrl?.value || "").trim();
  if (urlVal && looksLikeUrl(urlVal)) {
    try {
      const fetched = await fetchJobTextByUrl(urlVal);
      if (fetched) return fetched;
    } catch {
      // fall through to pasted text
    }
  }

  const raw = (els.currentRoleListing?.value || "").trim();
  if (!raw) return "";
  if (looksLikeUrl(raw)) {
    try {
      return await fetchJobTextByUrl(raw);
    } catch {
      return "";
    }
  }
  return raw;
}

async function fetchJobTextByUrl(url) {
  const normalized = normalizeUrl(url);
  const readerUrl = `https://r.jina.ai/${normalized}`;

  try {
    const readerRes = await fetch(readerUrl);
    if (readerRes.ok) {
      const readerText = await readerRes.text();
      const cleanedReader = cleanFetchedJobText(sanitizeText(readerText));
      if (!isLowSignalJobText(cleanedReader)) {
        return cleanedReader;
      }
    }
  } catch {
    // Fall back to direct fetch.
  }

  try {
    const directRes = await fetch(normalized, { mode: "cors" });
    if (!directRes.ok) {
      throw new Error("Could not read the job URL.");
    }

    const html = await directRes.text();
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");

    const cleanedText = cleanFetchedJobText(sanitizeText(cleaned));
    if (!isLowSignalJobText(cleanedText)) {
      return cleanedText;
    }
  } catch {
    // Direct fetch also failed (CORS or network error).
  }

  throw new Error("Job page blocked or unreachable. Paste the job description text for accurate ATS scoring.");
}

function extractKeywordsFromUrl(url) {
  try {
    const { pathname, hostname } = new URL(normalizeUrl(url));
    const raw = `${hostname} ${pathname}`.replace(/[-_/+.]/g, " ");
    return raw.replace(/[^a-z0-9 ]/gi, " ").replace(/\s{2,}/g, " ").trim();
  } catch {
    return "";
  }
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

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(value) || /\.[a-z]{2,}(\/|$)/i.test(value);
}

function normalizeResumeStructure(text) {
  return text
    .replace(/•/g, "\n• ")
    .replace(/\b(PROFESSIONAL SUMMARY|SUMMARY|EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY|SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES|EDUCATION|PROJECTS|CERTIFICATIONS)\b/gi, "\n$1\n")
    .replace(/\s+\|\s+/g, " | ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeToken(word) {
  const w = String(word || "").toLowerCase().trim();
  if (w.length <= 4) {
    return w;
  }
  if (w.endsWith("ies") && w.length > 5) {
    return `${w.slice(0, -3)}y`;
  }
  if (w.endsWith("ing") && w.length > 6) {
    return w.slice(0, -3);
  }
  if (w.endsWith("ed") && w.length > 5) {
    return w.slice(0, -2);
  }
  if (w.endsWith("es") && w.length > 5) {
    return w.slice(0, -2);
  }
  if (w.endsWith("s") && w.length > 4) {
    return w.slice(0, -1);
  }
  return w;
}

function cleanFetchedJobText(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !SCRAPE_NOISE_PATTERNS.some((pattern) => pattern.test(line)))
    .join("\n")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+\b/gi, " ")
    .replace(/[\t ]{2,}/g, " ")
    .trim();
}

function isLowSignalJobText(text) {
  if (!text || text.length < 250) {
    return true;
  }

  const lines = text.split("\n").filter(Boolean);
  const noisyLines = lines.filter((line) => SCRAPE_NOISE_PATTERNS.some((pattern) => pattern.test(line)));
  return noisyLines.length >= Math.max(2, Math.floor(lines.length * 0.25));
}

function tailorResumeTruthfully(resumeText, jobDetails, currentRoleListing = "", currentRoleMeta = {}) {
  const normalizedResume = normalizeResumeStructure(sanitizeText(resumeText));
  const sections = splitSections(normalizedResume);

  const jobKeywords = extractKeywords(jobDetails.combinedText, 40);
  const resumeKeywords = extractKeywords(normalizedResume, 260);
  const resumeKeywordSet = new Set(resumeKeywords.map(normalizeToken));

  const blockedTerms = extractBlockedTerms(jobDetails);
  const filteredJobKeywords = jobKeywords.filter((word) => isHighSignalKeyword(word, blockedTerms));

  const matchedKeywords = filteredJobKeywords.filter((word) => resumeKeywordSet.has(normalizeToken(word)));
  const missingKeywords = filteredJobKeywords.filter((word) => !resumeKeywordSet.has(normalizeToken(word)));

  const coreKeywords = filteredJobKeywords.slice(0, Math.min(24, filteredJobKeywords.length));
  const coreMatchedCount = coreKeywords.filter((word) => resumeKeywordSet.has(normalizeToken(word))).length;

  const score = coreKeywords.length
    ? Math.round((coreMatchedCount / coreKeywords.length) * 100)
    : 0;

  const summaryText = buildSummary(sections, matchedKeywords, jobDetails);
  const skillsText = buildSkillSection(sections, matchedKeywords);
  const experienceText = buildExperienceSection(sections, matchedKeywords);
  const educationText = sections.education?.join("\n") || "";
  const certText = sections.certifications?.join("\n") || "";
  const projectsText = sections.projects?.join("\n") || "";
  const latestRoleUpdateText = buildLatestRoleUpdateSection(sections, currentRoleListing);
  const latestRoleDraftTemplate = buildLatestRoleDraftTemplate(sections, currentRoleListing);
  const suggestions = buildTruthfulSuggestions(
    sections,
    matchedKeywords,
    missingKeywords,
    jobDetails,
    currentRoleListing,
    currentRoleMeta
  );

  const parts = [];

  if (summaryText) {
    parts.push("PROFESSIONAL SUMMARY");
    parts.push(summaryText);
    parts.push("");
  }

  if (skillsText) {
    parts.push("SKILLS");
    parts.push(skillsText);
    parts.push("");
  }

  if (experienceText) {
    parts.push("EXPERIENCE");
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

  return {
    score,
    matchedKeywords,
    missingKeywords: missingKeywords.slice(0, 20),
    latestRoleDraftTemplate,
    suggestions,
    scoringModel: {
      filteredJobKeywords,
      baseResumeKeywords: [...resumeKeywordSet],
    },
    tailoredText: parts.join("\n").trim(),
  };
}

function buildTruthfulSuggestions(
  sections,
  matchedKeywords,
  missingKeywords,
  jobDetails,
  currentRoleListing,
  currentRoleMeta = {}
) {
  const suggestions = [];
  const blockedTerms = extractBlockedTerms(jobDetails);
  const focusMissing = missingKeywords
    .filter((word) => isHighSignalKeyword(word, blockedTerms))
    .slice(0, 6);

  const focusMatched = matchedKeywords
    .filter((word) => isHighSignalKeyword(word, blockedTerms))
    .slice(0, 4);

  const listingKeywords = extractKeywords(currentRoleListing || "", 40)
    .filter((word) => isHighSignalKeyword(word, blockedTerms));

  const lineBank = [
    ...(sections.experience || []).slice(0, 14),
    ...(sections.skills || []).slice(0, 10),
  ].join(" ").toLowerCase();

  const tenureText = currentRoleMeta.tenureText || "recent tenure";
  const inferredResponsibilities = inferResponsibilitiesFromRoleTitle(currentRoleMeta.roleTitle || "");

  for (const responsibility of inferredResponsibilities.slice(0, 4)) {
    suggestions.push({
      label: `Add responsibility-backed bullet (${currentRoleMeta.roleTitle || "current role"}).`,
      draft: `- Over ${tenureText}, ${responsibility}, improving service consistency and customer outcomes.`,
    });
  }

  for (const keyword of focusMissing) {
    const draft = buildDraftBulletForKeyword(keyword, listingKeywords, lineBank);
    suggestions.push({
      label: `Add a truthful bullet that targets "${keyword}".`,
      draft,
    });
  }

  for (const keyword of focusMatched) {
    suggestions.push({
      label: `Strengthen existing "${keyword}" bullet with scope and measurable outcome.`,
      draft: `- Used ${keyword} across daily workflows to improve completion speed, reduce repeat issues, and deliver more consistent results.`,
    });
  }

  if (!/(crm|salesforce|zendesk|hubspot|dialer|ticket|qa|compliance|risk|audit)/i.test(lineBank)) {
    suggestions.push({
      label: "Add your real tools/platforms to improve ATS relevance.",
      draft: "- Documented work and follow-ups in role-specific tools, improving handoff quality and operational consistency.",
    });
  }

  suggestions.push({
    label: "Keep suggestions truth-safe.",
    draft: "- Remove any drafted bullet that is not true in your actual role, then tighten remaining bullets with concrete numbers.",
  });

  const unique = [];
  const seen = new Set();
  for (const item of suggestions) {
    const key = `${item.label}|${item.draft}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique.slice(0, 12);
}

function buildCurrentRoleMeta(currentRoleListingText) {
  const providedTitle = String(els.currentRoleTitle?.value || "").trim();
  const url = String(els.currentRoleUrl?.value || "").trim();
  const inferredTitle = providedTitle || inferRoleTitleFromUrl(url) || inferRoleTitleFromListing(currentRoleListingText);
  const startMonth = String(els.currentRoleStart?.value || "").trim();
  const tenureText = computeTenureLabel(startMonth);

  if (els.currentRoleTenure) {
    const titlePart = inferredTitle ? `${inferredTitle}` : "Current role";
    const tenurePart = tenureText ? ` | Tenure: ${tenureText}` : "";
    els.currentRoleTenure.textContent = `${titlePart}${tenurePart}`;
  }

  return {
    roleTitle: inferredTitle,
    startMonth,
    tenureText,
  };
}

function inferRoleTitleFromUrl(url) {
  if (!looksLikeUrl(url)) {
    return "";
  }
  try {
    const parsed = new URL(normalizeUrl(url));
    const parts = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((s) => s.replace(/[-_]+/g, " ").trim())
      .filter(Boolean)
      .filter((s) => !/^\d+$/.test(s))
      .filter((s) => !/^(job|jobs|careers|career|details|detail|apply)$/i.test(s));

    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i];
      if (p.length >= 4 && !/[0-9]{4,}/.test(p)) {
        return toTitleCase(p);
      }
    }
  } catch {
    // ignore parsing errors
  }
  return "";
}

function inferRoleTitleFromListing(text) {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10);

  for (const line of lines) {
    if (/specialist|manager|representative|advisor|analyst|coordinator|associate|officer|agent/i.test(line)) {
      return toTitleCase(line.replace(/[|:].*$/, "").trim());
    }
  }
  return "";
}

function inferResponsibilitiesFromRoleTitle(title) {
  const t = String(title || "").toLowerCase();
  const out = [];

  if (/retention|save|churn/.test(t)) out.push(...ROLE_RESPONSIBILITY_LIBRARY.retention);
  if (/customer|support|service|success/.test(t)) out.push(...ROLE_RESPONSIBILITY_LIBRARY.customer_service);
  if (/sales|account executive|bdr|sdr/.test(t)) out.push(...ROLE_RESPONSIBILITY_LIBRARY.sales);
  if (/ops|operations|specialist|coordinator/.test(t)) out.push(...ROLE_RESPONSIBILITY_LIBRARY.operations);
  if (/manager|lead|supervisor/.test(t)) out.push(...ROLE_RESPONSIBILITY_LIBRARY.manager);

  if (!out.length) {
    out.push(
      "handled core day-to-day responsibilities for the role",
      "improved process quality and customer outcomes",
      "collaborated with cross-functional teams to resolve issues"
    );
  }

  return [...new Set(out)].slice(0, 6);
}

function computeTenureLabel(startMonth) {
  if (!startMonth) {
    return "";
  }
  const m = /^(\d{4})-(\d{2})$/.exec(startMonth);
  if (!m) {
    return "";
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const start = new Date(y, mo - 1, 1);
  const now = new Date();
  const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
  const yrs = Math.floor(months / 12);
  const rem = months % 12;
  if (yrs && rem) return `${yrs}y ${rem}m`;
  if (yrs) return `${yrs}y`;
  return `${rem}m`;
}

function toTitleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}

function buildDraftBulletForKeyword(keyword, listingKeywords, lineBank) {
  const k = String(keyword || "").toLowerCase();

  if (/(security|compliance|risk|audit|privacy|regulatory)/.test(k)) {
    return `- Supported ${keyword}-related workflows by following policy controls, documenting exceptions, and reducing risk while maintaining customer experience.`;
  }

  if (/(retention|churn|customer|client|account|escalation)/.test(k)) {
    return `- Managed customer accounts and resolved escalations quickly, improving ${keyword} outcomes through proactive follow-up and clear communication.`;
  }

  if (/(training|coaching|mentor|qa|quality)/.test(k)) {
    return `- Coached teammates on process and quality standards, increasing ${keyword} consistency and reducing repeat errors.`;
  }

  if (/(analytics|reporting|kpi|metric|sql|data)/.test(k)) {
    return `- Used reporting and trend analysis to track ${keyword}, identify root causes, and improve operational outcomes.`;
  }

  const roleSignal = listingKeywords.slice(0, 3).join(", ");
  if (roleSignal) {
    return `- Applied ${keyword} in ${roleSignal} workflows to improve execution quality and deliver more consistent results.`;
  }

  return `- Applied ${keyword} in day-to-day execution to strengthen quality, speed, and consistency of outcomes.`;
}

function isHighSignalKeyword(word, blockedTerms = new Set()) {
  const w = String(word || "").toLowerCase().trim();
  if (!w || w.length < 4) return false;
  if (/^\d+$/.test(w)) return false;
  if (WEAK_KEYWORDS.has(w)) return false;
  if (blockedTerms.has(w)) return false;
  if (/^[a-f0-9]{6,}$/.test(w)) return false;
  return true;
}

function extractBlockedTerms(jobDetails) {
  const blocked = new Set(["ashby", "greenhouse", "lever", "workday", "linkedin", "otta"]);
  const source = String(jobDetails?.sourceLabel || "");

  if (!looksLikeUrl(source)) {
    return blocked;
  }

  try {
    const url = new URL(normalizeUrl(source));
    const raw = `${url.hostname} ${url.pathname}`.toLowerCase();
    raw
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((part) => part.length > 2)
      .forEach((part) => blocked.add(part));
  } catch {
    // ignore malformed URLs
  }

  return blocked;
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
    .filter((word) => !STOPWORDS.has(word))
    .filter((word) => word.length <= 28)
    .filter((word) => !/[/:?&=]/.test(word))
    .filter((word) => !/^\d+$/.test(word))
    .filter((word) => !word.includes("utm_"));

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
    .filter((word) => explicitSkills.some((skill) => skill.toLowerCase().includes(word) || normalizeToken(skill).includes(normalizeToken(word))))
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

function buildLatestRoleUpdateSection(sections, currentRoleListing) {
  const listing = sanitizeText(currentRoleListing || "");
  if (!listing) {
    return "";
  }

  const roleKeywords = extractKeywords(listing, 30);
  if (!roleKeywords.length) {
    return "";
  }

  const expLines = sections.experience || [];
  if (!expLines.length) {
    return "No experience section detected in your resume. Add your latest role title/company first, then use this workbench to add truthful bullets.";
  }

  const latestRoleAnchor = expLines.find((line) => /\|/.test(line) || /(present|current|remote|specialist|manager|representative)/i.test(line)) || expLines[0];
  const latestRoleText = expLines.slice(0, 12).join(" ").toLowerCase();

  const missingInLatestRole = roleKeywords
    .filter((word) => !latestRoleText.includes(word))
    .slice(0, 8);

  const alreadyCovered = roleKeywords
    .filter((word) => latestRoleText.includes(word))
    .slice(0, 4);

  const focusAreas = [...new Set([...alreadyCovered, ...missingInLatestRole])].slice(0, 8);

  const lines = [];
  lines.push(`Current role anchor: ${latestRoleAnchor}`);
  lines.push("Use these prompts to update your latest role with details you actually performed:");

  for (const focus of focusAreas) {
    lines.push(`- Add a bullet about ${focus} with real actions, tools, and outcomes (include numbers only if true).`);
  }

  lines.push("- Keep each bullet in STAR style: action + context + measurable result.");
  lines.push("- Remove any prompt that does not match your real experience.");
  return lines.join("\n");
}

function buildLatestRoleDraftTemplate(sections, currentRoleListing) {
  const listing = sanitizeText(currentRoleListing || "");
  if (!listing) {
    return "";
  }

  const roleKeywords = extractKeywords(listing, 24);
  if (!roleKeywords.length) {
    return "";
  }

  const expLines = sections.experience || [];
  const latestRoleAnchor = expLines.find((line) => /\|/.test(line) || /(present|current|remote|specialist|manager|representative)/i.test(line)) || "Most recent role | company | dates";
  const latestRoleText = expLines.slice(0, 12).join(" ").toLowerCase();
  const focusAreas = roleKeywords
    .filter((word) => !latestRoleText.includes(word))
    .slice(0, 6);

  const promptAreas = focusAreas.length ? focusAreas : roleKeywords.slice(0, 6);

  const lines = [];
  lines.push(latestRoleAnchor);
  lines.push("");
  for (const area of promptAreas) {
    lines.push(`- Used ${area} in daily execution to improve consistency, resolve issues faster, and support stronger customer outcomes.`);
  }
  lines.push("- Collaborated with cross-functional partners to resolve complex cases quickly and improve customer satisfaction.");
  lines.push("- Resolved escalated issues by identifying root causes and documenting fixes, reducing repeat contacts over time.");

  return lines.join("\n");
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
    if (lower.includes(keyword) || lower.includes(normalizeToken(keyword))) {
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

function renderSuggestions(suggestions) {
  if (!els.suggestionsList) {
    return;
  }

  els.suggestionsList.innerHTML = "";
  if (!suggestions.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "No suggestions yet. Run Tailor Resume first.";
    els.suggestionsList.append(p);
    return;
  }

  suggestions.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "suggestion-item";

    const header = document.createElement("div");
    header.className = "suggestion-item-header";

    const content = document.createElement("p");
    content.className = "suggestion-text";
    const labelText = typeof item === "string" ? item : item.label;
    const draftText = typeof item === "string" ? item : item.draft;
    content.textContent = labelText;

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn-add-bullet";
    addBtn.dataset.suggestionIndex = String(index);
    addBtn.textContent = "Add Bullet";

    const draft = document.createElement("p");
    draft.className = "suggestion-draft";
    draft.textContent = draftText || "";

    header.append(content, addBtn);
    row.append(header, draft);
    els.suggestionsList.append(row);
  });
}

function onSuggestionListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  if (!target.classList.contains("btn-add-bullet")) {
    return;
  }

  const idx = Number(target.dataset.suggestionIndex);
  if (!Number.isInteger(idx) || !lastSuggestions[idx]) {
    return;
  }

  const item = lastSuggestions[idx];
  const draft = typeof item === "string" ? item : item.draft;
  if (!draft) {
    return;
  }

  const inserted = appendDraftBullet(draft);
  if (!inserted) {
    setStatus("That bullet is already in your draft.");
    target.setAttribute("disabled", "true");
    target.textContent = "Added";
    return;
  }

  target.setAttribute("disabled", "true");
  target.textContent = "Added";
  refreshAtsFromDraft();
  setStatus("Added 1 bullet to Latest Role Draft. Edit details so it stays truthful.");
}

function refreshAtsFromDraft() {
  if (!lastFilteredJobKeywords.length || !lastResumeKeywordSet.size) {
    return;
  }

  const draftText = sanitizeText(els.latestRoleDraft?.value || "");
  const draftKeywords = extractKeywords(draftText, 180).map(normalizeToken);
  const combinedKeywordSet = new Set(lastResumeKeywordSet);
  for (const keyword of draftKeywords) {
    combinedKeywordSet.add(keyword);
  }

  const matchedKeywords = lastFilteredJobKeywords.filter((word) => combinedKeywordSet.has(normalizeToken(word)));
  const coreKeywords = lastFilteredJobKeywords.slice(0, Math.min(24, lastFilteredJobKeywords.length));
  const coreMatchedCount = coreKeywords.filter((word) => combinedKeywordSet.has(normalizeToken(word))).length;
  const score = coreKeywords.length ? Math.round((coreMatchedCount / coreKeywords.length) * 100) : 0;

  els.scoreValue.textContent = `${score}%`;
  els.matchCount.textContent = `${matchedKeywords.length}`;
}

function appendDraftBullet(draftText) {
  if (!els.latestRoleDraft) {
    return false;
  }
  const normalizedDraft = draftText.startsWith("-") ? draftText : `- ${draftText}`;
  const existing = sanitizeText(els.latestRoleDraft.value || "");
  const existingLines = existing
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const exists = existingLines.some((line) => line.toLowerCase() === normalizedDraft.toLowerCase());
  if (exists) {
    return false;
  }

  const blockHeader = "APPROVED TRUTHFUL DRAFT BULLETS";
  const hasHeader = existingLines.some((line) => line.toLowerCase() === blockHeader.toLowerCase());
  const block = `${hasHeader ? "" : `${blockHeader}\n`}${normalizedDraft}`.trim();

  els.latestRoleDraft.value = existing ? `${existing}\n${block}` : block;
  return true;
}

function onDownloadTxt() {
  const exportText = composeExportText();
  if (!exportText) {
    return;
  }

  const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
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
  const exportText = composeExportText();
  if (!exportText) {
    return;
  }

  if (!window.htmlDocx) {
    setStatus("DOCX export library failed to load.");
    return;
  }

  const html = textToSimpleHtml(exportText);
  const docxBlob = window.htmlDocx.asBlob(html);
  downloadBlob(docxBlob, "tailored_resume_truth_first.docx");
}

function onDownloadPdf() {
  const exportText = composeExportText();
  if (!exportText) {
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

  const lines = doc.splitTextToSize(exportText, maxWidth);
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

function onLoadDraftTemplate() {
  if (!lastLatestRoleDraftTemplate || !els.latestRoleDraft) {
    return;
  }
  els.latestRoleDraft.value = lastLatestRoleDraftTemplate;
  refreshAtsFromDraft();
  setStatus("Loaded suggested draft prompts for your latest role. Edit with real details only.");
}

function composeExportText() {
  if (!lastOutputText) {
    return "";
  }

  const draft = sanitizeText(els.latestRoleDraft?.value || "");
  if (!draft) {
    return lastOutputText;
  }

  const cleanedDraftLines = draft
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^approved truthful draft bullets$/i.test(line));

  if (!cleanedDraftLines.length) {
    return lastOutputText;
  }

  return `${lastOutputText}\n\nADDITIONAL EXPERIENCE\n${cleanedDraftLines.join("\n")}`;
}

function setStatus(message) {
  els.status.textContent = message;
}
