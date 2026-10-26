import * as THREE from 'three';

export const C = 4, H = 3.4, COLS = 32;
const TOP = '#.......#.......#.......#......#';
const BOT = '#.........#....#........#......#';
const HALL = '#' + '.'.repeat(30) + '#';
const FULL = '#'.repeat(32);
const MAP = [FULL, ...Array(7).fill(TOP), '####D#######D#######D######D####', HALL, HALL.slice(0, 31) + 'X', HALL,
  '#####D######D######D#######D####', ...Array(7).fill(BOT), FULL];
const grid = MAP.map(r => r.split(''));
export const ROWS = grid.length;
const put = (ch, xs, zs) => { for (const z of zs) for (const x of xs) grid[z][x] = ch; };
put('d', [2, 4, 6], [3, 5]); put('d', [10, 12, 14], [3, 5]); put('d', [19, 20, 21], [2]); put('d', [18, 20, 22], [5]); put('d', [27, 28], [3]);
put('d', [3, 4, 7, 8], [15, 17]);
put('S', [17, 18, 20, 21, 22], [14, 17]); put('S', [25, 26], [14]); put('S', [28, 29], [16]); put('S', [12, 13], [15]);
put('L', [1, 2, 3, 6, 7, 8, 9, 10, 14, 15, 16, 17, 18, 22, 23, 24, 25], [9]);

export const cellOf = v => Math.floor(v / C);
export const center = c => (c + 0.5) * C;

// Easy-to-edit placement tables: [cellX, cellZ]
export const NOTEBOOK_SPOTS = [[6, 2], [14, 6], [9, 14], [22, 16], [23, 2], [29, 6], [13, 18]];
export const ITEM_SPOTS = [['key', 29, 14], ['bar', 1, 10], ['bell', 9, 1], ['pass', 18, 19], ['bar', 21, 6], ['bell', 6, 19]];

const ZONES = [
  { n: 'CLASS 101', x0: 1, z0: 1, x1: 7, z1: 7, wall: 0xc9d6a3, floor: 0x8fa37a },
  { n: 'CLASS 102', x0: 9, z0: 1, x1: 15, z1: 7, wall: 0xe3d3a1, floor: 0xb59c6a },
  { n: 'TEACHER', x0: 17, z0: 1, x1: 23, z1: 7, wall: 0xd9a39a, floor: 0x9c6a62 },
  { n: 'PRINCIPAL', x0: 25, z0: 1, x1: 30, z1: 7, wall: 0x9db5c9, floor: 0x5f7488 },
  { n: 'HALLWAY', x0: 1, z0: 9, x1: 30, z1: 11, wall: 0xd8d6c6, floor: 0x9a9a8c },
  { n: 'CAFETERIA', x0: 1, z0: 13, x1: 9, z1: 19, wall: 0xe0b97a, floor: 0xb8884a },
  { n: 'RESTROOM', x0: 11, z0: 13, x1: 14, z1: 19, wall: 0xa8d4d0, floor: 0x7fb0ab },
  { n: 'LIBRARY', x0: 16, z0: 13, x1: 23, z1: 19, wall: 0xb8a08a, floor: 0x6b4f3a },
  { n: 'STORAGE', x0: 25, z0: 13, x1: 30, z1: 19, wall: 0x9a9a9a, floor: 0x6e6e66 }
];
const zoneAt = (x, z) => ZONES.find(q => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
function zoneNear(x, z) {
  const own = zoneAt(x, z);
  if (own) return own;
  let hall = null;
  for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const q = zoneAt(x + dx, z + dz);
    if (q && q.n !== 'HALLWAY') return q;
    if (q) hall = q;
  }
  return hall || ZONES[4];
}

