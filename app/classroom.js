import { firebaseConfig, isClassroomConfigured } from './firebase-config.js';

const sdkVersion = '12.19.0';
const sdk = name => import(`https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-${name}.js`);
const builtinIds = new Set(['open-strings', 'frets-0123', 'frets-0232', 'chromatic', 'simple-melody', 'string-switch', 'beginner-riff', 'fikrimin-ince-gulu']);
let auth, functions, app, api, gate, currentRole = '', teacherData = null, launchResolver = null, lastSyncedTabs = '';
const call = (name, data = {}) => api.callable(name)(data).then(result => result.data);
const status = message => { const node = gate?.querySelector('[data-classroom-status]'); if (node) node.textContent = message || ''; };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const localWorkspaceKeys = ['tabu-custom-tabs', 'tabu-tab-overrides', 'tabu-deleted-exercise-ids', 'tabu-progress-v1'];

function workspaceProgressKey(userKey) { return `tabu-progress-v1:${userKey}`; }
function readWorkspace(keys) { return Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])); }
function clearWorkspace(userKey = '') {
  for (const key of localWorkspaceKeys) localStorage.removeItem(key);
  if (userKey) localStorage.removeItem(workspaceProgressKey(userKey));
}
function activateWorkspace(role, uid) {
  const nextKey = `${role}:${uid}`, currentKey = localStorage.getItem('tabu-classroom-user-key');
  if (currentKey === nextKey) return;
  if (currentKey) {
    const current = readWorkspace(localWorkspaceKeys);
    current['tabu-progress-v1'] = localStorage.getItem(workspaceProgressKey(currentKey));
    localStorage.setItem(`tabu-workspace:${currentKey}`, JSON.stringify(current));
    clearWorkspace(currentKey);
  } else if (role === 'student') {
    const legacy = readWorkspace(localWorkspaceKeys);
    if (Object.values(legacy).some(value => value !== null)) localStorage.setItem('tabu-workspace:legacy', JSON.stringify(legacy));
    clearWorkspace();
  }
  const saved = localStorage.getItem(`tabu-workspace:${nextKey}`);
  if (saved) {
    try {
      const workspace = JSON.parse(saved);
      for (const key of localWorkspaceKeys) {
        const value = workspace[key];
        if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value);
      }
      const progress = workspace['tabu-progress-v1'];
      if (progress == null) localStorage.removeItem(workspaceProgressKey(nextKey)); else localStorage.setItem(workspaceProgressKey(nextKey), progress);
    } catch { clearWorkspace(nextKey); }
  } else if (!currentKey && role === 'teacher') {
    // First teacher login adopts this device’s existing local TABs and progress.
    const legacyProgress = localStorage.getItem('tabu-progress-v1');
    if (legacyProgress !== null) localStorage.setItem(workspaceProgressKey(nextKey), legacyProgress);
    const legacy = localStorage.getItem('tabu-workspace:legacy');
    if (legacy) {
      try {
        const workspace = JSON.parse(legacy);
        for (const key of ['tabu-custom-tabs', 'tabu-tab-overrides', 'tabu-deleted-exercise-ids']) if (workspace[key] !== null) localStorage.setItem(key, workspace[key]);
        if (workspace['tabu-progress-v1'] !== null) localStorage.setItem(workspaceProgressKey(nextKey), workspace['tabu-progress-v1']);
        localStorage.removeItem('tabu-workspace:legacy');
      } catch { }
    }
  }
  localStorage.setItem('tabu-classroom-user-key', nextKey);
}

function persistActiveWorkspace() {
  const currentKey = localStorage.getItem('tabu-classroom-user-key');
  if (!currentKey) return;
  const workspace = readWorkspace(localWorkspaceKeys);
  workspace['tabu-progress-v1'] = localStorage.getItem(workspaceProgressKey(currentKey));
  localStorage.setItem(`tabu-workspace:${currentKey}`, JSON.stringify(workspace));
  clearWorkspace(currentKey);
  localStorage.removeItem('tabu-classroom-user-key');
}

