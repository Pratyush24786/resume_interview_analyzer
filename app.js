import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const $ = (id) => document.getElementById(id);
const MAX_SIZE = 5 * 1024 * 1024;
let cleanResumeText = "";

const SKILLS = {
  Programming: [
    "Python", "JavaScript", "TypeScript", "Java", "C++", "C#",
    "SQL", "HTML", "CSS", "React", "Node.js", "Flask",
    "Django", "Git", "REST API"
  ],
  "Data & AI": [
    "Excel", "Power BI", "Tableau", "Pandas", "NumPy",
    "Machine Learning", "Data Analysis", "Data Visualization",
    "Statistics", "TensorFlow", "PyTorch"
  ],
  "Cloud & DevOps": [
    "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes",
    "CI/CD", "Jenkins", "Linux", "Terraform"
  ],
  Business: [
    "Project Management", "Agile", "Scrum", "Stakeholder Management",
    "Business Analysis", "Salesforce", "CRM", "SEO", "Digital Marketing"
  ],
  "People skills": [
    "Communication", "Leadership", "Teamwork", "Problem Solving",
    "Time Management", "Presentation", "Negotiation", "Adaptability"
  ]
};

const ALL_SKILLS = Object.values(SKILLS).flat();

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasSkill = (text, skill) =>
  new RegExp(`(?<!\\w)${escapeRegex(skill)}(?!\\w)`, "i").test(text);

function listItems(id, values, fallback) {
  const el = $(id);
  el.replaceChildren();

  (values.length ? values : [fallback]).forEach((value) => {
    const li = document.createElement("li");
    li.textContent = value;
    el.append(li);
  });
}

function tags(id, values, fallback, kind = "") {
  const el = $(id);
  el.replaceChildren();

  (values.length ? values : [fallback]).forEach((value) => {
    const tag = document.createElement("span");
    tag.className = `tag ${kind}`;
    tag.textContent = value;
    el.append(tag);
  });
}

async function readResume(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "txt") {
    return file.text();
  }

  if (ext === "docx") {
    if (!window.mammoth) {
      throw new Error(
        "The DOCX reader did not load. Check your internet connection."
      );
    }

    return (
      await window.mammoth.extractRawText({
        arrayBuffer: await file.arrayBuffer()
      })
    ).value;
  }

  if (ext !== "pdf") {
    throw new Error("Please choose a PDF, DOCX, or TXT file.");
  }

  const pdf = await pdfjsLib.getDocument({
    data: await file.arrayBuffer()
  }).promise;

  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, async (_, index) => {
      const content = await (await pdf.getPage(index + 1)).getTextContent();
      const rows = [];

      content.items
        .filter((item) => item.str.trim())
        .forEach((item) => {
          const x = item.transform[4];
          const y = item.transform[5];

          let row = rows.find((candidate) => Math.abs(candidate.y - y) < 3);

          if (!row) {
            row = { y, items: [] };
            rows.push(row);
          }

          row.items.push({ x, text: item.str });
        });

      return rows
        .sort((a, b) => b.y - a.y)
        .map((row) =>
          row.items
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text)
            .join(" ")
        )
        .join("\n");
    })
  );

  return pages.join("\n");
}

function analyse(resume, job) {
  const clean = resume.replace(/\u00a0/g, " ");

  const lines = clean
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const name =
    lines.find((line) => line.length < 60 && !/@/.test(line)) ||
    "Your résumé";

  const resumeSkills = ALL_SKILLS.filter((skill) => hasSkill(clean, skill));
  const jobSkills = ALL_SKILLS.filter((skill) => hasSkill(job, skill));

  const matched = jobSkills.filter((skill) => resumeSkills.includes(skill));
  const missing = jobSkills.filter((skill) => !resumeSkills.includes(skill));

  const score = job.trim()
    ? Math.round((matched.length / Math.max(jobSkills.length, 1)) * 100)
    : null;

  const achievements = lines
    .map((line) => line.replace(/^[•-]\s*/, ""))
    .filter((line) =>
      /\b(\d+%|\d+\+|increased|reduced|improved|saved|grew|led|built|achieved)\b/i.test(
        line
      )
    )
    .slice(0, 4);

  const questions = [
    "Tell me about yourself and why this role interests you.",
    "Describe a difficult problem you solved. What did you do and what changed?",
    "Which achievement best proves you can succeed in this role?",
    "Tell me about feedback you received and how it changed your approach."
  ];

  if (resumeSkills.some((skill) => SKILLS.Programming.includes(skill))) {
    questions.push(
      "How would you test, debug, and improve a feature you built?"
    );
  }

  if (resumeSkills.some((skill) => SKILLS["Data & AI"].includes(skill))) {
    questions.push(
      "How do you make sure an analysis is accurate and useful?"
    );
  }

  return {
    name,
    resumeSkills,
    jobSkills,
    matched,
    missing,
    score,
    achievements,
    questions: questions.slice(0, 6)
  };
}

