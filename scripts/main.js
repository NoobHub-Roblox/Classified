import * as THREE from 'three';
import { settings, loadSettings, saveSettings, loadSession, saveSession, clearSession } from './settings.js';
import { Sound } from './audio.js';
import { World, center, cellOf } from './world.js';
import { Teacher, Monitor, Runner, Janitor } from './actors.js';
import { TOTAL, buildSheet, makeQuestion } from './questions.js';

const $ = id => document.getElementById(id);
const SCREENS = ['menu', 'settings', 'credits', 'briefing', 'pause', 'worksheet', 'failure', 'victory'];
const ITEMS = {
  key: ['KEY', 'Office key. Press E at the locked door.'],
  bar: ['BAR', 'Energy bar: 8 seconds of free sprinting.'],
  bell: ['BELL', 'Rings ahead of you and lures the teacher.'],
  pass: ['PASS', 'Used automatically when caught. Stuns the teacher.']
};
const ITEM_NAMES = { key: 'OFFICE KEY', bar: 'ENERGY BAR', bell: 'BRASS BELL', pass: 'HALL PASS' };
const QUALITY = { low: 0.4, medium: 0.65, high: 1 };
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
}
if (!webglOk()) $('error').hidden = false; else boot();

function boot() {
  loadSettings();
  const canvas = $('world-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.useLegacyLights = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d0b);
  scene.fog = new THREE.Fog(0x0a0d0b, 6, 70);
  const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.1, 150);
  camera.rotation.order = 'YXZ';
  const amb = new THREE.AmbientLight(0xb4bec8, 0.6), sun = new THREE.DirectionalLight(0xffffff, 0.35), lamp = new THREE.PointLight(0xfff2d8, 0.9, 26, 1.4);
  sun.position.set(0.4, 1, 0.3); scene.add(amb, sun, lamp);

  const sound = new Sound(); sound.volume = settings.volume;
  const world = new World(scene);
  const teacher = new Teacher(world, sound), monitor = new Monitor(world, sound), runner = new Runner(world, sound), janitor = new Janitor(world, sound, scene);
  const actors = [teacher, monitor, runner, janitor];
  actors.forEach(a => scene.add(a.group));
  world.onDoor = d => sound.play('door', { x: center(d.cx), y: 1.5, z: center(d.cz) });

  const S = { mode: 'menu', clock: 0, collected: [], inv: [], elapsed: 0, boostT: 0, exitOn: false, blackout: 0, fT: 3, fD: 0, caughtT: 0, danger: 0, toastT: 0, ambT: 10, noiseT: 0, sheet: [], qi: 0, pk: null, promptText: '', settingsFrom: 'menu', menuReturn: 'menu' };
  const player = { pos: new THREE.Vector3(), vx: 0, vz: 0, yaw: 0, pitch: 0, stamina: 100, tired: false, stun: 0, dist: 0, bob: 0, sprinting: false };
  const keys = {};
  const pts = [];
  const ctx = {
    p: player.pos, n: 0, sprinting: false,
    freeze: (s, m) => { player.stun = Math.max(player.stun, s); toast(m); },
    knock: dir => { player.stun = 1.3; player.pos.x += dir * 3; world.collide(player.pos, 0.55); sound.play('thud'); noise(player.pos.x, player.pos.z, 40); toast('KNOCKED DOWN.'); },
    onCatch: () => onCatch()
  };

  /* ---------- interface helpers ---------- */
  function showScreen(id) {
    for (const s of SCREENS) $(s).hidden = s !== id;
    if (id) { const el = $(id).querySelector(id === 'worksheet' ? 'input' : 'button'); if (el) el.focus(); }
  }
  const setHud = on => { $('hud').hidden = !on; };
  function toast(msg, sec = 2.2) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); S.toastT = sec; }
  function setPrompt(text) { if (text !== S.promptText) { S.promptText = text; $('prompt').textContent = text; } }
  function renderSlots() {
    document.querySelectorAll('.slot').forEach((el, i) => { const it = S.inv[i]; el.lastElementChild.textContent = it ? ITEMS[it][0] : ''; el.title = it ? ITEMS[it][1] : 'Empty'; });
  }
  function updateHud() {
    $('hud-nb').textContent = `NOTEBOOKS: ${S.collected.length} / ${TOTAL}`;
    $('hud-obj').textContent = S.exitOn ? 'THE EXIT IS OPEN. EAST END OF THE HALLWAY.' : '';
    renderSlots();
  }
  function applyQuality() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5) * QUALITY[settings.quality]);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight; camera.fov = settings.fov; camera.updateProjectionMatrix();
  }
  function applySettings() { sound.setVolume(settings.volume); applyQuality(); }

  /* ---------- session control ---------- */
  function applyDifficulty() {
    const n = S.collected.length;
    teacher.setAnger(n);
    monitor.on = n >= 1; monitor.group.visible = monitor.on;
    janitor.on = n >= 2; janitor.group.visible = janitor.on;
    runner.on = n >= 3;
    scene.fog.far = 70 - n * 4; amb.intensity = 0.6 - n * 0.035;
  }
  function persist() { saveSession({ collected: S.collected, taken: world.takenIds(), inv: S.inv, unlocked: !world.doors.some(d => d.locked), elapsed: S.elapsed }); }

  function beginSession(useSave) {
    const save = useSave ? loadSession() : null;
    if (!useSave) clearSession();
    S.collected = save ? [...save.collected] : []; S.inv = save ? save.inv.slice(0, 3) : []; S.elapsed = save ? save.elapsed || 0 : 0;
    S.boostT = 0; S.blackout = 0; S.danger = 0; S.caughtT = 0; S.exitOn = S.collected.length >= TOTAL;
    world.reset(save);
    actors.forEach(a => a.reset()); applyDifficulty();
    Object.assign(player, { vx: 0, vz: 0, yaw: Math.PI, pitch: 0, stamina: 100, tired: false, stun: 0, dist: 0, bob: 0 });
    player.pos.set(center(2), 1.7, center(6));
    for (const k in keys) keys[k] = false;
    setPrompt(''); $('toast').classList.remove('show'); $('danger').style.opacity = 0;
    updateHud(); setHud(false);
    S.mode = 'briefing'; showScreen('briefing');
  }

  function resumePlay() {
    sound.init(); showScreen(null); setHud(true); S.mode = 'playing';
    try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* handled below */ }
    setTimeout(() => { if (S.mode === 'playing' && document.pointerLockElement !== canvas) pause(); }, 350);
  }
  function pause() {
    if (S.mode !== 'playing') return;
    S.mode = 'paused'; for (const k in keys) keys[k] = false; showScreen('pause');
  }
  function toMenu() {
    S.mode = 'menu'; setHud(false); showScreen('menu');
    if (document.pointerLockElement) document.exitPointerLock();
    actors.forEach(a => { a.group.visible = false; });
    $('btn-continue').hidden = !loadSession();
  }

  /* ---------- noise, items, interaction ---------- */
  function noise(x, z, r) { teacher.hearNoise(x, z, r); }

  function useSlot(i) {
    const it = S.inv[i]; if (!it) return;
    if (it === 'bar') { S.boostT = 8; player.stamina = 100; player.tired = false; sound.play('boost'); toast('ENERGY BAR: SPRINT FREELY.'); }
    else if (it === 'bell') {
      const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw); let d = 0;
      while (d < 24) { const ch = world.at(cellOf(player.pos.x + fx * (d + 1)), cellOf(player.pos.z + fz * (d + 1))); if (ch === '#' || ch === 'X') break; d++; }
      const x = player.pos.x + fx * d, z = player.pos.z + fz * d;
      sound.play('bell', { x, y: 1.5, z }); teacher.lure(x, z); toast('THE BELL RINGS.');
    } else { toast(it === 'key' ? 'USE THE KEY WITH E AT A LOCKED DOOR.' : 'THE PASS ACTS ON ITS OWN WHEN YOU ARE CAUGHT.'); return; }
    S.inv.splice(i, 1); updateHud(); persist();
  }

  function interact() {
    const t = S.target; if (!t) return;
    if (t.t === 'pk') {
      const pk = t.pk;
      if (pk.kind === 'notebook') openSheet(pk);
      else if (S.inv.length < 3) { pk.taken = true; pk.mesh.visible = false; S.inv.push(pk.kind); sound.play('pickup'); toast(`TOOK ${ITEM_NAMES[pk.kind]}`); updateHud(); persist(); }
    } else if (t.t === 'door' && S.inv.includes('key')) {
      S.inv.splice(S.inv.indexOf('key'), 1); world.unlock(t.d); sound.play('door', { x: center(t.d.cx), y: 1.5, z: center(t.d.cz) });
      toast('DOOR UNLOCKED.'); updateHud(); persist();
    }
  }

  /* ---------- notebook questions ---------- */
  function openSheet(pk) {
    S.mode = 'question'; S.pk = pk; S.sheet = buildSheet(S.collected.length); S.qi = 0;
    for (const k in keys) keys[k] = false;
    if (document.pointerLockElement) document.exitPointerLock();
    setPrompt(''); showScreen('worksheet'); renderQuestion();
  }
  function renderQuestion() {
    const q = S.sheet[S.qi];
    $('ws-title').textContent = `NOTEBOOK ${S.collected.length + 1} / ${TOTAL}`;
    $('ws-count').textContent = `QUESTION ${S.qi + 1} OF ${S.sheet.length}`;
    $('ws-question').textContent = q.text;
    $('ws-panel').classList.toggle('distorted', !!q.scripted);
    $('ws-answer').value = ''; $('ws-feedback').textContent = ''; $('ws-feedback').className = '';
    $('ws-answer').disabled = false; $('btn-submit').disabled = false; $('ws-answer').focus();
  }
  function feedback(msg, cls) { const f = $('ws-feedback'); f.textContent = msg; f.className = cls; }
  function submitAnswer() {
    if (S.mode !== 'question') return;
    const raw = $('ws-answer').value.trim(), q = S.sheet[S.qi];
    if (!raw) { feedback('WRITE AN ANSWER FIRST.', 'bad'); return; }
    if (!/^-?\d+$/.test(raw)) { feedback('NUMBERS ONLY.', 'bad'); return; }
    if (q.scripted) {
      $('ws-answer').disabled = true; $('btn-submit').disabled = true;
      $('ws-question').textContent = 'THE TEACHER IS MARKING YOUR WORK.';
      feedback('YOU WERE NEVER SUPPOSED TO FINISH.', 'bad'); sound.play('wrong');
      setTimeout(() => { if (S.mode === 'question') finishNotebook(); }, 2000); return;
    }
    if (Number(raw) === q.answer) {
      sound.play('correct'); feedback('CORRECT.', 'good'); S.qi++;
      $('ws-answer').disabled = true; $('btn-submit').disabled = true;
      setTimeout(() => { if (S.mode !== 'question') return; if (S.qi >= S.sheet.length) finishNotebook(); else renderQuestion(); }, 600);
    } else {
      sound.play('wrong'); feedback('INCORRECT. TRY AGAIN. SOMEONE HEARD THAT.', 'bad');
      S.sheet[S.qi] = makeQuestion(Math.min(S.collected.length, 6)); $('ws-question').textContent = S.sheet[S.qi].text; $('ws-answer').value = '';
      noise(player.pos.x, player.pos.z, 60);
    }
  }
  function finishNotebook() {
    S.collected.push(S.pk.id); S.pk.taken = true; S.pk.mesh.visible = false;
    sound.play('notebook'); applyDifficulty(); updateHud(); persist();
    resumePlay();
    if (S.collected.length === TOTAL) startEscape();
  }
  function startEscape() {
    S.exitOn = true; world.setExit(true); S.blackout = 2.5; sound.play('alarm');
    teacher.setCell(6, 10); teacher.alert(player.pos.x, player.pos.z);
    updateHud(); toast('THE EXIT IS OPEN. RUN.', 4);
  }

  /* ---------- fail / win ---------- */
  function onCatch() {
    if (S.mode !== 'playing') return;
    const i = S.inv.indexOf('pass');
    if (i >= 0) {
      S.inv.splice(i, 1); updateHud(); persist();
      teacher.stun = 4; teacher.state = 'search'; teacher.search = 5; teacher.path = [];
      const dx = player.pos.x - teacher.pos.x, dz = player.pos.z - teacher.pos.z, d = Math.hypot(dx, dz) || 1;
      player.pos.x += dx / d * 4; player.pos.z += dz / d * 4; world.collide(player.pos, 0.55); world.collide(player.pos, 0.55);
      sound.play('correct'); toast('HALL PASS ACCEPTED. THE TEACHER IS STUNNED.'); return;
    }
    S.mode = 'caught'; S.caughtT = 0; sound.play('jolt'); setPrompt('');
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function win() {
    S.mode = 'won'; clearSession(); sound.play('win');
    if (document.pointerLockElement) document.exitPointerLock();
    $('win-stats').textContent = `TIME: ${fmt(S.elapsed)}`;
    setTimeout(() => { if (S.mode === 'won') { setHud(false); showScreen('victory'); } }, 1500);
  }

  /* ---------- per-frame updates ---------- */
  function puddleUnder() { return janitor.on && janitor.puddles.some(m => m.visible && Math.hypot(m.position.x - player.pos.x, m.position.z - player.pos.z) < 1.6); }

  function movePlayer(dt) {
    const p = player; if (p.stun > 0) p.stun -= dt;
    const frozen = p.stun > 0;
    const f = frozen ? 0 : (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = frozen ? 0 : (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const moving = f !== 0 || s !== 0, boost = S.boostT > 0, wet = puddleUnder();
    if (boost) S.boostT -= dt;
    const sprint = moving && (keys.ShiftLeft || keys.ShiftRight) && (boost || (p.stamina > 0 && !p.tired));
    if (sprint && !boost) p.stamina = Math.max(0, p.stamina - 26 * dt); else if (!sprint) p.stamina = Math.min(100, p.stamina + (moving ? 10 : 20) * dt);
    if (p.stamina <= 0) p.tired = true; else if (p.stamina > 30) p.tired = false;
    p.sprinting = sprint;
    const max = (sprint ? 7.4 : 4.4) * (wet ? 0.6 : 1) * (boost ? 1.12 : 1);
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    let dx = -sy * f + cy * s, dz = -cy * f - sy * s; const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    const k = 1 - Math.exp(-dt * (wet ? 2.5 : 11)), m = moving ? max : 0;
    p.vx += (dx * m - p.vx) * k; p.vz += (dz * m - p.vz) * k;
    p.pos.x += p.vx * dt; p.pos.z += p.vz * dt;
    world.collide(p.pos, 0.55); world.collide(p.pos, 0.55);
    if (janitor.on) {
      const ex = p.pos.x - janitor.pos.x, ez = p.pos.z - janitor.pos.z, d = Math.hypot(ex, ez);
      if (d < 1.5 && d > 0.001) { p.pos.x += ex / d * (1.5 - d); p.pos.z += ez / d * (1.5 - d); }
    }
    const speed = Math.hypot(p.vx, p.vz);
    p.dist += speed * dt; p.bob += speed * dt * 2.2;
    if (speed > 0.5 && p.dist > (sprint ? 2.6 : 2.1)) {
      p.dist = 0; sound.play(wet ? 'wetstep' : 'step');
      noise(p.pos.x, p.pos.z, (sprint ? 17 : 7) * (wet ? 1.5 : 1));
    }
    p.pos.y = 1.7 + Math.sin(p.bob) * 0.05 * Math.min(1, speed / 4.4);
  }

  function updateInteract() {
    let text = '', target = null;
    const pk = world.nearestPickup(player.pos.x, player.pos.z, 3.4);
    if (pk) {
      text = pk.kind === 'notebook' ? 'E  —  COLLECT NOTEBOOK' : S.inv.length < 3 ? `E  —  TAKE ${ITEM_NAMES[pk.kind]}` : 'INVENTORY FULL';
      target = { t: 'pk', pk };
    } else {
      const d = world.lockedDoorNear(player.pos.x, player.pos.z, 4.2);
      if (d) { text = S.inv.includes('key') ? 'E  —  UNLOCK DOOR' : 'LOCKED  —  NEEDS A KEY'; target = { t: 'door', d }; }
    }
    S.target = target; setPrompt(text);
  }

  function updatePlaying(dt) {
    S.elapsed += dt; const n = S.collected.length; ctx.n = n; ctx.sprinting = player.sprinting;
    movePlayer(dt);
    teacher.update(dt, ctx);
    if (monitor.on) monitor.update(dt, ctx);
    if (janitor.on) janitor.update(dt);
    if (runner.on) runner.update(dt, ctx);
    pts.length = 0; pts.push(player.pos, teacher.pos);
    if (monitor.on) pts.push(monitor.pos);
    if (janitor.on) pts.push(janitor.pos);
    if (runner.on && runner.state === 'dash') pts.push(runner.pos);
    world.update(dt, S.clock, pts);
    updateInteract();

    let d = 0;
    if (teacher.state === 'chase') d = 0.9;
    else { const dist = Math.hypot(teacher.pos.x - player.pos.x, teacher.pos.z - player.pos.z); if (dist < 22 && world.visible(teacher.pos.x, teacher.pos.z, player.pos.x, player.pos.z)) d = 0.35 * (1 - dist / 22); }
    S.danger += (d - S.danger) * Math.min(1, dt * 4); sound.chase = S.danger;
    if (Math.abs(S.danger - (S.shownDanger || 0)) > 0.02) { S.shownDanger = S.danger; $('danger').style.opacity = S.danger.toFixed(2); }
    $('stam-fill').style.width = player.stamina.toFixed(0) + '%';

    S.ambT -= dt;
    if (S.ambT <= 0) { S.ambT = 8 + Math.random() * 12; const a = Math.random() * 6.28; sound.play(Math.random() < 0.5 ? 'creak' : 'thud', { x: player.pos.x + Math.cos(a) * 25, y: 1, z: player.pos.z + Math.sin(a) * 25 }); }

    if (S.exitOn && player.pos.x > 121.6 && Math.abs(player.pos.z - center(10)) < 2.2) win();
  }

  function updateCaught(dt) {
    S.caughtT += dt;
    const dx = teacher.pos.x - player.pos.x, dz = teacher.pos.z - player.pos.z;
    const ty = Math.atan2(-dx, -dz); let diff = ty - player.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    player.yaw += diff * Math.min(1, dt * 8); player.pitch += (0.15 - player.pitch) * Math.min(1, dt * 6);
    teacher.head.scale.setScalar(1 + S.caughtT * 0.4); teacher.mouth.scale.set(5, 6, 1);
    if (S.caughtT > 1.8) {
      S.mode = 'over'; teacher.head.scale.setScalar(1); setHud(false);
      $('fail-stats').textContent = `NOTEBOOKS: ${S.collected.length} / ${TOTAL}   TIME: ${fmt(S.elapsed)}`;
      showScreen('failure');
    }
  }

  function lights(dt) {
    S.fT -= dt;
    if (S.fT < 0) { S.fT = 2.5 + Math.random() * Math.max(2, 9 - S.collected.length); S.fD = 0.15 + Math.random() * 0.25; }
    let k = 1;
    if (S.fD > 0) { S.fD -= dt; k = Math.random() < 0.5 ? 0.35 : 1; }
    if (S.blackout > 0) { S.blackout -= dt; k = Math.random() < 0.2 ? 0.6 : 0.05; }
    const base = 0.6 - S.collected.length * 0.035;
    amb.intensity = base * k; lamp.intensity = 0.9 * k; world.setBrightness(k);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (frame.last || now)) / 1000); frame.last = now; S.clock += dt;
    lights(dt);
    if (S.toastT > 0) { S.toastT -= dt; if (S.toastT <= 0) $('toast').classList.remove('show'); }
    const m = S.mode;
    if (m === 'menu') {
      pts.length = 0;
      world.update(dt, S.clock, pts);
      camera.position.set(62 + 46 * Math.sin(S.clock * 0.05), 1.8 + Math.sin(S.clock * 0.7) * 0.03, center(10) + Math.sin(S.clock * 0.3) * 0.6);
      camera.rotation.set(0, -Math.PI / 2 + Math.sin(S.clock * 0.2) * 0.08, 0);
    } else if (m === 'briefing' || m === 'paused' || m === 'question' || m === 'over' || m === 'won') {
      camera.position.copy(player.pos); camera.rotation.set(player.pitch, player.yaw, 0);
      if (m === 'won') world.update(dt, S.clock, pts);
    } else {
      if (m === 'playing') updatePlaying(dt); else if (m === 'caught') updateCaught(dt);
      camera.position.copy(player.pos); camera.rotation.set(player.pitch, player.yaw, 0);
    }
    lamp.position.copy(camera.position);
    sound.mode = (m === 'playing' || m === 'question' || m === 'paused' || m === 'caught') ? 'play' : (m === 'menu' || m === 'briefing') ? 'menu' : 'off';
    sound.listen(camera.position, camera.rotation.y);
    sound.tick(dt, S.clock);
    renderer.render(scene, camera);
  }

  /* ---------- input ---------- */
  document.addEventListener('mousemove', e => {
    if (S.mode !== 'playing' || document.pointerLockElement !== canvas) return;
    const k = 0.0022 * settings.sensitivity;
    player.yaw -= e.movementX * k; player.pitch = Math.max(-1.3, Math.min(1.3, player.pitch - e.movementY * k));
  });
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas && S.mode === 'playing') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  window.addEventListener('resize', applyQuality);
  window.addEventListener('pointerdown', () => sound.init());

  window.addEventListener('keydown', e => {
    sound.init();
    if (S.mode === 'playing') {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      keys[e.code] = true;
      if (e.code === 'KeyE' && !e.repeat) interact();
      if (e.code === 'Digit1') useSlot(0); else if (e.code === 'Digit2') useSlot(1); else if (e.code === 'Digit3') useSlot(2);
      return;
    }
    if (S.mode === 'question' && e.code === 'Enter' && e.target.id !== 'btn-submit') { e.preventDefault(); submitAnswer(); return; }
    if (e.code === 'Escape' && !$('settings').hidden) { $('btn-settings-back').click(); return; }
    if ((e.code === 'ArrowDown' || e.code === 'ArrowUp') && S.mode !== 'question') {
      const open = SCREENS.map($).find(el => !el.hidden); if (!open) return;
      const btns = [...open.querySelectorAll('button:not([hidden]),input,select')]; if (!btns.length) return;
      const i = btns.indexOf(document.activeElement);
      if (open.id === 'settings' && document.activeElement.type === 'range') return;
      e.preventDefault(); btns[(i + (e.code === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length].focus();
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  /* ---------- buttons ---------- */
  const on = (id, fn) => $(id).addEventListener('click', () => { sound.init(); fn(); });
  on('btn-new', () => beginSession(false));
  on('btn-continue', () => beginSession(true));
  on('btn-settings', () => { S.menuReturn = 'menu'; showScreen('settings'); });
  on('btn-credits', () => showScreen('credits'));
  on('btn-credits-back', () => showScreen('menu'));
  on('btn-begin', resumePlay);
  on('btn-resume', resumePlay);
  on('btn-pause-settings', () => { S.menuReturn = 'pause'; showScreen('settings'); });
  on('btn-pause-menu', toMenu);
  on('btn-settings-back', () => showScreen(S.menuReturn));
  on('btn-submit', submitAnswer);
  on('btn-retry', () => beginSession(false));
  on('btn-fail-menu', toMenu);
  on('btn-again', () => beginSession(false));
  on('btn-win-menu', toMenu);
  document.querySelectorAll('.slot').forEach(el => el.addEventListener('click', () => { if (S.mode === 'playing') useSlot(Number(el.dataset.i)); }));

  const sv = $('set-volume'), ss = $('set-sens'), sf = $('set-fov'), sq = $('set-quality');
  function syncSettingsUi() {
    sv.value = Math.round(settings.volume * 100); ss.value = settings.sensitivity; sf.value = settings.fov; sq.value = settings.quality;
    $('out-volume').textContent = sv.value + '%'; $('out-sens').textContent = Number(ss.value).toFixed(2); $('out-fov').textContent = sf.value + '°';
  }
  sv.addEventListener('input', () => { settings.volume = sv.value / 100; saveSettings(); applySettings(); syncSettingsUi(); });
  ss.addEventListener('input', () => { settings.sensitivity = Number(ss.value); saveSettings(); syncSettingsUi(); });
  sf.addEventListener('input', () => { settings.fov = Number(sf.value); saveSettings(); applySettings(); syncSettingsUi(); });
  sq.addEventListener('change', () => { settings.quality = sq.value; saveSettings(); applySettings(); });

  syncSettingsUi(); applySettings();
  actors.forEach(a => { a.group.visible = false; });
  $('btn-continue').hidden = !loadSession();
  showScreen('menu');
  requestAnimationFrame(frame);
}