function baseMarkup() {
  gate = document.createElement('section');
  gate.id = 'classroom-gate';
  gate.setAttribute('aria-live', 'polite');
  gate.innerHTML = `<div class="classroom-gate-card"><header><b>GİTARİST <span>♫</span></b><button type="button" data-classroom-action="hide" class="classroom-close" aria-label="Uygulamaya geç" hidden>✕</button></header><div data-classroom-content></div><p class="classroom-status" data-classroom-status role="status"></p></div>`;
  document.body.append(gate);
  gate.addEventListener('click', handleClick);
  gate.addEventListener('submit', handleSubmit);
  gate.addEventListener('change', handleChange);
}

function roleChoice() {
  currentRole = '';
  gate.querySelector('.classroom-close').hidden = true;
  gate.querySelector('[data-classroom-content]').innerHTML = `<h1>Nasıl devam edeceksin?</h1><p>Öğretmen veya öğrenci olarak giriş yap.</p><div class="classroom-role-actions"><button class="primary-button" data-classroom-action="teacher-form">Öğretmen girişi</button><button class="control-button" data-classroom-action="student-form">Öğrenci girişi</button></div>`;
  status('');
}

function teacherForm() {
  currentRole = 'teacher';
  gate.querySelector('.classroom-close').hidden = true;
  gate.querySelector('[data-classroom-content]').innerHTML = `<button class="classroom-back" data-classroom-action="back">← Geri</button><h1>Öğretmen girişi</h1><p>TAB’ları ve öğrenci çalışmalarını yönet.</p><form data-classroom-form="teacher"><label>E-posta<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>Şifre<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><div class="classroom-role-actions"><button class="primary-button" name="intent" value="login">Giriş yap</button><button class="control-button" name="intent" value="signup">Hesap oluştur</button></div></form><div class="classroom-divider"><span>veya</span></div><button type="button" class="control-button classroom-google-button" data-classroom-action="google-login"><b aria-hidden="true">G</b> Google ile giriş yap / hesap oluştur</button>`;
  status('');
}

function studentForm() {
  currentRole = 'student';
  gate.querySelector('.classroom-close').hidden = true;
  gate.querySelector('[data-classroom-content]').innerHTML = `<button class="classroom-back" data-classroom-action="back">← Geri</button><h1>Öğrenci girişi</h1><p>Öğretmeninin verdiği 7 karakterli kodu yaz.</p><form data-classroom-form="student"><label>Katılım kodu<input name="code" inputmode="text" autocomplete="one-time-code" autocapitalize="characters" minlength="7" maxlength="7" required></label><button class="primary-button">Koda bağlan</button></form>`;
  status('');
}

async function mergeLibrary(remoteTabs) {
  const data = api.exerciseData.exercises;
  let deleted = new Set();
  try { deleted = new Set(JSON.parse(localStorage.getItem('tabu-deleted-exercise-ids') || '[]')); } catch { }
  const local = data.filter(item => !deleted.has(item.id));
  const remote = remoteTabs.filter(item => !deleted.has(item.id));
  if (!remote.length) {
    const exported = local.map(exportTab);
    await saveTabsInBatches(exported);
    lastSyncedTabs = JSON.stringify(exported);
    return local;
  }
  const remoteIds = new Set(remote.map(item => item.id));
  const missingLocal = local.filter(item => !remoteIds.has(item.id));
  const merged = new Map(local.map(item => [item.id, item]));
  for (const tab of remote) merged.set(tab.id, tab);
  const result = [...merged.values()];
  data.splice(0, data.length, ...result);
  localStorage.setItem('tabu-custom-tabs', JSON.stringify(result.filter(item => !builtinIds.has(item.id))));
  localStorage.setItem('tabu-tab-overrides', JSON.stringify(result.filter(item => builtinIds.has(item.id))));
  if (missingLocal.length) await saveTabsInBatches(missingLocal.map(exportTab));
  const exported = result.map(exportTab);
  lastSyncedTabs = JSON.stringify(exported);
  return result;
}

function exportTab(tab) {
  const values = Object.values(tab.data || {}).flat();
  const hasTiming = values.some(note => note && typeof note === 'object'
    && (Number.isFinite(note.startTime) || Number.isFinite(note.durationBeats)
      || (Number.isFinite(note.timeBeats) && !Number.isInteger(note.timeBeats))));
  const category = ['solo', 'rhythm', 'arpeggio', 'chord'].includes(tab.category)
    ? tab.category : tab.mode === 'arpeggio' ? 'arpeggio' : tab.mode === 'chord' ? 'chord' : hasTiming ? 'rhythm' : 'solo';
  return { id: tab.id, title: tab.title, category, mode: tab.mode || category, bpm: Number(tab.bpm) || 80, data: tab.data };
}

