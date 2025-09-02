// ====== GANTI ENV DI BAWAH INI ======
window.SUPABASE_URL ="https://nemabrzkmiszlmylwfnt.supabase.co";
window.SUPABASE_ANON_KEY ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lbWFicnprbWlzemxteWx3Zm50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NDUwOTgsImV4cCI6MjA3MjEyMTA5OH0.7YYm4Q__xi9LxFJeQKD2O8yARWcj_pc8vnuMQ-Qqx1c";
window.SUPABASE_PROJECT_REF ="nemabrzkmiszlmylwfnt";

// app.js
// AHL LIMS front-end core (Supabase JS v2, role-based UI)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ====== ENV ======
const SUPABASE_URL = window.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("SUPABASE_URL / SUPABASE_ANON_KEY belum di-set.");
}
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== DOM Helpers ======
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function safeText(x) {
  return (x ?? "").toString().replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}

function setClock(targetSel) {
  const el = $(targetSel);
  if (!el) return;
  el.textContent = new Date().toLocaleString();
  setInterval(() => (el.textContent = new Date().toLocaleString()), 1000);
}

const PAGES = ["login", "dashboard", "submit", "users", "all", "verify", "reports", "downloads"];
export function show(page) {
  PAGES.forEach((p) => {
    const el = $(`#page-${p}`);
    if (el) el.style.display = p === page ? "block" : "none";
  });
}

export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session || null;
}

export async function getUser() {
  const { data } = await sb.auth.getUser();
  return data.user || null;
}

export async function getProfile(userId) {
  if (!userId) return null;
  const { data, error } = await sb.from("app.user_profiles").select("*").eq("user_id", userId).single();
  if (error) {
    console.warn("getProfile error:", error.message);
    return null;
  }
  return data;
}

export function roleIsSupervisor(role) {
  return role === "supervisor" || role === "admin";
}

// ====== Rendering helpers ======
export function renderTable(rows, cols, { actions } = {}) {
  if (!rows?.length) return `<div class="muted">Tidak ada data.</div>`;
  const head = `<tr>${cols.map((c) => `<th>${safeText(c)}</th>`).join("")}${actions ? "<th>Aksi</th>" : ""}</tr>`;
  const body = rows
    .map((r) => {
      const tds = cols.map((c) => `<td>${safeText(r[c])}</td>`).join("");
      const act = actions ? `<td>${actions(r)}</td>` : "";
      return `<tr>${tds}${act}</tr>`;
    })
    .join("");
  return `<table>${head}${body}</table>`;
}

// ====== Mine (user submissions) ======
export async function loadMySubmissions(targetSel, userId) {
  const target = $(targetSel);
  if (!target || !userId) return;
  target.innerHTML = "Memuat...";
  const { data, error } = await sb
    .from("app.submissions")
    .select("submit_code, client_name, pond_site, status, created_at, submitted_at")
    .eq("submitter_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    target.textContent = error.message;
    return;
  }
  target.innerHTML = renderTable(data, ["submit_code", "client_name", "pond_site", "status", "created_at", "submitted_at"]);
}

// ====== Submit form ======
export function hookSubmitForm(formSel, msgSel) {
  const form = $(formSel);
  const msg = $(msgSel);
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const u = await getUser();
    const payload = {
      submitter_id: u.id,
      submit_code: fd.get("submit_code"),
      client_name: fd.get("client_name"),
      pond_site: fd.get("pond_site"),
      notes: fd.get("notes"),
      status: "SUBMITTED",
      submitted_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from("app.submissions").insert(payload).select();
    msg.textContent = error ? error.message : `Tersimpan: ${data?.[0]?.submit_code}`;
    if (!error) form.reset();
  });
}

