// ====== GANTI ENV DI BAWAH INI ======
window.SUPABASE_URL ="https://nemabrzkmiszlmylwfnt.supabase.co"
window.SUPABASE_ANON_KEY ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lbWFicnprbWlzemxteWx3Zm50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NDUwOTgsImV4cCI6MjA3MjEyMTA5OH0.7YYm4Q__xi9LxFJeQKD2O8yARWcj_pc8vnuMQ-Qqx1c"
window.SUPABASE_PROJECT_REF ="nemabrzkmiszlmylwfnt"

// ====== INIT SUPABASE CLIENT ======
window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, detectSessionInUrl: true }
});

// ====== AUTH UI HANDLERS ======
async function refreshAuthUI() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  const loginBtn = document.getElementById('btn-login');
  const logoutBtn = document.getElementById('btn-logout');
  const userArea = document.getElementById('user-area');
  const userEmail = document.getElementById('user-email');
  if (user) {
    if (loginBtn) loginBtn.classList.add('hidden');
    if (userArea) userArea.classList.remove('hidden');
    if (logoutBtn) logoutBtn.onclick = async () => { await supabaseClient.auth.signOut(); location.reload(); };
    if (userEmail) userEmail.textContent = user.email || '';
  } else {
    if (loginBtn) {
      loginBtn.classList.remove('hidden');
      loginBtn.onclick = async () => loginWithGoogle(location.href);
    }
    if (userArea) userArea.classList.add('hidden');
  }
}
window.loginWithGoogle = async (redirectTo) => {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });
  if (error) alert(error.message);
};

// ====== COMMON INIT ======
window.appInit = async () => {
  await refreshAuthUI();
  // attach handlers index
  const btnLoad = document.getElementById('btn-load');
  if (btnLoad) {
    btnLoad.onclick = async () => {
      const tbody = document.getElementById('tbl-lg-body');
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Memuat…</td></tr>`;
      const rows = await fetchLabGroups();
      if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="muted">Tidak ada data.</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(r => {
        const lg = r.lab_group_id;
        const lab = r.lab;
        const site = r.site;
        const status = r.status;
        const eta = r.eta_target || '';
        return `
          <tr>
            <td>${lg}</td>
            <td>${lab} / ${site}</td>
            <td>${status}</td>
            <td>${eta}</td>
            <td>
              <a class="btn" href="./report.html?id=${lg}">Preview</a>
              <button class="btn btn-outline" onclick="enqueueExport('${lg}')">Enqueue Export</button>
              <a class="btn" href="./download.html?id=${lg}">Unduh</a>
            </td>
          </tr>
        `;
      }).join('');
    };
  }
};

// ====== HELPERS ======
window.getJwt = async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session?.access_token || null;
};

async function ensureLogin() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    await window.loginWithGoogle(location.href);
    return false;
  }
  return true;
}

// ====== DATA FETCHERS ======
async function fetchLabGroups() {
  if (!(await ensureLogin())) return [];
  const { data, error } = await supabaseClient
    .from('v_my_labgroup_reports')
    .select('*')
    .order('lab_group_id', { ascending: false })
    .limit(50);
  if (error) { alert(error.message); return []; }
  return data || [];
}
window.rpcRenderReportHtml = async (labGroupId) => {
  if (!(await ensureLogin())) return '';
  const { data, error } = await supabaseClient.rpc('rpc_render_report_html', {
    p_lab_group_id: labGroupId,
    p_template_key: 'LABGROUP_REPORT_V1'
  });
  if (error) { alert(error.message); return ''; }
  return data || '';
};
window.enqueueExport = async (labGroupId) => {
  if (!(await ensureLogin())) return;
  const fileUri = `lims-reports/result/${labGroupId}/report.html`;
  const { data, error } = await supabaseClient.rpc('rpc_enqueue_report_export', {
    p_lab_group_id: labGroupId,
    p_template_key: 'LABGROUP_REPORT_V1',
    p_file_uri: fileUri
  });
  if (error) alert(error.message);
  else alert(`Job enqueued: ${data}`);
};

// ====== BOOT ======
window.addEventListener('DOMContentLoaded', window.appInit);
