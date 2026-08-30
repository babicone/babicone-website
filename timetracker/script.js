/* ================================
   BABI TIME TRACKER
   Edit TASK_GROUPS below to rename / add / remove groups.
   Each group needs: id, label, and an sop image file in /sop/
   ================================ */
const TASK_GROUPS = [
  { id: "strategy",   label: "Strategy & Research",        sop: "sop/strategy.png" },
  { id: "brand",      label: "Brand Identity & Guidelines", sop: "sop/brand.png" },
  { id: "ops",        label: "Brand Management & Ops",      sop: "sop/ops.png" },
  { id: "content",    label: "Content & Production",        sop: "sop/content.png" },
  { id: "other",      label: "Trade / Influencer / Design",  sop: "sop/other.png" },
];

const LS_ENTRIES = "babi_tt_entries";
const LS_ACTIVE  = "babi_tt_active"; // in-progress task (survives refresh)

/* ---------- helpers ---------- */
function isoWeek(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function pad(n){ return String(n).padStart(2,"0"); }
function fmtDuration(ms){
  const s = Math.floor(ms/1000);
  return `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`;
}
function fmtDateTime(ts){
  const d = new Date(ts);
  return d.toLocaleString(undefined, {dateStyle:"short", timeStyle:"short"});
}
function loadEntries(){ try{ return JSON.parse(localStorage.getItem(LS_ENTRIES)) || []; }catch(e){ return []; } }
function saveEntries(entries){ localStorage.setItem(LS_ENTRIES, JSON.stringify(entries)); }
function loadActive(){ try{ return JSON.parse(localStorage.getItem(LS_ACTIVE)); }catch(e){ return null; } }
function saveActive(a){ if(a) localStorage.setItem(LS_ACTIVE, JSON.stringify(a)); else localStorage.removeItem(LS_ACTIVE); }

/* ---------- populate group select ---------- */
const groupSelect = document.getElementById("groupSelect");
TASK_GROUPS.forEach(g=>{
  const opt = document.createElement("option");
  opt.value = g.id;
  opt.textContent = g.label;
  groupSelect.appendChild(opt);
});

/* ---------- STEP 1 : name builder ---------- */
const companyInput  = document.getElementById("companyInput");
const taskNameInput = document.getElementById("taskNameInput");
const namePreview   = document.getElementById("namePreview");

function buildTaskName(){
  const now = new Date();
  const company = companyInput.value.trim() || "Company";
  const year = now.getFullYear();
  const week = isoWeek(now);
  const task = taskNameInput.value.trim() || "Task name";

  return `${company} – ${year} – W${week} – ${task}`;
}
function refreshPreview(){ namePreview.textContent = buildTaskName(); }
[companyInput, taskNameInput].forEach(el => el.addEventListener("input", refreshPreview));
refreshPreview();

let currentTask = null; // { name, group }

document.getElementById("toStep2").addEventListener("click", ()=>{
  if(!taskNameInput.value.trim()){ taskNameInput.focus(); return; }
  const groupId = groupSelect.value;
  const group = TASK_GROUPS.find(g=>g.id===groupId);
  currentTask = { name: buildTaskName(), group: group.label, groupId };
  document.getElementById("sopImage").src = group.sop;
  showStep("step2");
});

/* ---------- STEP 2 : sop reminder ---------- */
document.getElementById("toStep3").addEventListener("click", ()=>{
  document.getElementById("activeTaskLabel").textContent = currentTask.name;
  showStep("step3");
});

/* ---------- STEP 3 : timer ---------- */
const timerDisplay = document.getElementById("timerDisplay");
const startBtn = document.getElementById("startBtn");
const checkoutBtn = document.getElementById("checkoutBtn");
let tickHandle = null;
let runningEntry = null; // { taskName, group, checkIn }

function tick(){
  if(!runningEntry) return;
  timerDisplay.textContent = fmtDuration(Date.now() - runningEntry.checkIn);
}
function startTimer(){
  runningEntry = { taskName: currentTask.name, group: currentTask.group, checkIn: Date.now() };
  saveActive(runningEntry);
  startBtn.disabled = true;
  checkoutBtn.disabled = false;
  tickHandle = setInterval(tick, 1000);
  tick();
}
startBtn.addEventListener("click", startTimer);

checkoutBtn.addEventListener("click", ()=>{
  if(!runningEntry) return;
  clearInterval(tickHandle);
  runningEntry.checkOut = Date.now();
  checkoutBtn.disabled = true;
  showStep("step4");
});

/* ---------- STEP 4 : optional link, then save ---------- */
document.getElementById("saveEntryBtn").addEventListener("click", ()=>{
  const entries = loadEntries();
  entries.unshift({
    task: runningEntry.taskName,
    group: runningEntry.group,
    checkIn: runningEntry.checkIn,
    checkOut: runningEntry.checkOut,
    link: document.getElementById("outcomeLink").value.trim(),
  });
  saveEntries(entries);
  saveActive(null);
  runningEntry = null;
  document.getElementById("outcomeLink").value = "";
  startBtn.disabled = false;
  checkoutBtn.disabled = true;
  timerDisplay.textContent = "00:00:00";
  renderLog();
  // reset to step 1 for the next task
  taskNameInput.value = "";
  refreshPreview();
  showStep("step1");
  document.getElementById("step2").classList.add("hidden");
  document.getElementById("step3").classList.add("hidden");
  document.getElementById("step4").classList.add("hidden");
});

/* ---------- STEP 5 : log + export ---------- */
function renderLog(){
  const entries = loadEntries();
  const body = document.getElementById("logBody");
  body.innerHTML = "";
  let totalMs = 0;
  entries.forEach((e, idx)=>{
    totalMs += (e.checkOut - e.checkIn);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(e.task)}</td>
      <td>${fmtDateTime(e.checkIn)}</td>
      <td>${fmtDateTime(e.checkOut)}</td>
      <td>${fmtDuration(e.checkOut - e.checkIn)}</td>
      <td>${e.link ? `<a href="${escapeHtml(e.link)}" target="_blank" rel="noopener">link</a>` : "—"}</td>
      <td><button class="del-btn" data-idx="${idx}" title="Delete">✕</button></td>
    `;
    body.appendChild(tr);
  });
  document.getElementById("totalHours").textContent =
    entries.length ? `Total tracked: ${fmtDuration(totalMs)}` : "No entries yet";
  body.querySelectorAll(".del-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const entries = loadEntries();
      entries.splice(Number(btn.dataset.idx), 1);
      saveEntries(entries);
      renderLog();
    });
  });
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById("exportBtn").addEventListener("click", ()=>{
  const entries = loadEntries();
  if(!entries.length){ alert("No entries to export yet."); return; }
  const header = ["Task","Group","Check-in","Check-out","Duration","Outcome link"];
  const rows = entries.map(e=>[
    e.task, e.group, fmtDateTime(e.checkIn), fmtDateTime(e.checkOut),
    fmtDuration(e.checkOut - e.checkIn), e.link || ""
  ]);
  const csv = [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `babi-time-report-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

/* ---------- step visibility ---------- */
function showStep(id){
  document.getElementById(id).classList.remove("hidden");
  document.getElementById(id).scrollIntoView({behavior:"smooth", block:"start"});
}

/* ---------- resume an active timer after a page refresh ---------- */
(function resumeActive(){
  const active = loadActive();
  if(active && !active.checkOut){
    currentTask = { name: active.taskName, group: active.group };
    runningEntry = active;
    document.getElementById("activeTaskLabel").textContent = active.taskName;
    showStep("step2"); showStep("step3");
    startBtn.disabled = true;
    checkoutBtn.disabled = false;
    tickHandle = setInterval(tick, 1000);
    tick();
  }
})();

renderLog();
