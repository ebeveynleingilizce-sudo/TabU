import { createHmac, randomInt } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldPath, FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

// Keep the deployed runtime configuration change visible to Firebase CLI source hashing.
const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
if (emulator && (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST
  || !(process.env.GCLOUD_PROJECT || '').startsWith('demo-'))) throw new Error('Only demo Firebase emulators are allowed.');
initializeApp();
const db = getFirestore();
const hmacSecret = defineSecret('STUDENT_CODE_HMAC');
// App Check is optional; authentication, callable role checks, rate limiting,
// and Firestore rules still protect classroom data and operations.
const opts = { region: 'europe-west1', minInstances: 0, maxInstances: 3,
  enforceAppCheck: false, secrets: emulator ? [] : [hmacSecret] };
const secret = () => emulator ? 'tabu-emulator-only-student-code-secret' : hmacSecret.value();
const codeHash = (code: string) => createHmac('sha256', secret()).update(code).digest('hex');
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode = () => Array.from({ length: 7 }, () => alphabet[randomInt(alphabet.length)]).join('');
const teacherRoot = (uid: string) => db.collection('teachers').doc(uid);
const studentRef = (uid: string, sid: string) => teacherRoot(uid).collection('students').doc(sid);
const studentSessionRef = (uid: string) => db.collection('studentSessions').doc(uid);
const id = (value: unknown, label = 'kimlik') => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError('invalid-argument', `Geçersiz ${label}.`);
  return value;
};
const text = (value: unknown, label: string, max = 80) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new HttpsError('invalid-argument', `${label} alanını kontrol et.`);
  return value.trim();
};
function requireTeacher(request: CallableRequest) {
  const provider = request.auth?.token.firebase?.sign_in_provider;
  if (!request.auth || !['password', 'google.com'].includes(String(provider))) throw new HttpsError('permission-denied', 'Öğretmen girişi gerekli.');
  return request.auth.uid;
}
function requireStudent(request: CallableRequest) {
  if (!request.auth || request.auth.token.role !== 'student') throw new HttpsError('permission-denied', 'Öğrenci girişi gerekli.');
  return request.auth.uid;
}
function validTab(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpsError('invalid-argument', 'TAB verisi geçersiz.');
  const tab = data as Record<string, unknown>;
  const tabId = id(tab.id, 'TAB kimliği');
  const title = text(tab.title, 'TAB adı', 100);
  const category = tab.category;
  if (!['solo', 'rhythm', 'arpeggio', 'chord'].includes(String(category))) throw new HttpsError('invalid-argument', 'TAB türü geçersiz.');
  if (!Number.isInteger(tab.bpm) || Number(tab.bpm) < 40 || Number(tab.bpm) > 220) throw new HttpsError('invalid-argument', 'Tempo 40–220 arasında olmalı.');
  if (!tab.data || typeof tab.data !== 'object' || Array.isArray(tab.data)) throw new HttpsError('invalid-argument', 'Nota verisi geçersiz.');
  const dataByString = tab.data as Record<string, unknown>;
  const strings = ['e', 'B', 'G', 'D', 'A', 'E'];
  const normalizedData: Record<string, unknown[]> = {};
  let noteCount = 0;
  for (const string of Object.keys(dataByString)) {
    if (!strings.includes(string) || !Array.isArray(dataByString[string])) throw new HttpsError('invalid-argument', 'Tel verisi geçersiz.');
    const notes = dataByString[string] as unknown[];
    noteCount += notes.length;
    normalizedData[string] = notes.map(note => {
      // Older built-in exercises store each fret as a number; normalize those
      // into the object form used by the editor and playback UI.
      if (Number.isInteger(note)) {
        if (Number(note) < 0 || Number(note) > 24) throw new HttpsError('invalid-argument', 'Perde 0–24 arasında olmalı.');
        return { fret: Number(note) };
      }
      if (!note || typeof note !== 'object' || Array.isArray(note)) throw new HttpsError('invalid-argument', 'Nota verisi geçersiz.');
      const n = note as Record<string, unknown>;
      if (!Number.isInteger(n.fret) || Number(n.fret) < 0 || Number(n.fret) > 24) throw new HttpsError('invalid-argument', 'Perde 0–24 arasında olmalı.');
      for (const key of ['startTime', 'timeBeats', 'durationBeats']) if (n[key] !== undefined && (!Number.isFinite(n[key]) || Number(n[key]) < 0 || Number(n[key]) > 86400)) throw new HttpsError('invalid-argument', 'Nota zamanlaması geçersiz.');
      return n;
    });
  }
  if (!noteCount || noteCount > 1500) throw new HttpsError('invalid-argument', 'TAB 1–1500 nota içermeli.');
  const sanitized = { id: tabId, title, category, mode: String(tab.mode || category), bpm: Number(tab.bpm), data: normalizedData };
  if (JSON.stringify(sanitized).length > 180_000) throw new HttpsError('invalid-argument', 'TAB dosyası çok büyük.');
  return sanitized;
}

