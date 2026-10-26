import * as THREE from 'three';
import { center, cellOf } from './world.js';

const mat = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

function makeHumanoid(o) {
  const g = new THREE.Group(), r = o.headR || 0.7;
  const part = (w, h, d, c, x, y, z, parent = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); parent.add(m); return m; };
  const legL = part(0.4, 0.8, 0.4, o.pants, -0.3, 0.4, 0), legR = part(0.4, 0.8, 0.4, o.pants, 0.3, 0.4, 0);
  part(1.2, 1.2, 0.65, o.shirt, 0, 1.4, 0);
  const armL = part(0.3, 1.0, 0.3, o.shirt, -0.75, 1.95, 0), armR = part(0.3, 1.0, 0.3, o.shirt, 0.75, 1.95, 0);
  armL.geometry.translate(0, -0.45, 0); armR.geometry.translate(0, -0.45, 0);
  const head = new THREE.Group(); head.position.y = o.headY || 2.45; g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(o.skin)); head.add(skull);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r * 0.24, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); e.position.set(s * r * 0.38, r * 0.15, r * 0.82); head.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 5, 4), new THREE.MeshBasicMaterial({ color: 0x111111 })); p.position.set(s * r * 0.38, r * 0.15, r * 1.02); head.add(p);
  }
  const mouth = part(0.4, 0.08, 0.05, 0x5a1010, 0, -r * 0.4, r * 0.93, head);
  part(r * 1.8, 0.22, r * 1.8, o.hair, 0, r * 0.78, -0.02, head);
  return { g, legL, legR, armL, armR, head, mouth, skull };
}

class Walker {
  constructor(world, sound, opts) {
    this.world = world; this.sound = sound;
    Object.assign(this, makeHumanoid(opts));
    this.group = this.g; this.pos = this.group.position;
    this.path = []; this.yaw = 0; this.walkT = 0; this.stride = 0; this.on = true;
  }
  setCell(cx, cz) { this.pos.set(center(cx), 0, center(cz)); this.path = []; }
  goTo(x, z) { this.path = this.world.path(this.pos.x, this.pos.z, x, z); }
  face(x, z) { this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z); this.group.rotation.y = this.yaw; }
  follow(dt, speed) {
    if (!this.path.length) return false;
    const t = this.path[0], dx = t.x - this.pos.x, dz = t.z - this.pos.z, d = Math.hypot(dx, dz), s = speed * dt;
    if (d <= s) { this.pos.x = t.x; this.pos.z = t.z; this.path.shift(); }
    else { this.pos.x += dx / d * s; this.pos.z += dz / d * s; }
    if (d > 0.001) {
      let diff = Math.atan2(dx, dz) - this.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.yaw += diff * Math.min(1, dt * 10); this.group.rotation.y = this.yaw;
    }
    this.walkT += s; this.stride += s;
    if (this.stride > 2.3) { this.stride = 0; this.sound.play('tstep', this.pos); }
    return true;
  }
  anim(dt, moving) {
    const a = moving ? Math.sin(this.walkT * 1.7) * 0.7 : 0, k = Math.min(1, dt * 12);
    this.legL.rotation.x += (a - this.legL.rotation.x) * k; this.legR.rotation.x += (-a - this.legR.rotation.x) * k;
    this.armL.rotation.x += (-a * 0.8 - this.armL.rotation.x) * k; this.armR.rotation.x += (a * 0.8 - this.armR.rotation.x) * k;
  }
}

const WAYS = [[3, 10], [15, 10], [28, 10], [10, 10], [22, 10], [4, 4], [12, 4], [20, 4], [5, 16], [19, 15], [27, 18], [11, 18]];