async function saveTabsInBatches(tabs) {
  for (let offset = 0; offset < tabs.length; offset += 25) await call('saveTeacherTabs', { tabs: tabs.slice(offset, offset + 25) });
}

async function loadTeacherLibrary() {
  const tabs = []; let after = null;
  for (let page = 0; page < 10; page++) {
    const result = await call('teacherTabLibrary', after ? { after } : {});
    tabs.push(...result.tabs);
    if (!result.nextCursor) return tabs;
    after = result.nextCursor;
  }
  throw new Error('TAB kitaplığı 400 çalışmayı aşıyor. Eşitleme için daha küçük bir kitaplık kullan.');
}

async function teacherPanel(newCode = null) {
  await syncTeacherTabsInBackground();
  const now = Date.now(), selectedStudentId = teacherData?.selectedStudentId || null;
  const refreshDashboard = Boolean(newCode || !teacherData?.dashboard || now - (teacherData.dashboardFetchedAt || 0) > 15_000);
  const refreshDetail = Boolean(selectedStudentId && (!teacherData?.detail || teacherData.detailStudentId !== selectedStudentId || now - (teacherData.detailFetchedAt || 0) > 15_000));
  const [dashboard, detail] = await Promise.all([
    refreshDashboard ? call('teacherDashboard') : Promise.resolve(teacherData.dashboard),
    selectedStudentId ? (refreshDetail ? call('teacherStudentDetail', { studentId: selectedStudentId }).catch(() => null) : Promise.resolve(teacherData.detail)) : Promise.resolve(null)
  ]);
  teacherData = { ...(teacherData || {}), dashboard, detail, detailStudentId: selectedStudentId,
    dashboardFetchedAt: refreshDashboard ? now : teacherData.dashboardFetchedAt,
    detailFetchedAt: refreshDetail ? now : teacherData.detailFetchedAt };
  const assignableTabs = (api.exerciseData?.exercises || []).map(exportTab);
  const staleAssignedTabs = (detail?.assignedTabIds || []).filter(id => !localIds.has(id)).map(id => ({ id, title: `Bu cihazda bulunmayan TAB (${id})`, category: 'eski atama' }));
  const assignmentTabs = [...assignableTabs, ...staleAssignedTabs];
  const roster = dashboard.students.map(student => `<button class="classroom-student-row ${teacherData.selectedStudentId === student.id ? 'selected' : ''}" data-classroom-action="student-detail" data-student-id="${escapeHtml(student.id)}"><b>${escapeHtml(student.name)}</b><span>${Math.floor((student.stats.seconds || 0) / 60)} dk · ${student.stats.sessions || 0} çalışma · ${student.stats.notes ? Math.round(student.stats.correct / student.stats.notes * 100) : 0}% doğruluk</span></button>`).join('');
  const detailPanel = detail ? `<section class="classroom-subpanel"><h2>${escapeHtml(detail.name)} · atanan TAB’lar</h2><div class="classroom-tab-assignments">${assignmentTabs.map(tab => `<label><input type="checkbox" data-classroom-assignment data-student-id="${escapeHtml(teacherData.selectedStudentId)}" data-tab-id="${escapeHtml(tab.id)}" ${detail.assignedTabIds.includes(tab.id) ? 'checked' : ''}><span>${escapeHtml(tab.title)}</span><small>${escapeHtml(tab.category)}</small></label>`).join('') || '<p>Henüz TAB yok.</p>'}</div><h3>Çalışılan TAB’lar</h3>${detail.tabStats.length ? detail.tabStats.map(tab => `<div class="classroom-stat-row"><b>${escapeHtml(tab.title)}</b><span>${Math.floor((tab.seconds || 0) / 60)} dk · ${tab.sessions || 0} çalışma · ${tab.notes ? Math.round((tab.correct || 0) / tab.notes * 100) : 0}% doğruluk</span></div>`).join('') : '<p class="classroom-muted">Henüz çalışma kaydı yok.</p>'}</section>` : '<p class="classroom-muted">Öğrenci istatistiklerini ve TAB atamalarını görmek için öğrenciyi seç.</p>';
  gate.querySelector('.classroom-close').hidden = false;
  gate.querySelector('[data-classroom-content]').innerHTML = `<div class="classroom-panel-heading"><div><span class="classroom-eyebrow">ÖĞRETMEN PANELİ</span><h1>Öğrencilerim</h1></div><button class="control-button" data-classroom-action="logout">Çıkış</button></div>${newCode ? `<div class="classroom-code-notice"><b>Öğrenci katılım kodu</b><strong>${escapeHtml(newCode)}</strong><small>Kodu öğrenciye güvenli biçimde ilet. Bu kod yalnızca şimdi gösteriliyor.</small></div>` : ''}<form class="classroom-create-student" data-classroom-form="create-student"><label>Yeni öğrenci<input name="displayName" maxlength="80" placeholder="Öğrencinin adı" required></label><button class="primary-button">＋ Öğrenci ekle</button></form><div class="classroom-roster">${roster || '<p class="classroom-muted">Henüz öğrenci yok. İlk öğrenciyi ekleyerek katılım kodu oluştur.</p>'}</div>${detailPanel}<div class="classroom-panel-actions"><button class="primary-button" data-classroom-action="launch">Uygulamaya geç</button><button class="control-button" data-classroom-action="logout">Çıkış yap</button></div>`;
  status('');
}