function showReport(data, fileName) {
  $("candidateName").textContent = data.name;
  $("reportMeta").textContent = `Created from ${fileName}`;

  tags(
    "matchedSkills",
    data.matched,
    data.jobSkills.length
      ? "No direct matches found"
      : "Add a job description to compare skills.",
    "good"
  );

  tags(
    "missingSkills",
    data.missing,
    data.jobSkills.length
      ? "Great — no listed skill gaps were found."
      : "Add a job description to find relevant skill gaps.",
    "gap"
  );

  const grouped = Object.entries(SKILLS).filter(([, skills]) =>
    skills.some((skill) => data.resumeSkills.includes(skill))
  );

  const skillBox = $("resumeSkills");
  skillBox.replaceChildren();

  if (!grouped.length) {
    skillBox.textContent =
      "No common skills were detected. Use clear skill names in your résumé.";
  }

  grouped.forEach(([category, skills]) => {
    const group = document.createElement("div");
    group.className = "skill-group";

    const title = document.createElement("h4");
    title.textContent = category;
    group.append(title);

    skills
      .filter((skill) => data.resumeSkills.includes(skill))
      .forEach((skill) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = skill;
        group.append(tag);
      });

    skillBox.append(group);
  });

  listItems("questions", data.questions, "Prepare a short STAR story.");
  renderEnhancements(data, cleanResumeText);

  listItems(
    "achievements",
    data.achievements,
    "Prepare one STAR story for each skill with a measurable result."
  );

  $("evidenceIntro").textContent = data.achievements.length
    ? "Use these points as the evidence in your interview answers."
    : "A strong answer names the situation, your action, and a specific result.";

  if (data.score === null) {
    $("matchScore").textContent = "—";
    $("scoreTitle").textContent =
      "Add a job description for your match score";
    $("scoreText").textContent =
      "You can still use the interview questions and skill map.";
  } else {
    $("matchScore").textContent = `${data.score}%`;
    $("scoreTitle").textContent =
      data.score >= 70
        ? "Strong starting match"
        : "Clear areas to strengthen";

    $("scoreText").textContent =
      `${data.matched.length} of ${data.jobSkills.length} recognised job skills ` +
      "appear in your résumé.";
  }

  const helpUrl = window.CAREER_MATCH_CONFIG?.personalisedHelpUrl;

  if (helpUrl) {
    $("offerLink").href = helpUrl;
    $("offer").classList.remove("hidden");
  }

  const feedbackUrl = window.CAREER_MATCH_CONFIG?.feedbackUrl;

  if (feedbackUrl) {
    $("feedbackLink").href = feedbackUrl;
    $("feedbackPanel").classList.remove("hidden");
  }

  $("analyzer").classList.add("hidden");
  $("report").classList.remove("hidden");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

const ATS_PROFILES = {
  workday: { name: "Workday-style", emphasis: "contact details, work history, and skill fields" },
  greenhouse: { name: "Greenhouse-style", emphasis: "clean headings, dates, and chronological experience" },
  lever: { name: "Lever-style", emphasis: "plain-text experience and role keywords" },
  sap: { name: "SAP SuccessFactors-style", emphasis: "structured profile fields and consistent dates" }
};

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

function scoreForText(text, skills) {
  if (!skills.length) return null;
  return Math.round((skills.filter((skill) => hasSkill(text, skill)).length / skills.length) * 100);
}

function renderKeywordOptimizer(data, resume) {
  const editor = $("resumeEditor");
  editor.value = resume;
  const update = () => {
    const current = editor.value;
    const score = scoreForText(current, data.jobSkills);
    $("liveScore").textContent = score === null
      ? "Add a job description to activate the live score."
      : `Live match: ${score}% — based on recognised job skills.`;
    const list = $("keywordChecklist");
    list.replaceChildren();
    (data.jobSkills.length ? data.jobSkills : ["Add a job description to see target skills."]).forEach((skill) => {
      const item = document.createElement("li");
      const present = hasSkill(current, skill);
      item.className = present ? "complete" : "";
      item.textContent = `${present ? "✓" : "○"} ${skill}`;
      list.append(item);
    });
  };
  editor.oninput = update;
  update();
}