function tex(draw, size = 32, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const speckle = (g, s, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * a})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); } };
const textures = () => ({
  wall: tex((g, s) => { g.fillStyle = '#ecebe2'; g.fillRect(0, 0, s, s); speckle(g, s, 60, 0.07); g.fillStyle = '#4a4a4a'; g.fillRect(0, s - 5, s, 5); g.fillStyle = '#bbb'; g.fillRect(0, s - 6, s, 1); }),
  floor: tex((g, s) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#d4d4d4' : '#f2f2f2'; g.fillRect(i * 8, j * 8, 8, 8); } speckle(g, s, 30, 0.08); }),
  ceil: tex((g, s) => { g.fillStyle = '#d8d6c8'; g.fillRect(0, 0, s, s); g.strokeStyle = '#aaa'; g.strokeRect(0, 0, s / 2, s / 2); g.strokeRect(s / 2, s / 2, s / 2, s / 2); speckle(g, s, 40, 0.1); }, 32, COLS * 2, ROWS * 2),
  wood: tex((g, s) => { g.fillStyle = '#9a6a3a'; g.fillRect(0, 0, s, s); for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(60,30,10,.25)'; g.fillRect(0, i * 4 + Math.random() * 2, s, 1); } }),
  locker: tex((g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); g.fillStyle = '#222'; g.fillRect(0, 0, 2, s); g.fillRect(s / 2, 0, 2, s); for (let i = 0; i < 4; i++) g.fillRect(6 + (i % 2) * 16, 4 + i * 2, 8, 1); }),
  shelf: tex((g, s) => { g.fillStyle = '#5a3a20'; g.fillRect(0, 0, s, s); for (let r = 0; r < 4; r++) for (let x = 0; x < s; x += 3) { g.fillStyle = `hsl(${Math.random() * 360},50%,45%)`; g.fillRect(x, r * 8 + 1, 2, 6); } }),
  crate: tex((g, s) => { g.fillStyle = '#b8935a'; g.fillRect(0, 0, s, s); g.strokeStyle = '#6a4a22'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2); g.beginPath(); g.moveTo(0, 0); g.lineTo(s, s); g.moveTo(s, 0); g.lineTo(0, s); g.stroke(); })
});

function labelTex(text, bg, fg, w = 128, h = 32, font = 'bold 16px monospace') {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.strokeRect(1, 1, w - 2, h - 2);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}

const lam = (o) => new THREE.MeshLambertMaterial(o);
const box = (w, h, d, material, x, y, z, parent) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); parent.add(m); return m;
};

export class World {
  constructor(scene) {
    this.scene = scene; this.doors = []; this.doorMap = new Map(); this.pickups = []; this.onDoor = null;
    const T = this.T = textures();
    this.root = new THREE.Group(); scene.add(this.root);
    this.buildShell(T); this.buildFurniture(T); this.buildDoors(); this.buildDecor(); this.buildPickups();
  }

  at(cx, cz) { return cx < 0 || cz < 0 || cx >= COLS || cz >= ROWS ? '#' : grid[cz][cx]; }

