  window.SUPABASE_URL = "https://nemabrzkmiszlmylwfnt.supabase.co";
  window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lbWFicnprbWlzemxteWx3Zm50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NDUwOTgsImV4cCI6MjA3MjEyMTA5OH0.7YYm4Q__xi9LxFJeQKD2O8yARWcj_pc8vnuMQ-Qqx1c";
  window.SUPABASE_PROJECT_REF = "nemabrzkmiszlmylwfnt";

// app.js — AHL LIMS v3.1 (fix recursion, logout redirect, RPC users, empty messages)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = window.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const db = sb.schema("app");
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const PAGES = ["login","dashboard","submit","users","all","verify","reports","downloads"];

function show(page){
  PAGES.forEach(p => { const el = $(`#page-${p}`); if(el) el.style.display = (p===page?'block':'none'); });
}
function safe(x){ return (x??"").toString().replace(/[<>&]/g, c=>({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[c])); }
function setClock(sel){ const el=$(sel); if(!el) return; const tick=()=>el.textContent=new Date().toLocaleString(); tick(); setInterval(tick,1000); }

async function getSession(){ const {data} = await sb.auth.getSession(); return data.session||null; }
async function getUser(){ const {data} = await sb.auth.getUser(); return data.user||null; }
async function getProfile(uid){
  if(!uid) return null;
  const { data, error } = await db.from("user_profiles").select("*").eq("user_id", uid).single();
  return error ? null : data;
}
function isSupervisor(role){ return role==="supervisor" || role==="admin"; }

function hookAuthButtons(){
  $("#btn-google")?.addEventListener("click", async ()=>{
    await sb.auth.signInWithOAuth({ provider:"google", options:{ redirectTo: window.location.origin + window.location.pathname }});
  });
  $("#btn-logout")?.addEventListener("click", async ()=>{
    await sb.auth.signOut();
    // redirect agar aman di semua halaman (index/report/download)
    window.location.href = "index.html";
  });
  sb.auth.onAuthStateChange(async ()=>{ const s = await getSession(); if(!s) show("login"); });
}

function renderTable(rows, cols, { actions } = {}){
  if(!rows?.length) return `<div class="muted">Belum ada sample.</div>`;
  const head = `<tr>${cols.map(c=>`<th>${safe(c)}</th>`).join("")}${actions?"<th>Aksi</th>":""}</tr>`;
  const body = rows.map(r=>{
    const tds = cols.map(c=>`<td>${safe(r[c])}</td>`).join("");
    const act = actions ? `<td>${actions(r)}</td>` : "";
    return `<tr>${tds}${act}</tr>`;
  }).join("");
  return `<table>${head}${body}</table>`;
}

// ===== Mine
async function loadMySubmissions(targetSel, uid){
  const el = $(targetSel); if(!el) return;
  el.textContent = "Memuat...";
  const { data, error } = await db.from("submissions")
    .select("submit_code, client_name, pond_site, status, created_at, submitted_at")
    .eq("submitter_id", uid)
    .order("created_at",{ascending:false})
    .limit(200);
  if(error){ el.textContent = error.message; return; }
  el.innerHTML = data?.length
    ? renderTable(data, ["submit_code","client_name","pond_site","status","created_at","submitted_at"])
    : `<div class="muted">Belum ada sample.</div>`;
}

// ===== Users (via RPC, untuk supervisor)
async function loadUsers(targetSel){
  const el = $(targetSel); if(!el) return;
  el.textContent = "Memuat...";
  const { data, error } = await sb.rpc("list_user_profiles");
  if(error){ el.textContent = error.message; return; }
  const rows = data||[];
  el.innerHTML = rows.length
    ? renderTable(rows, ["full_name","user_id","role","created_at"], {
        actions: (u)=>`<select class="role-dd" data-uid="${u.user_id}">
          ${["admin","supervisor","analyst","submitter"].map(r=>`<option ${r===u.role?"selected":""}>${r}</option>`).join("")}
        </select>`
      })
    : `<div class="muted">Belum ada sample.</div>`;
  $$(".role-dd").forEach(dd=>dd.addEventListener("change", async (e)=>{
    const target_user = e.currentTarget.getAttribute("data-uid");
    const new_role = e.currentTarget.value;
    const { error } = await sb.rpc("set_user_role",{ target_user, new_role });
    if(error) alert(error.message);
  }));
}

// ===== All Submissions (supervisor)
async function loadAllSubmissions(targetSel){
  const el = $(targetSel); if(!el) return;
  el.textContent = "Memuat...";
  const { data, error } = await db.from("submissions")
    .select("id, submit_code, client_name, pond_site, status, created_at")
    .order("created_at",{ascending:false})
    .limit(500);
  if(error){ el.textContent = error.message; return; }
  el.innerHTML = data?.length
    ? renderTable(data, ["submit_code","client_name","pond_site","status","created_at"], {
        actions: (x)=>`<button class="btn secondary btn-edit" data-id="${x.id}">Edit</button>`
      })
    : `<div class="muted">Belum ada sample.</div>`;
  $$(".btn-edit").forEach(btn=>btn.addEventListener("click", async (e)=>{
    const id = e.currentTarget.getAttribute("data-id");
    const client_name = prompt("Client Name baru (kosong=skip):");
    const pond_site   = prompt("Pond/Site baru (kosong=skip):");
    const status      = prompt("Status (DRAFT,SUBMITTED,RECEIVED,IN_PROGRESS,COMPLETED,REJECTED,CANCELLED):");
    const patch = {};
    if(client_name) patch.client_name = client_name;
    if(pond_site)   patch.pond_site   = pond_site;
    if(status)      patch.status      = status;
    if(Object.keys(patch).length===0) return;
    const { error } = await db.from("submissions").update(patch).eq("id", id);
    if(error) alert(error.message); else loadAllSubmissions(targetSel);
  }));
}

// ===== Verify Reports
async function loadPendingReports(targetSel){
  const el = $(targetSel); if(!el) return;
  el.textContent = "Memuat...";
  const { data, error } = await db.from("reports")
    .select("id, report_code, status, approved_at, created_at")
    .is("approved_at", null)
    .order("created_at",{ascending:false})
    .limit(500);
  if(error){ el.textContent = error.message; return; }
  el.innerHTML = data?.length
    ? renderTable(data, ["report_code","status"], {
        actions: (r)=>`<button class="btn btn-approve" data-id="${r.id}">Approve</button>`
      })
    : `<div class="muted">Belum ada sample.</div>`;
  $$(".btn-approve").forEach(btn=>btn.addEventListener("click", async (e)=>{
    const id = e.currentTarget.getAttribute("data-id");
    const u = await getUser();
    const { error } = await db.from("reports")
      .update({ approved_by: u.id, approved_at: new Date().toISOString(), status: "COMPLETED" })
      .eq("id", id);
    if(error) alert(error.message); else loadPendingReports(targetSel);
  }));
}

// ===== Reports (mine + labgroup)
async function loadMyReports(targetSel, uid){
  const el = $(targetSel); if(!el) return;
  el.textContent = "Memuat...";
  const { data: subs, error: e0 } = await db.from("submissions").select("id").eq("submitter_id", uid).limit(1000);
  if(e0){ el.textContent = e0.message; return; }
  if(!subs?.length){ el.innerHTML = `<div class="muted">Belum ada sample.</div>`; return; }

  const subIds = new Set(subs.map(s=>s.id));
  const { data, error } = await db.from("reports")
    .select("id, report_code, status, approved_at, pdf_url, submission_id, created_at")
    .order("created_at",{ascending:false});
  if(error){ el.textContent = error.message; return; }
  const mine = (data||[]).filter(r=>subIds.has(r.submission_id));
  if(!mine.length){ el.innerHTML = `<div class="muted">Belum ada sample.</div>`; return; }

  el.innerHTML = renderTable(
    mine.map(m=>({ ...m, pdf: m.pdf_url ? `<a href="${m.pdf_url}" target="_blank" class="btn flat">PDF</a>` : "" })),
    ["report_code","status","approved_at"],
    { actions:(m)=>m.pdf }
  );
}
async function loadLabgroupReports(targetSel){
  const el = $(targetSel); if(!el) return;
  el.textContent = "Memuat...";
  const { data, error } = await sb.from("v_my_labgroup_reports").select("*").limit(500);
  el.innerHTML = error
    ? error.message
    : (data?.length
       ? renderTable(data, ["report_code","report_status","submit_code","client_name","pond_site","submission_created_at"])
       : `<div class="muted">Belum ada sample.</div>`);
}

// ===== Submit — multi-sample
function addSampleRow(){
  const wrap = $("#samples-wrap"); if(!wrap) return;
  const row = document.createElement("div");
  row.className = "grid sample-row";
  row.innerHTML = `
    <div><label>Sample Code</label><input name="sample_code" required placeholder="SPL-001"/></div>
    <div><label>Species</label><input name="species" placeholder="Litopenaeus vannamei"/></div>
    <div><label>Matrix</label><input name="matrix" placeholder="hepatopankreas / air / dll"/></div>
    <div><label>Collected At</label><input name="collected_at" type="datetime-local"/></div>
    <div style="align-self:end"><button type="button" class="btn secondary btn-del-sample">Hapus</button></div>
  `;
  wrap.appendChild(row);
  row.querySelector(".btn-del-sample").addEventListener("click", ()=> row.remove());
}
function hookSubmitForm(){
  $("#btn-add-sample")?.addEventListener("click", (e)=>{ e.preventDefault(); addSampleRow(); });
  $("#btn-back-to-dash")?.addEventListener("click", (e)=>{ e.preventDefault(); show("dashboard"); });

  $("#submit-form")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const msg = $("#submit-msg"); msg.textContent = "Menyimpan...";
    const fd = new FormData(e.currentTarget);
    const u  = await getUser();

    const subPayload = {
      submitter_id: u.id,
      submit_code : fd.get("submit_code"),
      client_name : fd.get("client_name"),
      pond_site   : fd.get("pond_site"),
      notes       : fd.get("notes"),
      status      : "SUBMITTED",
      submitted_at: new Date().toISOString()
    };
    const { data: subIns, error: e1 } = await db.from("submissions").insert(subPayload).select().single();
    if(e1){ msg.textContent = e1.message; return; }

    const rows = $$(".sample-row");
    if(rows.length){
      const samples = rows.map(r=>{
        const get = (name)=> r.querySelector(`[name="${name}"]`)?.value || null;
        const collected_at = get("collected_at") ? new Date(get("collected_at")).toISOString() : null;
        return {
          submission_id: subIns.id,
          sample_code  : get("sample_code"),
          species      : get("species"),
          matrix       : get("matrix"),
          collected_at
        };
      }).filter(s => s.sample_code);
      if(samples.length){
        const { error: e2 } = await db.from("samples").insert(samples);
        if(e2){ msg.textContent = "Submission tersimpan, namun gagal menyimpan sampel: " + e2.message; return; }
      }
    }
    msg.textContent = `Tersimpan: ${subIns.submit_code}`;
    $("#submit-form").reset();
    $("#samples-wrap").innerHTML = ""; addSampleRow();
  });
}