function studentPanel(catalog) {
  currentRole = 'student';
  const cards = catalog.tabs.map(tab => `<button class="classroom-assigned-tab ${teacherData?.selectedTabId === tab.id ? 'selected' : ''}" data-classroom-action="select-tab" data-tab-id="${escapeHtml(tab.id)}"><b>${escapeHtml(tab.title)}</b><span>${escapeHtml(({ solo: 'Solo', rhythm: 'Ritm', arpeggio: 'Arpej', chord: 'Akor' })[tab.category] || 'TAB')} · ${tab.bpm} BPM</span></button>`).join('');
  gate.querySelector('.classroom-close').hidden = false;
  gate.querySelector('[data-classroom-content]').innerHTML = `<div class="classroom-panel-heading"><div><span class="classroom-eyebrow">ÖĞRENCİ</span><h1>Merhaba, ${escapeHtml(catalog.studentName)}</h1></div><button class="control-button" data-classroom-action="logout">Çıkış</button></div><p>Yalnızca sana atanan TAB’lar listeleniyor.</p><div class="classroom-assigned-list">${cards || '<p class="classroom-muted">Henüz TAB atanmadı. Öğretmeninden çalışma atamasını iste.</p>'}</div><div class="classroom-panel-actions"><button class="primary-button" data-classroom-action="launch" ${teacherData?.selectedTabId ? '' : 'disabled'}>Seçili TAB ile çalış</button></div>`;
  status('');
}

async function initializeTeacher(user) {
  currentRole = 'teacher';
  activateWorkspace('teacher', user.uid);
  localStorage.setItem('tabu-classroom-role', 'teacher');
  const [dataModule, remoteTabs] = await Promise.all([import('./data.js?v=3'), loadTeacherLibrary()]);
  api.exerciseData = dataModule;
  await mergeLibrary(remoteTabs);
  teacherData = { user, dashboard: null, detail: null, selectedStudentId: null };
  await teacherPanel();
}

async function initializeStudent(user) {
  currentRole = 'student';
  activateWorkspace('student', user.uid);
  localStorage.setItem('tabu-classroom-role', 'student');
  const catalog = await call('studentCatalog');
  localStorage.setItem('tabu-classroom-assigned-tabs', JSON.stringify(catalog.tabs));
  localStorage.removeItem('tabu-custom-tabs');
  localStorage.removeItem('tabu-tab-overrides');
  localStorage.removeItem('tabu-deleted-exercise-ids');
  if (location.hash === '#editor') history.replaceState(null, '', '#practice');
  const dataModule = await import('./data.js?v=3');
  api.exerciseData = dataModule;
  dataModule.exercises.splice(0, dataModule.exercises.length, ...catalog.tabs);
  teacherData = { user, catalog, selectedTabId: catalog.tabs[0]?.id || null };
  studentPanel(catalog);
}

