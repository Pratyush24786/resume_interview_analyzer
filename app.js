import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const $ = (id) => document.getElementById(id);
const MAX_SIZE = 5 * 1024 * 1024;
const SKILLS = {
  Programming:["Python","JavaScript","TypeScript","Java","C++","C#","SQL","HTML","CSS","React","Node.js","Flask","Django","Git","REST API"],
  "Data & AI":["Excel","Power BI","Tableau","Pandas","NumPy","Machine Learning","Data Analysis","Data Visualization","Statistics","TensorFlow","PyTorch"],
  "Cloud & DevOps":["AWS","Azure","Google Cloud","Docker","Kubernetes","CI/CD","Jenkins","Linux","Terraform"],
  Business:["Project Management","Agile","Scrum","Stakeholder Management","Business Analysis","Salesforce","CRM","SEO","Digital Marketing"],
  "People skills":["Communication","Leadership","Teamwork","Problem Solving","Time Management","Presentation","Negotiation","Adaptability"]
};
const ALL_SKILLS = Object.values(SKILLS).flat();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasSkill = (text, skill) => new RegExp(`(?<!\\w)${escapeRegex(skill)}(?!\\w)`, "i").test(text);

function listItems(id, values, fallback) { const el=$(id); el.replaceChildren(); (values.length?values:[fallback]).forEach((value)=>{const li=document.createElement("li");li.textContent=value;el.append(li);}); }
function tags(id, values, fallback, kind="") { const el=$(id); el.replaceChildren(); (values.length?values:[fallback]).forEach((value)=>{const tag=document.createElement("span");tag.className=`tag ${kind}`;tag.textContent=value;el.append(tag);}); }