  buildShell(T) {
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    const walls = [], floors = [];
    for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
      const ch = grid[z][x];
      if (ch === '#') {
        let open = false;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c2 = this.at(x + dx, z + dz); if (c2 !== '#' && c2 !== 'X') open = true; }
        if (open) walls.push([x, z]);
      } else if (ch !== 'X') floors.push([x, z]);
    }
    const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(C, H, C), lam({ map: T.wall }), walls.length);
    walls.forEach(([x, z], i) => { m4.setPosition(center(x), H / 2, center(z)); wm.setMatrixAt(i, m4); wm.setColorAt(i, col.setHex(zoneNear(x, z).wall)); });
    const fm = new THREE.InstancedMesh(new THREE.PlaneGeometry(C, C).rotateX(-Math.PI / 2), lam({ map: T.floor }), floors.length);
    floors.forEach(([x, z], i) => { m4.setPosition(center(x), 0, center(z)); fm.setMatrixAt(i, m4); fm.setColorAt(i, col.setHex(zoneNear(x, z).floor)); });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(COLS * C, ROWS * C).rotateX(Math.PI / 2), lam({ map: T.ceil }));
    ceil.position.set(COLS * C / 2, H, ROWS * C / 2);
    this.root.add(wm, fm, ceil);

    const spots = [[4, 4], [12, 4], [20, 4], [28, 4], [3, 16], [7, 16], [12, 16], [18, 16], [21, 16], [28, 16]];
    for (let x = 3; x < 30; x += 3) spots.push([x, 10]);
    this.fixMat = new THREE.MeshBasicMaterial({ color: 0xf4f6e0 });
    const fx = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.12, 0.8), this.fixMat, spots.length);
    spots.forEach(([x, z], i) => { m4.setPosition(center(x), H - 0.07, center(z)); fx.setMatrixAt(i, m4); });
    this.root.add(fx);
  }

  buildFurniture(T) {
    const wood = lam({ map: T.wood }), dark = lam({ color: 0x555555 });
    for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
      const ch = grid[z][x], cx = center(x), cz = center(z), zn = zoneAt(x, z);
      const g = new THREE.Group(); g.position.set(cx, 0, cz);
      if (ch === 'd') {
        const table = zn && zn.n === 'CAFETERIA';
        if (table) { box(3.2, 0.14, 2.0, wood, 0, 1.2, 0, g); box(0.2, 1.2, 1.8, dark, -1.4, 0.6, 0, g); box(0.2, 1.2, 1.8, dark, 1.4, 0.6, 0, g); }
        else {
          box(2.2, 0.12, 1.6, wood, 0, 1.45, 0, g); box(0.1, 1.4, 1.4, dark, -0.95, 0.7, 0, g); box(0.1, 1.4, 1.4, dark, 0.95, 0.7, 0, g);
          box(1.0, 0.1, 1.0, wood, 0, 0.9, 1.5, g); box(1.0, 0.9, 0.1, wood, 0, 1.4, 2.0, g);
        }
      } else if (ch === 'L') {
        box(3.8, 2.9, 1.1, lam({ map: T.locker, color: (x % 2 ? 0x4a6a8a : 0x8a4a4a) }), 0, 1.45, -C / 2 + 0.6, g);
      } else if (ch === 'S') {
        const n = zn && zn.n;
        if (n === 'LIBRARY') box(3.6, 3.0, 1.2, lam({ map: T.shelf }), 0, 1.5, 0, g);
        else if (n === 'STORAGE') { box(3.2, 1.6, 2.0, lam({ map: T.crate }), 0, 0.8, 0, g); box(2.0, 1.2, 1.6, lam({ map: T.crate }), 0, 2.2, 0, g); }
        else box(3.6, 2.6, 0.2, lam({ color: 0x6aa8a0 }), 0, 1.3, 0, g);
      } else continue;
      this.root.add(g);
    }
  }

  buildDoors() {
    const addSign = (d, label, side) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: labelTex(label, '#1c3a28', '#e8e6d4') }));
      const x = center(d.cx) + 3;
      if (side > 0) { mesh.position.set(x, 2.4, (d.cz + 1) * C + 0.03); } else { mesh.position.set(x, 2.4, d.cz * C - 0.03); mesh.rotation.y = Math.PI; }
      this.root.add(mesh);
    };
    const labels = { '4,8': 'CLASS 101', '12,8': 'CLASS 102', '20,8': 'MS. TEACHER', '27,8': 'PRINCIPAL', '5,12': 'CAFETERIA', '12,12': 'RESTROOM', '19,12': 'LIBRARY', '27,12': 'STORAGE' };
    for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
      if (grid[z][x] !== 'D') continue;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(C - 0.2, H, 0.5), lam({ color: 0x7a5a3a }));
      slab.position.set(center(x), H / 2, center(z)); this.root.add(slab);
      const d = { cx: x, cz: z, open: 0, target: 0, lastTarget: 0, slab, initLocked: x === 27 && z === 8, locked: false };
      this.doors.push(d); this.doorMap.set(x + ',' + z, d);
      addSign(d, labels[x + ',' + z] || 'ROOM', z === 8 ? 1 : -1);
    }
    // main entrance / exit
    this.exitTex = { off: labelTex('EXIT', '#5a1a1a', '#ffb0a0', 128, 64, 'bold 36px monospace'), on: labelTex('EXIT', '#1f6a30', '#d8ffd8', 128, 64, 'bold 36px monospace') };
    this.exitMat = new THREE.MeshBasicMaterial({ map: this.exitTex.off });
    const ex = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3), this.exitMat);
    this.exitX = 31 * C;
    ex.position.set(this.exitX - 0.02, 1.6, center(10)); ex.rotation.y = -Math.PI / 2; this.root.add(ex);
  }

  buildDecor() {
    const board = (x) => {
      const t = labelTex('2 + 2 = ?   SIT.   QUIET.', '#1d3b2a', '#e8e6d4', 256, 48, 'bold 20px monospace');
      const m = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 0.12), [lam({ color: 0x333 }), lam({ color: 0x333 }), lam({ color: 0x333 }), lam({ color: 0x333 }), new THREE.MeshBasicMaterial({ map: t }), lam({ color: 0x333 })]);
      m.position.set(x, 2.0, 4.1); this.root.add(m);
    };
    board(18); board(50); board(82);
  }

  buildPickups() {
    NOTEBOOK_SPOTS.forEach(([x, z], i) => {
      const g = new THREE.Group(); const col = new THREE.Color().setHSL(i / 7, 0.65, 0.5);
      box(1.1, 0.2, 1.5, lam({ color: col, emissive: col.clone().multiplyScalar(0.4) }), 0, 0, 0, g);
      box(0.6, 0.03, 0.4, new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.11, 0.1, g);
      box(0.1, 0.22, 1.5, lam({ color: 0x222222 }), -0.5, 0, 0, g);
      this.addPickup('notebook', i, x, z, g);
    });
    ITEM_SPOTS.forEach(([kind, x, z], i) => {
      const g = new THREE.Group(); const em = c => lam({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.4) });
      if (kind === 'bar') box(0.9, 0.3, 0.45, em(0xe07a20), 0, 0, 0, g);
      else if (kind === 'bell') { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.55, 8), em(0xd8b020)); g.add(m); }
      else if (kind === 'pass') box(0.9, 0.06, 1.2, em(0x60a0e0), 0, 0, 0, g);
      else { box(0.9, 0.1, 0.3, em(0xf0d020), 0, 0, 0, g); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 8), em(0xf0d020)); r.position.x = -0.55; g.add(r); }
      this.addPickup(kind, 'i' + i, x, z, g);
    });
  }

  addPickup(kind, id, cx, cz, mesh) {
    mesh.position.set(center(cx), 1.0, center(cz)); this.root.add(mesh);
    this.pickups.push({ kind, id, x: center(cx), z: center(cz), mesh, taken: false });
  }

  reset(save) {
    for (const d of this.doors) { d.locked = d.initLocked && !(save && save.unlocked); d.open = 0; d.target = d.lastTarget = 0; d.slab.position.y = H / 2; d.slab.material.color.setHex(d.locked ? 0x8a2f2f : 0x7a5a3a); }
    for (const p of this.pickups) {
      p.taken = !!save && (p.kind === 'notebook' ? save.collected.includes(p.id) : save.taken.includes(p.id));
      p.mesh.visible = !p.taken;
    }
    this.setExit(!!save && save.collected.length >= 7);
  }

  takenIds() { return this.pickups.filter(p => p.taken && p.kind !== 'notebook').map(p => p.id); }
  setExit(on) { this.exitMat.map = on ? this.exitTex.on : this.exitTex.off; this.exitMat.needsUpdate = true; }
  setBrightness(k) { this.fixMat.color.setRGB(0.96 * k, 0.97 * k, 0.88 * k); }

  unlock(d) { d.locked = false; d.slab.material.color.setHex(0x7a5a3a); }
  lockedDoorNear(x, z, r) { return this.doors.find(d => d.locked && Math.hypot(center(d.cx) - x, center(d.cz) - z) < r) || null; }
  nearestPickup(x, z, r) {
    let best = null, bd = r;
    for (const p of this.pickups) { if (p.taken) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  update(dt, t, pts) {
    this.pickups.forEach((p, i) => { if (!p.taken) { p.mesh.position.y = 1.0 + Math.sin(t * 2 + i) * 0.12; p.mesh.rotation.y = t * 1.2 + i; } });
    for (const d of this.doors) {
      const dx = center(d.cx), dz = center(d.cz);
      let near = false;
      if (!d.locked) for (const p of pts) if (Math.abs(p.x - dx) < 3.6 && Math.abs(p.z - dz) < 3.6) { near = true; break; }
      d.target = near ? 1 : 0;
      if (d.target !== d.lastTarget) { d.lastTarget = d.target; if (this.onDoor) this.onDoor(d); }
      d.open += (d.target - d.open) * Math.min(1, dt * 8);
      d.slab.position.y = H / 2 + d.open * (H + 0.2);
    }
  }

  rect(cx, cz) {
    switch (this.at(cx, cz)) {
      case '#': case 'X': return [cx * C, cz * C, cx * C + C, cz * C + C];
      case 'd': { const x = center(cx), z = center(cz); return [x - 1.3, z - 1.3, x + 1.3, z + 1.3]; }
      case 'S': { const x = center(cx), z = center(cz); return [x - 1.7, z - 1.0, x + 1.7, z + 1.0]; }
      case 'L': return [cx * C, cz * C, cx * C + C, cz * C + 1.2];
      case 'D': { const d = this.doorMap.get(cx + ',' + cz); if (d.open < 0.7) { const z = center(cz); return [cx * C, z - 0.3, cx * C + C, z + 0.3]; } return null; }
      default: return null;
    }
  }

  collide(p, r) {
    const cx = cellOf(p.x), cz = cellOf(p.z);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const q = this.rect(cx + dx, cz + dz); if (!q) continue;
      const nx = Math.max(q[0], Math.min(p.x, q[2])), nz = Math.max(q[1], Math.min(p.z, q[3]));
      const ex = p.x - nx, ez = p.z - nz, d2 = ex * ex + ez * ez;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += ex * k; p.z += ez * k; }
      else {
        const l = p.x - q[0], rt = q[2] - p.x, t = p.z - q[1], b = q[3] - p.z, m = Math.min(l, rt, t, b);
        if (m === l) p.x = q[0] - r; else if (m === rt) p.x = q[2] + r; else if (m === t) p.z = q[1] - r; else p.z = q[3] + r;
      }
    }
  }

  visible(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), steps = Math.ceil(len / 0.6);
    for (let i = 1; i < steps; i++) {
      const x = ax + dx * i / steps, z = az + dz * i / steps, cx = cellOf(x), cz = cellOf(z), ch = this.at(cx, cz);
      if (ch === '#' || ch === 'X') return false;
      if (ch === 'D' && this.doorMap.get(cx + ',' + cz).open < 0.5) return false;
    }
    return true;
  }

  walkable(cx, cz) {
    const ch = this.at(cx, cz);
    if (ch === '.' || ch === 'L') return true;
    if (ch === 'D') return !this.doorMap.get(cx + ',' + cz).locked;
    return false;
  }

  nearest(cx, cz) {
    if (this.walkable(cx, cz)) return [cx, cz];
    for (let r = 1; r <= 4; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (this.walkable(cx + dx, cz + dz)) return [cx + dx, cz + dz];
    return [cx, cz];
  }

  // BFS over the grid; returns cell-centre waypoints from the next cell to the goal.
  path(sx, sz, tx, tz) {
    const sc = cellOf(sx), sr = cellOf(sz), [gc, gr] = this.nearest(cellOf(tx), cellOf(tz));
    const start = sr * COLS + sc, goal = gr * COLS + gc;
    if (start === goal) return [{ x: center(gc), z: center(gr) }];
    const prev = new Int16Array(COLS * ROWS).fill(-2); prev[start] = -1;
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      const cur = q[h]; if (cur === goal) break;
      const cx = cur % COLS, cz = (cur / COLS) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz, ni = nz * COLS + nx;
        if (nx < 0 || nz < 0 || nx >= COLS || nz >= ROWS || prev[ni] !== -2 || !this.walkable(nx, nz)) continue;
        prev[ni] = cur; q.push(ni);
      }
    }
    if (prev[goal] === -2) return [];
    const out = [];
    for (let c = goal; c !== start; c = prev[c]) out.push({ x: center(c % COLS), z: center((c / COLS) | 0) });
    return out.reverse();
  }
}
