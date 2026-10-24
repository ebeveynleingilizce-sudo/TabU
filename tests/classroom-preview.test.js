import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assignedPreviewTabs } from '../app/classroomPreview.js';

test('teacher preview includes only the selected student’s assigned TABs', () => {
  const tabs = [
    { id: 'solo-1', title: 'Solo 1' },
    { id: 'arpeggio-1', title: 'Arpej 1' },
    { id: 'solo-2', title: 'Solo 2' }
  ];

  assert.deepEqual(assignedPreviewTabs(['arpeggio-1', 'solo-2'], tabs), [tabs[1], tabs[2]]);
  assert.deepEqual(assignedPreviewTabs([], tabs), []);
});

test('sign-in screen always offers the browser PWA install flow without downloading an APK', () => {
  const classroom = readFileSync(new URL('../app/classroom.js', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(classroom, /data-classroom-action="install-app">↓ Uygulamayı indir/);
  assert.match(classroom, /promptEvent\.prompt\(\)/);
  assert.match(classroom, /Ana Ekrana Ekle/);
  assert.match(index, /addEventListener\('beforeinstallprompt'/);
  assert.doesNotMatch(classroom, /\.apk/);
});

test('teacher preview button renders as soon as a student is selected, even before detail data loads', () => {
  const classroom = readFileSync(new URL('../app/classroom.js', import.meta.url), 'utf8');
  assert.match(classroom, /const studentActions = selectedStudentId \? `[^`]*data-classroom-action="preview-student"/);
  assert.match(classroom, /teacherStudentDetail', \{ studentId: teacherData\.selectedStudentId \}/);
});

test('students with assigned TABs enter the practice screen without opening the song selector', () => {
  const classroom = readFileSync(new URL('../app/classroom.js', import.meta.url), 'utf8');
  assert.match(classroom, /if \(catalog\.tabs\.length\)[\s\S]*location\.hash !== '#practice'[\s\S]*launchResolver\?\.\(\)/);
});

test('teacher and student panels can share the direct app link', () => {
  const classroom = readFileSync(new URL('../app/classroom.js', import.meta.url), 'utf8');
  assert.match(classroom, /data-classroom-action="share-app"/);
  assert.match(classroom, /navigator\.share\(/);
  assert.match(classroom, /navigator\.clipboard\.writeText\(appUrl\.href\)/);
});

test('startup failures show a retry screen instead of leaving a blank shell', () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(index, /catch \(error\)[\s\S]*Uygulama açılamadı[\s\S]*Yeniden yükle/);
});


test('main app initializes after classroom login completes', () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(index, /await startClassroom\(\);\s*await import\('\.\/app\/main\.js\?v=64'\);/);
  assert.doesNotMatch(index, /if \(classroomReady !== true\)/);
});

test('teacher panel remains visible after login', () => {
  const classroom = readFileSync(new URL('../app/classroom.js', import.meta.url), 'utf8');
  assert.match(classroom, /gate\.hidden = currentRole === 'student' && Boolean\(teacherData\?\.catalog\?\.tabs\?\.length\);/);
});