async function handleClick(event) {
  const button = event.target.closest('[data-classroom-action]');
  if (!button) return;
  const action = button.dataset.classroomAction;
  try {
    if (action === 'teacher-form') teacherForm();
    else if (action === 'student-form') studentForm();
    else if (action === 'google-login') {
      status('Google hesabı açılıyor…');
      const provider = new api.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await api.auth.signInWithPopup(auth, provider);
    }
    else if (action === 'back') roleChoice();
    else if (action === 'hide') { gate.hidden = true; document.body.classList.remove('classroom-auth-active'); }
    else if (action === 'logout') { await api.auth.signOut(auth); location.reload(); }
    else if (action === 'student-detail') { teacherData.selectedStudentId = button.dataset.studentId; await teacherPanel(); }
    else if (action === 'select-tab') { teacherData.selectedTabId = button.dataset.tabId; studentPanel(teacherData.catalog); }
    else if (action === 'launch') {
      if (currentRole === 'student' && !teacherData?.selectedTabId) return;
      const selected = currentRole === 'student' ? teacherData.catalog.tabs.find(tab => tab.id === teacherData.selectedTabId) : null;
      if (selected) localStorage.setItem('tabu-selected-exercise', selected.id);
      gate.hidden = true;
      document.body.classList.remove('classroom-auth-active');
      launchResolver?.();
      if (currentRole === 'teacher') syncTeacherTabsInBackground();
    }
  } catch (error) { status(authErrorMessage(error)); }
}

function authErrorMessage(error) {
  const messages = {
    'auth/operation-not-allowed': 'Bu giriş yöntemi Firebase Authentication’da etkin değil. Proje ayarlarını kontrol et.',
    'auth/unauthorized-domain': 'Bu site Firebase Authentication’ın yetkili alan adları listesinde değil.',
    'auth/popup-blocked': 'Tarayıcı giriş penceresini engelledi. Açılır pencereye izin verip yeniden dene.',
    'auth/popup-closed-by-user': 'Google giriş penceresi kapatıldı.',
    'auth/account-exists-with-different-credential': 'Bu e-posta başka bir giriş yöntemiyle kayıtlı. E-posta ve şifreyle giriş yap.',
    'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.',
    'auth/weak-password': 'Daha güçlü bir şifre seç.',
    'auth/invalid-credential': 'E-posta veya şifre hatalı.'
  };
  return messages[error?.code] || error?.message || 'İşlem tamamlanamadı. Yeniden dene.';
}

async function handleSubmit(event) {
  const form = event.target.closest('[data-classroom-form]');
  if (!form) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  try {
    status('Bağlanıyor…');
    if (form.dataset.classroomForm === 'teacher') {
      const action = event.submitter?.value || 'login';
      if (action === 'signup') await api.auth.createUserWithEmailAndPassword(auth, values.email, values.password);
      else await api.auth.signInWithEmailAndPassword(auth, values.email, values.password);
    } else if (form.dataset.classroomForm === 'student') {
      const { token } = await call('studentLogin', { code: String(values.code).toUpperCase() });
      await api.auth.signInWithCustomToken(auth, token);
    } else if (form.dataset.classroomForm === 'create-student') {
      const created = await call('createStudent', { displayName: values.displayName });
      await teacherPanel(created.code);
    }
  } catch (error) { status(authErrorMessage(error)); }
}

async function handleChange(event) {
  const input = event.target.closest('[data-classroom-assignment]');
  if (!input) return;
  input.disabled = true;
  try {
    const args = { studentId: input.dataset.studentId, tabId: input.dataset.tabId };
    await call(input.checked ? 'assignTab' : 'removeTabAssignment', args);
    status(input.checked ? 'TAB öğrenciye atandı.' : 'TAB ataması kaldırıldı.');
  } catch (error) { input.checked = !input.checked; status(error?.message || 'Atama güncellenemedi.'); }
  finally { input.disabled = false; }
}

async function syncTeacherTabsInBackground() {
  if (currentRole !== 'teacher' || !api.exerciseData) return;
  const custom = api.exerciseData.exercises.map(exportTab), signature = JSON.stringify(custom);
  if (signature === lastSyncedTabs) return;
  try { await saveTabsInBatches(custom); lastSyncedTabs = signature; }
  catch (error) { console.warn('Öğretmen TAB’ları eşitlenemedi:', error); }
}