function weakResumeBullets(resume) {
  return resume.split(/\r?\n/)
    .map((line) => line.trim().replace(/^[•*-]\s*/, ""))
    .filter((line) => line.length > 24 && /\b(responsible for|worked on|helped|handled|managed|participated|assisted)\b/i.test(line))
    .slice(0, 3);
}

function rewriteOptions(bullet) {
  const topic = bullet.replace(/^(responsible for|worked on|helped with|handled|managed|participated in|assisted with)\s*/i, "").replace(/[.]+$/, "");
  return [
    `Spearheaded ${topic}, improving [key outcome] by [X%] through [specific action].`,
    `Led [scope/team] to deliver ${topic}, resulting in [measurable result] within [timeframe].`,
    `Partnered with [stakeholders] to improve ${topic}; tracked [metric] and achieved [result].`
  ];
}

function renderRewriter(resume) {
  const host = $("weakBullets");
  const results = $("rewriteResults");
  const bullets = weakResumeBullets(resume);
  host.replaceChildren();
  results.replaceChildren();
  if (!bullets.length) {
    host.textContent = "No common weak phrasing was detected. Choose any résumé bullet above and add a specific action, scope, and result.";
    return;
  }
  bullets.forEach((bullet) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "weak-bullet";
    button.textContent = `Generate improvement: “${bullet}”`;
    button.addEventListener("click", () => {
      results.innerHTML = `<p><strong>Original:</strong> ${escapeHtml(bullet)}</p>` + rewriteOptions(bullet)
        .map((option) => `<label class="rewrite-option"><textarea rows="3">${escapeHtml(option)}</textarea></label>`).join("");
    });
    host.append(button);
  });
}

function parsingRisks(resume) {
  const lines = resume.split(/\r?\n/).filter((line) => line.trim());
  const email = resume.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "Not detected";
  const phone = resume.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] || "Not detected";
  const risks = [];
  if (email === "Not detected") risks.push("No email address was detected in the text.");
  if (phone === "Not detected") risks.push("No phone number was detected in the text.");
  if (/\t| {4,}|\|/.test(resume)) risks.push("Columns, tabs, or table-like spacing may change reading order.");
  if (lines.some((line) => line.length > 180)) risks.push("Very long lines can make headings and bullet boundaries unclear.");
  if (!/\b(experience|employment|work history)\b/i.test(resume)) risks.push("A conventional Experience heading was not detected.");
  return { email, phone, risks };
}

function renderAtsPreview(resume, profileKey = "workday") {
  const profile = ATS_PROFILES[profileKey];
  const { email, phone, risks } = parsingRisks(resume);
  const sample = resume.split(/\r?\n/).filter(Boolean).slice(0, 14).join("\n");
  $("atsParsedPreview").innerHTML = `
    <div><strong>${profile.name} educational preview</strong><p class="muted">Prioritises ${profile.emphasis}. This does not replicate or access a real vendor system.</p>
      <dl><dt>Email</dt><dd>${escapeHtml(email)}</dd><dt>Phone</dt><dd>${escapeHtml(phone)}</dd></dl>
      <h4>Plain-text extraction</h4><pre>${escapeHtml(sample || "No résumé text available.")}</pre></div>
    <div><h4>Format risks to review</h4><ul>${(risks.length ? risks : ["No obvious text-format risks detected. Use clear headings and simple one-column formatting for best portability."]).map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul></div>`;
}

function renderFlashcards(questions) {
  const host = $("flashcards");
  host.replaceChildren();
  questions.slice(0, 4).forEach((question, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "flashcard";
    card.setAttribute("aria-pressed", "false");
    card.innerHTML = `<span class="flashcard-front"><b>Question ${index + 1}</b>${escapeHtml(question)}<small>Click for an answering framework</small></span><span class="flashcard-back"><b>STAR framework</b><span><strong>Situation:</strong> set context. <strong>Task:</strong> name your responsibility. <strong>Action:</strong> explain your choices. <strong>Result:</strong> quantify what changed.</span><small>Click to return to the question</small></span>`;
    card.addEventListener("click", () => {
      const flipped = card.classList.toggle("flipped");
      card.setAttribute("aria-pressed", String(flipped));
    });
    host.append(card);
  });
}