// ====== Users (supervisor) ======
export async function loadUsers(targetSel) {
  const target = $(targetSel);
  if (!target) return;
  target.innerHTML = "Memuat...";
  const { data, error } = await sb
    .from("app.user_profiles")
    .select("user_id, full_name, role, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    target.textContent = error.message;
    return;
  }
  target.innerHTML = renderTable(data, ["full_name", "user_id", "role", "created_at"], {
    actions: (u) =>
      `<select class="role-dd" data-uid="${u.user_id}">
        ${["admin", "supervisor", "analyst", "submitter"]
          .map((r) => `<option ${r === u.role ? "selected" : ""}>${r}</option>`)
          .join("")}
       </select>`,
  });
  $$(".role-dd").forEach((dd) =>
    dd.addEventListener("change", async (e) => {
      const target_user = e.currentTarget.getAttribute("data-uid");
      const new_role = e.currentTarget.value;
      const { error } = await sb.rpc("set_user_role", { target_user, new_role });
      if (error) alert(error.message);
      else e.currentTarget.blur();
    })
  );
}

// ====== All submissions (supervisor) ======
export async function loadAllSubmissions(targetSel) {
  const target = $(targetSel);
  if (!target) return;
  target.innerHTML = "Memuat...";
  const { data, error } = await sb
    .from("app.submissions")
    .select("id, submit_code, client_name, pond_site, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    target.textContent = error.message;
    return;
  }
  target.innerHTML = renderTable(data, ["submit_code", "client_name", "pond_site", "status", "created_at"], {
    actions: (x) => `<button class="btn secondary btn-edit" data-id="${x.id}">Edit</button>`,
  });
  $$(".btn-edit").forEach((btn) =>
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      const client_name = prompt("Client Name baru (kosongkan untuk skip):");
      const pond_site = prompt("Pond/Site baru (kosongkan untuk skip):");
      const status = prompt("Status (DRAFT,SUBMITTED,RECEIVED,IN_PROGRESS,COMPLETED,REJECTED,CANCELLED):");
      const patch = {};
      if (client_name !== null && client_name !== "") patch.client_name = client_name;
      if (pond_site !== null && pond_site !== "") patch.pond_site = pond_site;
      if (status !== null && status !== "") patch.status = status;
      if (Object.keys(patch).length === 0) return;
      const { error } = await sb.from("app.submissions").update(patch).eq("id", id);
      if (error) alert(error.message);
      else loadAllSubmissions(targetSel);
    })
  );
}

// ====== Verify reports (supervisor) ======
export async function loadPendingReports(targetSel) {
  const target = $(targetSel);
  if (!target) return;
  target.innerHTML = "Memuat...";
  const { data, error } = await sb
    .from("app.reports")
    .select("id, report_code, status, approved_at")
    .is("approved_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    target.textContent = error.message;
    return;
  }
  target.innerHTML = renderTable(data, ["report_code", "status"], {
    actions: (r) => `<button class="btn btn-approve" data-id="${r.id}">Approve</button>`,
  });
  $$(".btn-approve").forEach((btn) =>
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      const u = await getUser();
      const { error } = await sb
        .from("app.reports")
        .update({ approved_by: u.id, approved_at: new Date().toISOString(), status: "COMPLETED" })
        .eq("id", id);
      if (error) alert(error.message);
      else loadPendingReports(targetSel);
    })
  );
}

// ====== Reports (mine & labgroup) ======
export async function loadMyReports(targetSel, userId) {
  const target = $(targetSel);
  if (!target) return;
  target.innerHTML = "Memuat...";
  const { data, error } = await sb
    .from("app.reports")
    .select("report_code, status, approved_at, submission_id, pdf_url, created_at, app:submissions!inner(submitter_id)")
    .order("created_at", { ascending: false });
  if (error) {
    target.textContent = error.message;
    return;
  }
  const mine = (data || []).filter((r) => r.app?.submitter_id === userId);
  if (!mine.length) {
    target.innerHTML = `<div class="muted">Belum ada laporan.</div>`;
    return;
  }
  target.innerHTML = renderTable(
    mine.map((m) => ({ ...m, pdf: m.pdf_url ? `<a href="${m.pdf_url}" target="_blank" class="btn flat">PDF</a>` : "" })),
    ["report_code", "status", "approved_at"],
    { actions: (m) => m.pdf }
  );
}