export class Teacher extends Walker {
  constructor(world, sound) {
    super(world, sound, { skin: 0xf0c8a0, shirt: 0x6a4a8a, pants: 0x2a2a3a, hair: 0x3a2a1a, headR: 0.8, headY: 2.35 });
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.06), mat(0xc09a60)); clip.position.set(0, -0.85, 0.3); this.armR.add(clip);
    const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), mat(0xd8c070)); ruler.position.set(0, -0.9, 0.5); this.armL.add(ruler);
    this.reset();
  }
  reset() {
    this.setCell(24, 10); this.state = 'patrol'; this.stun = 0; this.lost = 0; this.repath = 0; this.search = 0; this.wait = 0;
    this.last = null; this.sees = false; this.n = -1; this.group.visible = true; this.setAnger(0);
  }
  setAnger(n) {
    this.n = n; const k = n / 7;
    this.skull.material.color.setHex(0xf0c8a0).lerp(new THREE.Color(0xc83a2a), k * 0.85);
    this.mouth.scale.set(1 + k * 2.2, 1 + k * 3, 1);
  }
  nextWay() {
    const cur = cellOf(this.pos.x) + ',' + cellOf(this.pos.z);
    for (let i = 0; i < 6 && !this.path.length; i++) { const w = pick(WAYS); if (w[0] + ',' + w[1] !== cur) this.goTo(center(w[0]), center(w[1])); }
  }
  hearNoise(x, z, r) {
    if (this.state === 'chase' || this.stun > 0) return;
    if (Math.hypot(x - this.pos.x, z - this.pos.z) > r * (1 + 0.08 * this.n)) return;
    this.state = 'investigate'; this.goTo(x, z);
  }
  lure(x, z) { if (this.state === 'chase' && this.sees) return; this.state = 'investigate'; this.goTo(x, z); }
  alert(x, z) { this.state = 'chase'; this.last = { x, z }; this.lost = 0; this.repath = 0; }
  update(dt, P) {
    if (P.n !== this.n) this.setAnger(P.n);
    const px = P.p.x, pz = P.p.z, dist = Math.hypot(px - this.pos.x, pz - this.pos.z);
    if (this.stun > 0) { this.stun -= dt; this.anim(dt, false); return; }
    this.sees = dist < 14 + 1.6 * this.n && this.world.visible(this.pos.x, this.pos.z, px, pz);
    if (this.sees) { this.last = { x: px, z: pz }; this.lost = 0; if (this.state !== 'chase') { this.state = 'chase'; this.repath = 0; } }
    let moving = false;
    switch (this.state) {
      case 'patrol':
        if (this.wait > 0) this.wait -= dt;
        else { if (!this.path.length) this.nextWay(); moving = this.follow(dt, 2.2 + 0.1 * this.n); if (!this.path.length) this.wait = rnd(0.5, 2.5); }
        break;
      case 'investigate':
        moving = this.follow(dt, 2.8 + 0.2 * this.n);
        if (!this.path.length) { this.state = 'search'; this.search = 5; }
        break;
      case 'chase':
        this.repath -= dt; if (!this.sees) this.lost += dt;
        if (this.repath <= 0) { const t = this.sees ? { x: px, z: pz } : this.last; this.goTo(t.x, t.z); this.repath = 0.3; }
        moving = this.follow(dt, 3.5 + 0.32 * this.n);
        if (!this.sees && ((this.lost > 1.5 && !this.path.length) || this.lost > 4)) { this.state = 'search'; this.search = 6; this.path = []; }
        break;
      case 'search':
        if (!this.path.length && this.last) this.goTo(this.last.x + rnd(-12, 12), this.last.z + rnd(-12, 12));
        moving = this.follow(dt, 2.6 + 0.15 * this.n);
        this.search -= dt;
        if (this.search <= 0) {
          this.state = 'return'; this.path = [];
          const w = WAYS.reduce((b, c) => Math.hypot(center(c[0]) - this.pos.x, center(c[1]) - this.pos.z) < Math.hypot(center(b[0]) - this.pos.x, center(b[1]) - this.pos.z) ? c : b);
          this.goTo(center(w[0]), center(w[1]));
        }
        break;
      case 'return':
        moving = this.follow(dt, 2.4);
        if (!this.path.length) this.state = 'patrol';
        break;
      default: break;
    }
    if (dist < 1.7 && this.sees) P.onCatch();
    this.anim(dt, moving);
  }
}

