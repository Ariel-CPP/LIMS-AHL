// ====== GANTI ENV DI BAWAH INI ======
window.SUPABASE_URL ="https://nemabrzkmiszlmylwfnt.supabase.co";
window.SUPABASE_ANON_KEY ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lbWFicnprbWlzemxteWx3Zm50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NDUwOTgsImV4cCI6MjA3MjEyMTA5OH0.7YYm4Q__xi9LxFJeQKD2O8yARWcj_pc8vnuMQ-Qqx1c";
window.SUPABASE_PROJECT_REF ="nemabrzkmiszlmylwfnt";

// ====== INIT SUPABASE CLIENT ======
window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, detectSessionInUrl: true }
});

// ====== AUTH ======
window.loginWithGoogle = async (redirectTo) => {
  const { error } = await window.supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });
  if (error) alert(error.message);
};
window.getJwt = async () => {
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  return session?.access_token || null;
};
async function refreshAuthUI() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  const loginBtn = document.getElementById('btn-login');
  const userArea = document.getElementById('user-area');
  const logoutBtn = document.getElementById('btn-logout');
  const userEmail = document.getElementById('user-email');

  if (user) {
    if (loginBtn) loginBtn.classList.add('hidden');
    if (userArea) userArea.classList.remove('hidden');
    if (logoutBtn) logoutBtn.onclick = async () => { await window.supabaseClient.auth.signOut(); location.reload(); };
    if (userEmail) userEmail.textContent = user.email || '';
  } else {
    if (loginBtn) {
      loginBtn.classList.remove('hidden');
      loginBtn.onclick = async () => window.loginWithGoogle(location.href);
    }
    if (userArea) userArea.classList.add('hidden');
  }
}

// ====== NAV / TABS ======
function bindNav() {
  const links = document.querySelectorAll('.nav-link');
  const panes = document.querySelectorAll('.tab-pane');
  links.forEach(a => {
    a.onclick = (e) => {
      e.preventDefault();
      const tab = a.getAttribute('data-tab');
      links.forEach(l => l.classList.remove('active'));
      a.classList.add('active');
      panes.forEach(p => p.classList.remove('active'));
      document.getElementById(`tab-${tab}`).classList.add('active');
    };
  });
  // landing hero buttons
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.onclick = () => {
      const tab = btn.getAttribute('data-goto');
      document.querySelector(`.nav-link[data-tab="${tab}"]`).click();
    };
  });
}

// ====== CLOCK ======
function startClocks() {
  const el1 = document.getElementById('clock');
  const el2 = document.getElementById('clock-big');
  const tick = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2,'0');
    const s = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    if (el1) el1.textContent = s;
    if (el2) el2.textContent = s;
  };
  tick();
  setInterval(tick, 1000);
}