export async function loadLabgroupReports(targetSel) {
  const target = $(targetSel);
  if (!target) return;
  target.innerHTML = "Memuat...";
  // View publik yang mengandalkan auth.uid(); pastikan grant SELECT sudah diberikan
  const { data, error } = await sb.from("v_my_labgroup_reports").select("*").limit(500);
  if (error) {
    target.textContent = error.message;
    return;
  }
  target.innerHTML = renderTable(data, ["report_code", "report_status", "submit_code", "client_name", "pond_site", "submission_created_at"]);
}

// ====== Google Login handlers ======
export function hookAuthButtons() {
  const btnGoogle = $("#btn-google");
  const btnLogout = $("#btn-logout");
  btnGoogle?.addEventListener("click", async () => {
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  });
  btnLogout?.addEventListener("click", async () => {
    await sb.auth.signOut();
    location.reload();
  });
}

// ====== Boot per-halaman ======
export async function bootIndex() {
  hookAuthButtons();
  setClock("#clock");

  const session = await getSession();
  if (!session) {
    show("login");
    $("#top-user") && ($("#top-user").textContent = "");
    return;
  }
  const u = session.user;
  const profile = await getProfile(u.id);
  $("#top-user") && ($("#top-user").textContent = `${profile?.full_name || u.email || ""} (${profile?.role || "submitter"})`);
  $("#role") && ($("#role").textContent = profile?.role || "submitter");

  // Default landing: dashboard
  show("dashboard");
  await loadMySubmissions("#mine", u.id);

  // Submit form
  hookSubmitForm("#submit-form", "#submit-msg");

  // Supervisor console
  if (roleIsSupervisor(profile?.role)) {
    const block = $("#supervisor-block");
    if (block) block.style.display = "block";

    // Lazy hooks
    $('[data-page="users"]')?.addEventListener("click", () => loadUsers("#users"));
    $('[data-page="all"]')?.addEventListener("click", () => loadAllSubmissions("#all"));
    $('[data-page="verify"]')?.addEventListener("click", () => loadPendingReports("#verify"));
  } else {
    const block = $("#supervisor-block");
    if (block) block.style.display = "none";
  }

  // Generic nav
  $$('[data-page]').forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      show(e.currentTarget.getAttribute("data-page"));
    })
  );

  // Live auth state
  sb.auth.onAuthStateChange(async () => {
    const s = await getSession();
    if (!s) { show("login"); return; }
  });
}

export async function bootReportsPage() {
  hookAuthButtons();
  const session = await getSession();
  if (!session) { show("login"); return; }
  const u = session.user;
  const profile = await getProfile(u.id);
  $("#whoami") && ($("#whoami").textContent = `${profile?.full_name || u.email || ""} (${profile?.role || "submitter"})`);

  await loadMyReports("#reports-mine", u.id);
  if (roleIsSupervisor(profile?.role)) {
    $("#labgroup-wrap") && ($("#labgroup-wrap").style.display = "block");
    await loadLabgroupReports("#reports-labgroup");
  }
}

export async function bootDownloadsPage() {
  hookAuthButtons();
  const session = await getSession();
  if (!session) { show("login"); return; }
  const u = session.user;
  const profile = await getProfile(u.id);
  $("#whoami") && ($("#whoami").textContent = `${profile?.full_name || u.email || ""} (${profile?.role || "submitter"})`);
  await loadMyReports("#downloads-mine", u.id);
}

// Auto-detect which page to boot
document.addEventListener("DOMContentLoaded", () => {
  if ($("#page-dashboard") || $("#page-login")) return void bootIndex();
  if ($("#reports-root")) return void bootReportsPage();
  if ($("#downloads-root")) return void bootDownloadsPage();
});