export const createStudent = onCall(opts, async request => {
  const uid = requireTeacher(request), displayName = text(request.data?.displayName, 'Öğrenci adı', 80);
  const ref = teacherRoot(uid).collection('students').doc();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = newCode(), hash = codeHash(code), index = db.collection('studentCodeIndex').doc(hash);
    const created = await db.runTransaction(async tx => {
      const existing = await tx.get(index);
      if (existing.exists) return false;
      tx.create(ref, { studentId: ref.id, teacherUid: uid, displayName, codeHash: hash, status: 'active', credentialVersion: 1, createdAt: FieldValue.serverTimestamp() });
      tx.create(ref.collection('analytics').doc('summary'), { sessions: 0, seconds: 0, correct: 0, evaluated: 0, tabsWorked: 0, lastWorkedAt: null, version: 1 });
      tx.create(index, { teacherUid: uid, studentId: ref.id, credentialVersion: 1, revoked: false });
      return true;
    });
    if (created) return { studentId: ref.id, displayName, code };
  }
  throw new HttpsError('resource-exhausted', 'Katılım kodu oluşturulamadı. Yeniden dene.');
});

export const studentLogin = onCall(opts, async request => {
  const code = typeof request.data?.code === 'string' ? request.data.code.trim().toUpperCase() : '';
  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}$/.test(code)) throw new HttpsError('unauthenticated', 'Katılım kodu geçersiz.');
  const limiter = db.collection('loginLimits').doc(codeHash('ip:' + (request.rawRequest.ip || 'unknown')));
  const permitted = await db.runTransaction(async tx => {
    const ref = await tx.get(limiter), now = Date.now(), old = ref.data();
    const fresh = !old || now - Number(old.windowStart) >= 60_000, count = fresh ? 0 : Number(old.count || 0);
    if (count >= 15) return false;
    tx.set(limiter, { windowStart: fresh ? now : old!.windowStart, count: count + 1 });
    return true;
  });
  if (!permitted) throw new HttpsError('resource-exhausted', 'Çok fazla deneme oldu. Bir dakika sonra yeniden dene.');
  const index = db.collection('studentCodeIndex').doc(codeHash(code));
  let binding: { teacherUid: string; studentId: string; credentialVersion: number } | undefined;
  await db.runTransaction(async tx => {
    const indexSnap = await tx.get(index);
    if (!indexSnap.exists || indexSnap.data()!.revoked) throw new HttpsError('unauthenticated', 'Katılım kodu geçersiz veya yenilenmiş.');
    const identity = indexSnap.data()!;
    const profile = await tx.get(studentRef(identity.teacherUid, identity.studentId));
    if (!profile.exists || profile.data()!.status !== 'active' || profile.data()!.credentialVersion !== identity.credentialVersion) throw new HttpsError('unauthenticated', 'Katılım kodu geçersiz veya yenilenmiş.');
    binding = { teacherUid: identity.teacherUid, studentId: identity.studentId, credentialVersion: identity.credentialVersion };
    const sessionUid = `student_${codeHash(`${identity.teacherUid}:${identity.studentId}`).slice(0, 24)}_v${identity.credentialVersion}`;
    tx.set(studentSessionRef(sessionUid), { ...binding, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  if (!binding) throw new HttpsError('unauthenticated', 'Katılım kodu geçersiz.');
  const uid = `student_${codeHash(`${binding.teacherUid}:${binding.studentId}`).slice(0, 24)}_v${binding.credentialVersion}`;
  return { token: await getAuth().createCustomToken(uid, { role: 'student', ...binding }) };
});

export const saveTeacherTabs = onCall({ ...opts, maxInstances: 2 }, async request => {
  const uid = requireTeacher(request), tabs = request.data?.tabs;
  if (!Array.isArray(tabs) || tabs.length > 100) throw new HttpsError('invalid-argument', 'En fazla 100 TAB eşitlenebilir.');
  const normalized = tabs.map(validTab), unique = new Set(normalized.map(t => t.id));
  if (unique.size !== normalized.length) throw new HttpsError('invalid-argument', 'TAB kimlikleri benzersiz olmalı.');
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > 7_000_000) throw new HttpsError('resource-exhausted', 'TAB kitaplığı çok büyük; daha küçük gruplar halinde eşitle.');
  const batch = db.batch(), root = teacherRoot(uid);
  for (const tab of normalized) batch.set(root.collection('tabs').doc(tab.id), { ...tab, ownerUid: uid, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return { saved: normalized.length };
});

export const assignTab = onCall(opts, async request => {
  const uid = requireTeacher(request), sid = id(request.data?.studentId, 'öğrenci kimliği'), tid = id(request.data?.tabId, 'TAB kimliği');
  const student = studentRef(uid, sid), tab = teacherRoot(uid).collection('tabs').doc(tid), assignment = student.collection('assignments').doc(tid);
  await db.runTransaction(async tx => {
    const [profile, tabSnap] = await tx.getAll(student, tab);
    if (!profile.exists || profile.data()!.status !== 'active') throw new HttpsError('not-found', 'Öğrenci bulunamadı.');
    if (!tabSnap.exists) throw new HttpsError('not-found', 'TAB bulunamadı.');
    tx.set(assignment, { tabId: tid, teacherUid: uid, assignedAt: FieldValue.serverTimestamp(), active: true });
  });
  return { ok: true };
});

export const removeTabAssignment = onCall(opts, async request => {
  const uid = requireTeacher(request), sid = id(request.data?.studentId), tid = id(request.data?.tabId);
  await studentRef(uid, sid).collection('assignments').doc(tid).delete();
  return { ok: true };
});

export const teacherDashboard = onCall(opts, async request => {
  const uid = requireTeacher(request), root = teacherRoot(uid);
  const students = await root.collection('students').where('status', '==', 'active').limit(200).get();
  const summaries = students.empty ? [] : await db.getAll(...students.docs.map(s => s.ref.collection('analytics').doc('summary')));
  return { students: students.docs.map((s, i) => ({ id: s.id, name: s.data().displayName, code: undefined,
    stats: summaries[i]?.data() || { sessions: 0, seconds: 0, correct: 0, evaluated: 0, tabsWorked: 0 },
    activeTabIds: [] })) };
});

export const teacherTabLibrary = onCall(opts, async request => {
  const uid = requireTeacher(request), query = teacherRoot(uid).collection('tabs').orderBy('title').orderBy(FieldPath.documentId());
  let page = query;
  if (request.data?.after !== undefined) {
    const after = request.data.after;
    if (!after || typeof after.title !== 'string' || typeof after.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(after.id)) throw new HttpsError('invalid-argument', 'Geçersiz sayfa anahtarı.');
    page = query.startAfter(after.title, after.id);
  }
  const snapshot = await page.limit(40).get(), last = snapshot.docs.at(-1);
  return { tabs: snapshot.docs.map(row => { const tab = row.data(); return { id: row.id, title: tab.title, category: tab.category, mode: tab.mode, bpm: tab.bpm, data: tab.data }; }),
    nextCursor: snapshot.size === 40 && last ? { title: String(last.data().title), id: last.id } : null };
});

export const teacherStudentDetail = onCall(opts, async request => {
  const uid = requireTeacher(request), sid = id(request.data?.studentId), student = studentRef(uid, sid);
  const profile = await student.get();
  if (!profile.exists) throw new HttpsError('not-found', 'Öğrenci bulunamadı.');
  const [assignments, summary, tabStats] = await Promise.all([student.collection('assignments').get(), student.collection('analytics').doc('summary').get(), student.collection('analytics').doc('tabs').collection('items').limit(100).get()]);
  const assigned = assignments.docs.map(d => d.id), tabIds = tabStats.docs.map(d => d.id);
  const tabs = tabIds.length ? await db.getAll(...tabIds.map(tid => teacherRoot(uid).collection('tabs').doc(tid))) : [];
  const titleById = new Map(tabs.map(t => [t.id, t.data()?.title || 'Silinmiş TAB']));
  return { name: profile.data()?.displayName || '', summary: summary.data() || {},
    assignedTabIds: assigned, tabStats: tabStats.docs.map(row => ({ tabId: row.id, title: titleById.get(row.id) || row.id, ...row.data() })) };
});

export const studentCatalog = onCall(opts, async request => {
  const uid = requireStudent(request), session = await studentSessionRef(uid).get(), binding = session.data();
  if (!binding) throw new HttpsError('unauthenticated', 'Oturum geçersiz. Yeniden kod gir.');
  const profile = studentRef(binding.teacherUid, binding.studentId), [student, assignments] = await Promise.all([profile.get(), profile.collection('assignments').where('active', '==', true).limit(100).get()]);
  if (!student.exists || student.data()!.status !== 'active' || student.data()!.credentialVersion !== binding.credentialVersion) throw new HttpsError('unauthenticated', 'Öğrenci profili artık etkin değil.');
  const tabRefs = assignments.docs.map(a => teacherRoot(binding.teacherUid).collection('tabs').doc(a.id));
  const tabs = tabRefs.length ? await db.getAll(...tabRefs) : [];
  return { studentName: student.data()!.displayName, tabs: tabs.filter(t => t.exists).map(t => { const tab = t.data()!; return { id: t.id, title: tab.title, category: tab.category, mode: tab.mode, bpm: tab.bpm, data: tab.data }; }) };
});

export const submitPracticeSummary = onCall(opts, async request => {
  const sessionUid = requireStudent(request), sessionId = id(request.data?.sessionId, 'çalışma kimliği'), tabId = id(request.data?.tabId, 'TAB kimliği');
  const seconds = Number(request.data?.seconds), correct = Number(request.data?.correct), wrong = Number(request.data?.wrong), missed = Number(request.data?.missed);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21_600 || !Number.isInteger(correct) || correct < 0 || correct > 10_000 || !Number.isInteger(wrong) || wrong < 0 || wrong > 10_000 || !Number.isInteger(missed) || missed < 0 || missed > 10_000) throw new HttpsError('invalid-argument', 'Çalışma özeti geçersiz.');
  const session = await studentSessionRef(sessionUid).get(), binding = session.data();
  if (!binding) throw new HttpsError('unauthenticated', 'Oturum geçersiz.');
  const student = studentRef(binding.teacherUid, binding.studentId), assignment = student.collection('assignments').doc(tabId), receipt = student.collection('sessionReceipts').doc(sessionId), summary = student.collection('analytics').doc('summary'), byTab = student.collection('analytics').doc('tabs').collection('items').doc(tabId);
  await db.runTransaction(async tx => {
    const [profile, assigned, seen] = await tx.getAll(student, assignment, receipt);
    if (!profile.exists || profile.data()!.status !== 'active' || profile.data()!.credentialVersion !== binding.credentialVersion) throw new HttpsError('permission-denied', 'Öğrenci profili devre dışı.');
    if (!assigned.exists || assigned.data()!.active !== true) throw new HttpsError('permission-denied', 'Bu TAB sana atanmamış.');
    if (seen.exists) return;
    const rateBase = correct + wrong + missed, rate = rateBase ? Math.round(correct / rateBase * 100) : 0;
    const currentTab = await tx.get(byTab);
    tx.create(receipt, { tabId, seconds, correct, wrong, missed, createdAt: FieldValue.serverTimestamp() });
    tx.set(summary, { sessions: FieldValue.increment(1), seconds: FieldValue.increment(seconds), correct: FieldValue.increment(correct), wrong: FieldValue.increment(wrong), missed: FieldValue.increment(missed), notes: FieldValue.increment(rateBase), evaluated: FieldValue.increment(correct + wrong), lastWorkedAt: FieldValue.serverTimestamp(), version: 1 }, { merge: true });
    tx.set(byTab, { sessions: FieldValue.increment(1), seconds: FieldValue.increment(seconds), correct: FieldValue.increment(correct), wrong: FieldValue.increment(wrong), missed: FieldValue.increment(missed), notes: FieldValue.increment(rateBase), bestAccuracy: Math.max(rate, Number(currentTab.data()?.bestAccuracy || 0)), lastWorkedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { ok: true };
});