// ===== Boots
export async function bootIndex(){
  hookAuthButtons();
  setClock("#clock");

  const session = await getSession();
  if(!session){ show("login"); return; }

  const u = session.user;
  const profile = await getProfile(u.id);
  $("#top-user") && ($("#top-user").textContent = `${profile?.full_name || u.email || ""} (${profile?.role || "submitter"})`);
  $("#role") && ($("#role").textContent = profile?.role || "submitter");

  show("dashboard");
  await loadMySubmissions("#mine", u.id);

  hookSubmitForm();
  if(!$(".sample-row")) addSampleRow();

  if(isSupervisor(profile?.role)){
    $("#supervisor-block") && ($("#supervisor-block").style.display = "block");
    $('[data-page="users"]')?.addEventListener("click", ()=> loadUsers("#users"));
    $('[data-page="all"]')?.addEventListener("click", ()=> loadAllSubmissions("#all"));
    $('[data-page="verify"]')?.addEventListener("click", ()=> loadPendingReports("#verify"));
  } else {
    $("#supervisor-block") && ($("#supervisor-block").style.display = "none");
  }

  $$('[data-page]').forEach(a=>a.addEventListener("click",(e)=>{
    e.preventDefault();
    show(e.currentTarget.getAttribute("data-page"));
  }));
}

export async function bootReportsPage(){
  hookAuthButtons();
  const s = await getSession(); if(!s){ return; }
  const u = s.user;
  const profile = await getProfile(u.id);
  $("#whoami") && ($("#whoami").textContent = `${profile?.full_name || u.email || ""} (${profile?.role || "submitter"})`);
  await loadMyReports("#reports-mine", u.id);
  if(isSupervisor(profile?.role)){
    $("#labgroup-wrap") && ($("#labgroup-wrap").style.display = "block");
    await loadLabgroupReports("#reports-labgroup");
  }
}

export async function bootDownloadsPage(){
  hookAuthButtons();
  const s = await getSession(); if(!s){ return; }
  const u = s.user;
  const profile = await getProfile(u.id);
  $("#whoami") && ($("#whoami").textContent = `${profile?.full_name || u.email || ""} (${profile?.role || "submitter"})`);
  await loadMyReports("#downloads-mine", u.id);
}

document.addEventListener("DOMContentLoaded", ()=>{
  if($("#page-dashboard") || $("#page-login")) return void bootIndex();
  if($("#reports-root")) return void bootReportsPage();
  if($("#downloads-root")) return void bootDownloadsPage();
});