async function readResume(file) {
  const ext=file.name.split(".").pop().toLowerCase();
  if(ext==="txt") return file.text();
  if(ext==="docx") { if(!window.mammoth) throw new Error("The DOCX reader did not load. Check your internet connection."); return (await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value; }
  if(ext!=="pdf") throw new Error("Please choose a PDF, DOCX, or TXT file.");
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
  const pages=await Promise.all(Array.from({length:pdf.numPages},async(_,index)=>{
    const content=await (await pdf.getPage(index+1)).getTextContent(), rows=[];
    content.items.filter((item)=>item.str.trim()).forEach((item)=>{const x=item.transform[4],y=item.transform[5];let row=rows.find((candidate)=>Math.abs(candidate.y-y)<3);if(!row){row={y,items:[]};rows.push(row);}row.items.push({x,text:item.str});});
    return rows.sort((a,b)=>b.y-a.y).map((row)=>row.items.sort((a,b)=>a.x-b.x).map((item)=>item.text).join(" ")).join("\n");
  }));
  return pages.join("\n");
}

function analyse(resume, job) {
  const clean=resume.replace(/\\\s*@/g,"@").replace(/\u00a0/g," ");
  const lines=clean.split(/\r?\n/).map((line)=>line.trim()).filter(Boolean);
  const name=lines.find((line)=>line.length<60&&!/@/.test(line))||"Your résumé";
  const resumeSkills=ALL_SKILLS.filter((skill)=>hasSkill(clean,skill));
  const jobSkills=ALL_SKILLS.filter((skill)=>hasSkill(job,skill));
  const matched=jobSkills.filter((skill)=>resumeSkills.includes(skill));
  const missing=jobSkills.filter((skill)=>!resumeSkills.includes(skill));
  const score=job.trim()?Math.round((matched.length/Math.max(jobSkills.length,1))*100):null;
  const achievements=lines.map((line)=>line.replace(/^[•-]\s*/,"")).filter((line)=>/\b(\d+%|\d+\+|increased|reduced|improved|saved|grew|led|built|achieved)\b/i.test(line)).slice(0,4);
  const questions=["Tell me about yourself and why this role interests you.","Describe a difficult problem you solved. What did you do and what changed?","Which achievement best proves you can succeed in this role?","Tell me about feedback you received and how it changed your approach."];
  if(resumeSkills.some((skill)=>SKILLS.Programming.includes(skill))) questions.push("How would you test, debug, and improve a feature you built?");
  if(resumeSkills.some((skill)=>SKILLS["Data & AI"].includes(skill))) questions.push("How do you make sure an analysis is accurate and useful?");
  return {name,resumeSkills,jobSkills,matched,missing,score,achievements,questions:questions.slice(0,6)};
}

function showReport(data,fileName) {
  $("candidateName").textContent=data.name; $("reportMeta").textContent=`Created from ${fileName}`;
  tags("matchedSkills",data.matched,data.jobSkills.length?"No direct matches found":"Add a job description to compare skills.","good");
  tags("missingSkills",data.missing,data.jobSkills.length?"Great — no listed skill gaps were found.":"Add a job description to find relevant skill gaps.","gap");
  const grouped=Object.entries(SKILLS).filter(([,skills])=>skills.some((skill)=>data.resumeSkills.includes(skill)));
  const skillBox=$("resumeSkills");skillBox.replaceChildren();
  if(!grouped.length) skillBox.textContent="No common skills were detected. Use clear skill names in your résumé.";
  grouped.forEach(([category,skills])=>{const group=document.createElement("div");group.className="skill-group";const title=document.createElement("h4");title.textContent=category;group.append(title);skills.filter((skill)=>data.resumeSkills.includes(skill)).forEach((skill)=>{const tag=document.createElement("span");tag.className="tag";tag.textContent=skill;group.append(tag);});skillBox.append(group);});
  listItems("questions",data.questions,"Prepare a short STAR story."); listItems("achievements",data.achievements,"Prepare one STAR story for each skill with a measurable result.");
  $("evidenceIntro").textContent=data.achievements.length?"Use these points as the evidence in your interview answers.":"A strong answer names the situation, your action, and a specific result.";
  if(data.score===null){$("matchScore").textContent="—";$("scoreTitle").textContent="Add a job description for your match score";$("scoreText").textContent="You can still use the interview questions and skill map.";}
  else {$("matchScore").textContent=`${data.score}%`;$("scoreTitle").textContent=data.score>=70?"Strong starting match":"Clear areas to strengthen";$("scoreText").textContent=`${data.matched.length} of ${data.jobSkills.length} recognised job skills appear in your résumé.`;}
  const helpUrl=window.CAREER_MATCH_CONFIG?.personalisedHelpUrl;
  if(helpUrl){$("offerLink").href=helpUrl;$("offer").classList.remove("hidden");}
  const feedbackUrl=window.CAREER_MATCH_CONFIG?.feedbackUrl;
  if(feedbackUrl){$("feedbackLink").href=feedbackUrl;$("feedbackPanel").classList.remove("hidden");}
  $("analyzer").classList.add("hidden");$("report").classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"});
}

$("analysisForm").addEventListener("submit",async(event)=>{event.preventDefault();const file=$("resume").files[0];if(!file)return;if(file.size>MAX_SIZE){$("status").textContent="Please use a file smaller than 5 MB.";return;}$("status").textContent="Reading your résumé…";$("analyzeButton").disabled=true;try{const resume=await readResume(file);if(resume.trim().length<30)throw new Error("This file does not contain enough readable text. A scanned PDF may need OCR.");showReport(analyse(resume,$("jobDescription").value),file.name);$("status").textContent="";}catch(error){$("status").textContent=error.message||"The résumé could not be read.";}finally{$("analyzeButton").disabled=false;}});
$("startOver").addEventListener("click",()=>{$("report").classList.add("hidden");$("analyzer").classList.remove("hidden");$("analysisForm").reset();$("offer").classList.add("hidden");$("feedbackPanel").classList.add("hidden");});
$("printReport").addEventListener("click",()=>window.print());
$("year").textContent=new Date().getFullYear();
const contactUrl=window.CAREER_MATCH_CONFIG?.contactUrl;
if(contactUrl){$("contactLink").href=contactUrl;$("contactLink").classList.remove("hidden");}