function renderEnhancements(data, resume) {
  renderKeywordOptimizer(data, resume);
  renderRewriter(resume);
  renderFlashcards(data.questions);
  renderAtsPreview(resume);
  document.querySelectorAll(".ats-tab").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll(".ats-tab").forEach((item) => item.classList.toggle("active", item === tab));
      renderAtsPreview($("resumeEditor").value, tab.dataset.ats);
    };
  });
}

$("analysisForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = $("resume").files[0];

  if (!file) {
    $("status").textContent = "Please choose a résumé file first.";
    return;
  }

  if (file.size > MAX_SIZE) {
    $("status").textContent = "Please use a file smaller than 5 MB.";
    return;
  }

  $("status").textContent = "Reading your résumé…";
  $("analyzeButton").disabled = true;

  try {
    const resume = await readResume(file);

    if (resume.trim().length < 30) {
      throw new Error(
        "This file does not contain enough readable text.\nA scanned PDF may need OCR."
      );
    }

    cleanResumeText = resume.replace(/\u00a0/g, " ");
    showReport(analyse(cleanResumeText, $("jobDescription").value), file.name);
    $("status").textContent = "";
  } catch (error) {
    $("status").textContent =
      error.message || "The résumé could not be read.";
  } finally {
    $("analyzeButton").disabled = false;
  }
});

$("startOver").addEventListener("click", () => {
  $("report").classList.add("hidden");
  $("analyzer").classList.remove("hidden");
  $("analysisForm").reset();
  $("offer").classList.add("hidden");
  $("feedbackPanel").classList.add("hidden");
});

$("printReport").addEventListener("click", () => window.print());

function getScoreCardData() {
  const score = $("matchScore").textContent.trim();
  const name = $("candidateName").textContent.trim();

  if (!score || score === "—") {
    throw new Error(
      "Add a job description first so CareerMatch can create your score card."
    );
  }

  return { score, name };
}

async function createScoreCardBlob() {
  const { score, name } = getScoreCardData();

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 627;

  const ctx = canvas.getContext("2d");

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 1200, 627);
  gradient.addColorStop(0, "#101828");
  gradient.addColorStop(1, "#1d4ed8");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Decorative circles
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(1080, 100, 240, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(100, 600, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Brand
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px Arial, sans-serif";
  ctx.fillText("CareerMatch", 80, 100);

  ctx.fillStyle = "#bfdbfe";
  ctx.font = "28px Arial, sans-serif";
  ctx.fillText("MY RÉSUMÉ MATCH SCORE", 80, 170);

  // Score
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 170px Arial, sans-serif";
  ctx.fillText(score, 80, 365);

  // Candidate name
  ctx.fillStyle = "#e0e7ff";
  ctx.font = "32px Arial, sans-serif";
  ctx.fillText(
    name && name !== "Your résumé" ? `Prepared by ${name}` : "Prepared for my next opportunity",
    80,
    440
  );

  // Website link
  ctx.fillStyle = "#ffffff";
  ctx.font = "26px Arial, sans-serif";
  ctx.fillText(
    "resume-interview-analyzer.pratyushk824-786.workers.dev",
    80,
    550
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not create the score card image."));
      }
    }, "image/png");
  });
}

async function downloadScoreCard() {
  const blob = await createScoreCardBlob();
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "careermatch-score-card.png";
  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

const downloadScoreCardButton = $("downloadScoreCard");

if (downloadScoreCardButton) {
  downloadScoreCardButton.addEventListener("click", async () => {
    try {
      await downloadScoreCard();
      $("status").textContent =
        "Your CareerMatch score card has been downloaded.";
    } catch (error) {
      $("status").textContent = error.message;
    }
  });
}

const shareLinkedInButton = $("shareLinkedIn");

if (shareLinkedInButton) {
  shareLinkedInButton.addEventListener("click", async () => {
    try {
      // Downloads the branded image first.
      await downloadScoreCard();

      $("status").textContent =
        "Your score card was downloaded. Attach it to your LinkedIn post.";

      const websiteUrl =
        "https://resume-interview-analyzer.pratyushk824-786.workers.dev/";

      window.open(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(websiteUrl)}`,
        "_blank",
        "noopener,noreferrer,width=600,height=600"
      );
    } catch (error) {
      $("status").textContent = error.message;
    }
  });
}

$("year").textContent = new Date().getFullYear();

const contactUrl = window.CAREER_MATCH_CONFIG?.contactUrl;

if (contactUrl) {
  $("contactLink").href = contactUrl;
  $("contactLink").classList.remove("hidden");
}