export class Monitor extends Walker {
  constructor(world, sound) {
    super(world, sound, { skin: 0xd8a878, shirt: 0xe87020, pants: 0x303030, hair: 0x202020, headR: 0.6 });
    this.on = false; this.reset();
  }
  reset() { this.setCell(2, 11); this.cd = 0; this.hold = 0; this.group.visible = false; }
  update(dt, P) {
    if (this.cd > 0) this.cd -= dt;
    if (this.hold > 0) { this.hold -= dt; this.anim(dt, false); return; }
    const d = Math.hypot(P.p.x - this.pos.x, P.p.z - this.pos.z);
    if (this.cd <= 0 && P.sprinting && d < 13 && this.world.visible(this.pos.x, this.pos.z, P.p.x, P.p.z)) {
      P.freeze(2.2, 'HALL MONITOR: NO RUNNING IN THE HALLS.');
      this.cd = 14; this.hold = 2.2; this.face(P.p.x, P.p.z); this.sound.play('whistle', this.pos); return;
    }
    if (!this.path.length) { const w = pick([[2, 11], [29, 11], [2, 9], [29, 9], [15, 11]]); this.goTo(center(w[0]), center(w[1])); }
    this.anim(dt, this.follow(dt, 2.0));
  }
}

export class Runner extends Walker {
  constructor(world, sound) {
    super(world, sound, { skin: 0xe8b090, shirt: 0x30a050, pants: 0x204080, hair: 0xf0e060, headR: 0.6 });
    this.on = false; this.reset();
  }
  reset() { this.state = 'idle'; this.t = rnd(10, 18); this.dir = 1; this.hit = false; this.group.visible = false; }
  update(dt, P) {
    switch (this.state) {
      case 'idle':
        this.t -= dt;
        if (this.t <= 0) {
          this.dir = Math.random() < 0.5 ? 1 : -1;
          this.pos.set(this.dir > 0 ? center(1) : center(30), 0, center(pick([9, 10, 11])));
          this.group.rotation.y = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          this.state = 'warn'; this.t = 2.4; this.hit = false; this.sound.play('sweep', this.pos);
        }
        break;
      case 'warn':
        this.t -= dt;
        if (this.t <= 0) { this.state = 'dash'; this.group.visible = true; this.sound.play('whoosh', this.pos); }
        break;
      case 'dash': {
        this.pos.x += this.dir * 16 * dt; this.walkT += 16 * dt; this.anim(dt, true);
        if (!this.hit && Math.abs(this.pos.x - P.p.x) < 1.3 && Math.abs(this.pos.z - P.p.z) < 1.6) { this.hit = true; P.knock(this.dir); }
        if ((this.dir > 0 && this.pos.x > center(30)) || (this.dir < 0 && this.pos.x < center(1))) { this.state = 'idle'; this.t = rnd(20, 32); this.group.visible = false; }
        break;
      }
      default: break;
    }
  }
}

export class Janitor extends Walker {
  constructor(world, sound, scene) {
    super(world, sound, { skin: 0xc09a78, shirt: 0x3a5a8a, pants: 0x3a5a8a, hair: 0x808080, headR: 0.62 });
    const mop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), mat(0x8a6a3a)); mop.position.set(0, -0.4, 0.4); this.armR.add(mop);
    this.puddles = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1.5, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4a8ab0, transparent: true, opacity: 0.55 }));
      m.position.y = 0.03; m.visible = false; scene.add(m); this.puddles.push(m);
    }
    this.on = false; this.reset();
  }
  reset() { this.setCell(26, 10); this.dropT = 6; this.next = 0; this.puddles.forEach(m => { m.visible = false; }); this.group.visible = false; }
  update(dt) {
    this.dropT -= dt;
    if (this.dropT <= 0) {
      this.dropT = 9; const m = this.puddles[this.next++ % 3];
      m.position.x = this.pos.x; m.position.z = this.pos.z; m.visible = true;
    }
    if (!this.path.length) { const w = pick([[3, 10], [27, 10], [15, 10]]); this.goTo(center(w[0]), center(w[1])); }
    this.anim(dt, this.follow(dt, 1.5));
  }
}