// ====== CALENDAR ======
function buildCalendar() {
  const el = document.getElementById('calendar');
  if (!el) return;
  const today = new Date();
  let y = today.getFullYear();
  let m = today.getMonth();

  const render = () => {
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startDay = first.getDay(); // 0=Sun
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <button class="btn btn-outline" id="cal-prev">&lt;</button>
      <div><b>${first.toLocaleString('id-ID',{ month:'long' })} ${y}</b></div>
      <button class="btn btn-outline" id="cal-next">&gt;</button>
    </div>
    <table><thead><tr>
      <th>Min</th><th>Sen</th><th>Sel</th><th>Rab</th><th>Kam</th><th>Jum</th><th>Sab</th>
    </tr></thead><tbody><tr>`;

    // pad kosong
    for (let i=0;i<((startDay+6)%7);i++) html += `<td></td>`;

    let dow = (startDay+6)%7;
    for (let d=1; d<=last.getDate(); d++) {
      const cls = [];
      const isToday = (y===today.getFullYear() && m===today.getMonth() && d===today.getDate());
      if (isToday) cls.push('today');
      html += `<td><div class="day ${cls.join(' ')}" data-d="${d}">${d}</div></td>`;
      dow++;
      if (dow===7 && d<last.getDate()) { html += `</tr><tr>`; dow=0; }
    }
    html += `</tr></tbody></table>`;
    el.innerHTML = html;

    document.getElementById('cal-prev').onclick = () => { m--; if (m<0){m=11;y--;} render(); };
    document.getElementById('cal-next').onclick = () => { m++; if (m>11){m=0;y++;} render(); };
    el.querySelectorAll('.day').forEach(d => {
      d.onclick = () => {
        const picked = new Date(y, m, Number(d.getAttribute('data-d')));
        const fmt = picked.toISOString().slice(0,10);
        const out = document.getElementById('calendar-picked');
        if (out) out.textContent = `Tanggal dipilih: ${fmt}`;
      };
    });
  };
  render();
}

// ====== DASHBOARD DATA ======
async function ensureLogin() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  if (!user) { await window.loginWithGoogle(location.href); return false; }
  return true;
}
async function fetchLabGroups() {
  if (!(await ensureLogin())) return [];
  const { data, error } = await window.supabaseClient
    .from('v_my_labgroup_reports')
    .select('*')
    .order('lab_group_id', { ascending: false })
    .limit(50);
  if (error) { alert(error.message); return []; }
  return data || [];
}
window.rpcRenderReportHtml = async (labGroupId) => {
  if (!(await ensureLogin())) return '';
  const { data, error } = await window.supabaseClient.rpc('rpc_render_report_html', {
    p_lab_group_id: labGroupId,
    p_template_key: 'LABGROUP_REPORT_V1'
  });
  if (error) { alert(error.message); return ''; }
  return data || '';
};
window.enqueueExport = async (labGroupId) => {
  if (!(await ensureLogin())) return;
  const fileUri = `lims-reports/result/${labGroupId}/report.html`;
  const { data, error } = await window.supabaseClient.rpc('rpc_enqueue_report_export', {
    p_lab_group_id: labGroupId,
    p_template_key: 'LABGROUP_REPORT_V1',
    p_file_uri: fileUri
  });
  if (error) alert(error.message);
  else alert(`Job enqueued: ${data}`);
};

// bind tombol dashboard
function bindDashboard() {
  const btnLoad = document.getElementById('btn-load');
  const tbody = document.getElementById('tbl-lg-body');
  if (!btnLoad || !tbody) return;
  btnLoad.onclick = async () => {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Memuat…</td></tr>`;
    const rows = await fetchLabGroups();
    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Tidak ada data.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.lab_group_id}</td>
        <td>${r.lab} / ${r.site}</td>
        <td>${r.status}</td>
        <td>${r.eta_target ?? ''}</td>
        <td>
          <a class="btn" href="./report.html?id=${r.lab_group_id}">Preview</a>
          <button class="btn btn-outline" onclick="enqueueExport('${r.lab_group_id}')">Enqueue Export</button>
          <a class="btn" href="./download.html?id=${r.lab_group_id}">Unduh</a>
        </td>
      </tr>
    `).join('');
  };
}

// ====== SUBMIT SAMPLE ======
// Catatan: butuh RLS INSERT utk app.submission & app.sampling_event
async function submitSample(form) {
  if (!(await ensureLogin())) return;
  const fd = new FormData(form);
  const case_type = fd.get('case_type');
  const urgency = fd.get('urgency');
  const anamnesis = fd.get('anamnesis') || null;
  const division = fd.get('division') || null;
  const sampling_datetime = fd.get('sampling_datetime');
  const doc = fd.get('doc') ? Number(fd.get('doc')) : null;
  const shipping_date = fd.get('shipping_date');
  const lab = fd.get('lab');

  // 1) insert submission
  const { data: subm, error: e1 } = await window.supabaseClient
    .from('app.submission')
    .insert([{
      case_type, urgency, anamnesis, case_notes: division   // simpan divisi di case_notes sederhana
    }])
    .select('submission_id')
    .single();
  if (e1) { alert(e1.message); return; }

  // 2) insert sampling_event
  const { error: e2 } = await window.supabaseClient
    .from('app.sampling_event')
    .insert([{
      submission_id: subm.submission_id,
      sampling_datetime,
      doc,
      shipping_date
    }]);
  if (e2) { alert(e2.message); return; }

  // 3) buat minimal 1 lab_group (sesuai lab tujuan)
  const { error: e3 } = await window.supabaseClient
    .from('app.lab_group')
    .insert([{
      submission_id: subm.submission_id,
      lab,
      site: 'CENTRAL',        // sesuaikan jika mau pilih site di form
      status: 'REQUESTED'
    }]);
  if (e3) { alert(e3.message); return; }

  document.getElementById('submit-msg').textContent = 'Submit berhasil. Admin akan memverifikasi.';
  form.reset();
}

function bindSubmitForm() {
  const form = document.getElementById('form-submit');
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    document.getElementById('submit-msg').textContent = 'Mengirim…';
    try { await submitSample(form); }
    catch (err) { alert(String(err)); }
  };
}

// ====== BOOT ======
window.appInit = async () => {
  bindNav();
  await refreshAuthUI();
  bindDashboard();
  bindSubmitForm();
  startClocks();
  buildCalendar();
};

// auto-init
window.addEventListener('DOMContentLoaded', window.appInit);