export async function startClassroom() {
  if (!isClassroomConfigured) return false;
  baseMarkup();
  document.body.classList.add('classroom-auth-active');
  document.querySelector('.app-shell').hidden = true;
  document.querySelector('.bottom-nav').hidden = true;
  let appSdk, authSdk, functionsSdk, appCheckSdk;
  try {
    [appSdk, authSdk, functionsSdk] = await Promise.all([sdk('app'), sdk('auth'), sdk('functions')]);
    if (firebaseConfig.appCheckSiteKey) appCheckSdk = await sdk('app-check');
  }
  catch (error) { status('Güvenli giriş servisine bağlanılamadı. İnternet bağlantısını kontrol edip yeniden yükle.'); throw error; }
  app = appSdk.initializeApp(firebaseConfig);
  if (appCheckSdk && firebaseConfig.appCheckSiteKey) {
    appCheckSdk.initializeAppCheck(app, { provider: new appCheckSdk.ReCaptchaV3Provider(firebaseConfig.appCheckSiteKey), isTokenAutoRefreshEnabled: true });
  }
  auth = authSdk.getAuth(app);
  functions = functionsSdk.getFunctions(app, 'europe-west1');
  api = { auth: authSdk, callable: name => functionsSdk.httpsCallable(functions, name), exerciseData: null };
  await new Promise((resolve, reject) => {
    launchResolver = resolve;
    authSdk.onAuthStateChanged(auth, async user => {
      try {
        if (!user) { roleChoice(); return; }
        status('Hesap yükleniyor…');
        const identity = await authSdk.getIdTokenResult(user, true);
        if (identity.claims.role === 'student') await initializeStudent(user);
        else await initializeTeacher(user);
        gate.hidden = false;
      } catch (error) { status(error?.message || 'Hesap yüklenemedi.'); }
    }, reject);
  });
  window.TabuClassroom = {
    role: () => currentRole,
    syncTabs: syncTeacherTabsInBackground,
    open: async () => {
      gate.classList.remove('minimized'); gate.hidden = false;
      if (currentRole === 'teacher') await teacherPanel();
      else if (currentRole === 'student' && teacherData?.catalog) studentPanel(teacherData.catalog);
    },
    report: async summary => {
      if (currentRole !== 'student' || !summary?.tabId) return;
      try { await call('submitPracticeSummary', { ...summary, sessionId: crypto.randomUUID() }); }
      catch (error) { console.warn('Çalışma özeti eşitlenemedi:', error); }
    }
  };
  document.querySelector('.top-actions')?.insertAdjacentHTML('beforeend', '<button class="classroom-launcher" type="button" aria-label="Öğretmen ve öğrenci paneli">☰</button>');
  document.querySelector('.classroom-launcher')?.addEventListener('click', () => window.TabuClassroom.open());
  const toast = document.querySelector('#toast');
  if (toast) new MutationObserver(() => { if (currentRole === 'teacher' && toast.textContent.includes('TAB kaydedildi')) void syncTeacherTabsInBackground(); }).observe(toast, { childList: true, characterData: true, subtree: true });
  document.querySelector('.app-shell').hidden = false;
  document.querySelector('.bottom-nav').hidden = false;
  document.body.classList.remove('classroom-auth-active');
  if (localStorage.getItem('tabu-classroom-role') === 'student') document.body.classList.add('classroom-student-mode');
  document.addEventListener('click', event => {
    if (localStorage.getItem('tabu-classroom-role') !== 'student') return;
    const route = event.target.closest('[data-route="editor"]');
    const action = event.target.closest('[data-action]')?.dataset.action;
    const forbidden = new Set(['edit-tab', 'save-tab', 'save-tab-category', 'add-note', 'delete-note', 'delete-exercise', 'editor-undo', 'editor-clear', 'clear-selected-tempo', 'add-measure', 'open-sync', 'sync-save', 'sync-mark', 'sync-undo', 'sync-delete-time']);
    if (!route && !forbidden.has(action)) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  document.addEventListener('change', event => {
    if (localStorage.getItem('tabu-classroom-role') === 'student' && event.target.id === 'exercise-select') localStorage.setItem('tabu-selected-exercise', event.target.value);
  }, true);
  return true;
}

