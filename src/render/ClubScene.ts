import Phaser from 'phaser';
import { BUILDING_SPECS, canPlace, footprint, type Alert, type Building, type BuildingType, type Belt } from '../engine';
import { BELT_COLORS, C, seasonGround, shade } from './palette';
import { MAP_SIZE, TILE_H, toScreen, toTile } from './iso';

export type Tool = BuildingType | 'supprimer' | null;

export interface SceneHooks {
  onPlace: (type: BuildingType, x: number, y: number) => void;
  onRemove: (b: Building) => void;
  onHoverInfo: (text: string | null) => void;
}

export interface Weatherish {
  tempMaxC: number;
  precipMm: number;
}

type Pt = { x: number; y: number };

const ORIGIN_Y = 60;

/** Renders the club. Holds no business logic: everything comes from /engine via setters. */
export class ClubScene extends Phaser.Scene {
  private hooks!: SceneHooks;
  private buildings: Building[] = [];
  private tool: Tool = null;
  private ground!: Phaser.GameObjects.Graphics;
  private buildingLayer!: Phaser.GameObjects.Container;
  private ghost!: Phaser.GameObjects.Graphics;
  private crackLayer!: Phaser.GameObjects.Graphics;
  private badgeLayer!: Phaser.GameObjects.Container;
  private people: Phaser.GameObjects.Image[] = [];
  private rain!: Phaser.GameObjects.Particles.ParticleEmitter;
  private snow!: Phaser.GameObjects.Particles.ParticleEmitter;
  private heat!: Phaser.GameObjects.Rectangle;
  private month = -1;
  private alerts: Alert[] = [];
  private dragStart: { x: number; y: number; sx: number; sy: number } | null = null;
  private ready = false;
  private pending: (() => void)[] = [];

  constructor() {
    super('club');
  }

  init(data: { hooks: SceneHooks }) {
    this.hooks = data.hooks;
  }

  /** Runs fn now if the scene is ready, otherwise after create(). */
  whenReady(fn: () => void) {
    if (this.ready) fn();
    else this.pending.push(fn);
  }

  create() {
    this.makeTextures();
    this.cameras.main.setBackgroundColor(C.slate);
    this.ground = this.add.graphics().setDepth(-10);
    this.buildingLayer = this.add.container(0, ORIGIN_Y);
    this.crackLayer = this.add.graphics().setDepth(5000);
    this.crackLayer.y = ORIGIN_Y;
    this.badgeLayer = this.add.container(0, ORIGIN_Y).setDepth(6000);
    this.ghost = this.add.graphics().setDepth(4000);
    this.ghost.y = ORIGIN_Y;
    this.tweens.add({ targets: this.crackLayer, alpha: { from: 1, to: 0.55 }, duration: 900, yoyo: true, repeat: -1 });

    const cam = this.cameras.main;
    cam.centerOn(0, ORIGIN_Y + (MAP_SIZE * TILE_H) / 2);
    cam.setZoom(this.scale.width < 700 ? 0.6 : 1);

    // Weather overlays, fixed to the screen.
    const w = this.scale.width;
    this.rain = this.add.particles(0, -10, 'rain', {
      x: { min: -100, max: Math.max(w, 1600) + 200 },
      speedY: { min: 420, max: 560 },
      speedX: -90,
      lifespan: 1800,
      quantity: 3,
      frequency: 20,
      alpha: { start: 0.55, end: 0.2 },
      emitting: false,
    });
    this.snow = this.add.particles(0, -10, 'snow', {
      x: { min: -50, max: Math.max(w, 1600) + 50 },
      speedY: { min: 40, max: 80 },
      speedX: { min: -20, max: 20 },
      lifespan: 9000,
      quantity: 1,
      frequency: 90,
      alpha: { start: 0.9, end: 0.3 },
      emitting: false,
    });
    for (const e of [this.rain, this.snow]) e.setScrollFactor(0).setDepth(7000);
    this.heat = this.add.rectangle(0, 0, 4000, 4000, C.warn, 0).setOrigin(0).setScrollFactor(0).setDepth(6900);

    this.setupInput();
    this.drawGround(new Date().getMonth());
    this.ready = true;
    this.pending.splice(0).forEach((fn) => fn());
  }

  // ---------- textures (all assets are drawn in code from the DA palette) ----------
  private makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xbfd8ef, 1).fillRect(0, 0, 2, 10);
    g.generateTexture('rain', 2, 10);
    g.clear().fillStyle(0xffffff, 1).fillCircle(2, 2, 2);
    g.generateTexture('snow', 4, 4);
    for (const [belt, color] of Object.entries(BELT_COLORS)) {
      for (const kid of [false, true]) {
        g.clear();
        const s = kid ? 0.75 : 1;
        const W = 14;
        const H = Math.round(24 * s);
        // shadow
        g.fillStyle(0x000000, 0.25).fillEllipse(W / 2, H - 1, 12 * s, 4);
        // legs
        g.fillStyle(0xf2f0ea, 1).fillRect(3, H - 9 * s, 3, 8 * s).fillRect(8, H - 9 * s, 3, 8 * s);
        // gi jacket
        g.fillStyle(0xf7f5ef, 1).fillRoundedRect(2, 8 * s, 10, 10 * s, 2);
        g.lineStyle(1, 0xc9c4b8, 1).strokeRoundedRect(2, 8 * s, 10, 10 * s, 2);
        // belt: the only vivid colour
        g.fillStyle(color, 1).fillRect(1, 14 * s, 12, 2.5);
        if (belt === 'noire') g.fillStyle(C.crisis, 1).fillRect(9, 14 * s, 2, 2.5);
        // head
        g.fillStyle(0xd9a982, 1).fillCircle(7, 5 * s, 4 * s);
        g.fillStyle(0x3b2a20, 1).fillRect(3 * s + 1, 1, 8 * s, 2);
        g.generateTexture(`p-${belt}${kid ? '-k' : ''}`, W, H);
      }
    }
    g.destroy();
  }

  // ---------- ground ----------
  private drawGround(month: number) {
    if (month === this.month) return;
    this.month = month;
    const g = this.ground;
    g.clear();
    const seasonC = seasonGround(month);
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let y = 0; y < MAP_SIZE; y++) {
        const ring = x < 2 || y < 2 || x >= MAP_SIZE - 2 || y >= MAP_SIZE - 2;
        const base = ring ? seasonC : (x + y) % 2 ? 0x55606c : 0x5b6672;
        this.fillTile(g, x, y, base, ORIGIN_Y);
        g.lineStyle(1, shade(base, 0.85), 0.6);
        this.strokeTile(g, x, y, ORIGIN_Y);
      }
    }
    // map edge thickness
    const L = toScreen(0, MAP_SIZE);
    const B = toScreen(MAP_SIZE, MAP_SIZE);
    const R = toScreen(MAP_SIZE, 0);
    g.fillStyle(shade(seasonC, 0.6), 1).fillPoints([p(L, ORIGIN_Y), p(B, ORIGIN_Y), p(B, ORIGIN_Y + 14), p(L, ORIGIN_Y + 14)], true);
    g.fillStyle(shade(seasonC, 0.45), 1).fillPoints([p(B, ORIGIN_Y), p(R, ORIGIN_Y), p(R, ORIGIN_Y + 14), p(B, ORIGIN_Y + 14)], true);
  }

  private tilePoints(x: number, y: number, w = 1, h = 1, oy = 0, lift = 0): Pt[] {
    return [toScreen(x, y), toScreen(x + w, y), toScreen(x + w, y + h), toScreen(x, y + h)].map((q) => ({ x: q.x, y: q.y + oy - lift }));
  }
  private fillTile(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, oy = 0) {
    g.fillStyle(color, 1).fillPoints(this.tilePoints(x, y, 1, 1, oy), true);
  }
  private strokeTile(g: Phaser.GameObjects.Graphics, x: number, y: number, oy = 0) {
    g.strokePoints(this.tilePoints(x, y, 1, 1, oy), true);
  }

  /** Extruded box: top, left (south-west) and right (south-east) faces lit from top-left. */
  private box(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, height: number, color: number, top?: number) {
    const [A, B, Cc, D] = this.tilePoints(x, y, w, h);
    const up = (q: Pt) => ({ x: q.x, y: q.y - height });
    g.fillStyle(color, 1).fillPoints([D, Cc, up(Cc), up(D)], true);
    g.fillStyle(shade(color, 0.78), 1).fillPoints([Cc, B, up(B), up(Cc)], true);
    g.fillStyle(top ?? shade(color, 1.12), 1).fillPoints([up(A), up(B), up(Cc), up(D)], true);
    g.lineStyle(1, shade(color, 0.55), 0.8).strokePoints([up(A), up(B), up(Cc), up(D)], true);
  }

  // ---------- buildings ----------
  setBuildings(list: Building[]) {
    this.buildings = list;
    this.whenReady(() => this.redrawBuildings());
  }

  private redrawBuildings() {
    this.buildingLayer.removeAll(true);
    const sorted = [...this.buildings].sort((a, b) => order(a) - order(b));
    for (const b of sorted) {
      const g = this.add.graphics();
      const s = BUILDING_SPECS[b.type];
      switch (b.type) {
        case 'dojo': {
          // Cutaway room, Theme-Hospital style: wooden floor and two back walls.
          const pts = this.tilePoints(b.x, b.y, s.w, s.h);
          g.fillStyle(shade(C.hinoki, 0.7), 1).fillPoints([pts[3], pts[2], { x: pts[2].x, y: pts[2].y + 6 }, { x: pts[3].x, y: pts[3].y + 6 }], true);
          g.fillStyle(shade(C.hinoki, 0.55), 1).fillPoints([pts[2], pts[1], { x: pts[1].x, y: pts[1].y + 6 }, { x: pts[2].x, y: pts[2].y + 6 }], true);
          g.fillStyle(C.hinoki, 1).fillPoints(pts, true);
          g.lineStyle(1, shade(C.hinoki, 0.8), 0.5);
          for (let i = 1; i < s.w; i++) g.lineBetween(toScreen(b.x + i, b.y).x, toScreen(b.x + i, b.y).y, toScreen(b.x + i, b.y + s.h).x, toScreen(b.x + i, b.y + s.h).y);
          const wallH = 46;
          const A = pts[0];
          const Bp = pts[1];
          const D = pts[3];
          g.fillStyle(C.linen, 1).fillPoints([A, D, { x: D.x, y: D.y - wallH }, { x: A.x, y: A.y - wallH }], true);
          g.fillStyle(shade(C.linen, 0.85), 1).fillPoints([A, Bp, { x: Bp.x, y: Bp.y - wallH }, { x: A.x, y: A.y - wallH }], true);
          // noren curtain and a timetable on the walls
          const mid = { x: (A.x + D.x) / 2, y: (A.y + D.y) / 2 };
          g.fillStyle(C.tatami, 1).fillPoints([{ x: mid.x - 18, y: mid.y - 9 - 40 }, { x: mid.x + 18, y: mid.y + 9 - 40 }, { x: mid.x + 18, y: mid.y + 9 - 22 }, { x: mid.x - 18, y: mid.y - 9 - 22 }], true);
          g.lineStyle(1, C.linen, 1).lineBetween(mid.x, mid.y - 31, mid.x, mid.y - 13);
          const mid2 = { x: (A.x + Bp.x) / 2, y: (A.y + Bp.y) / 2 };
          g.fillStyle(C.slate, 1).fillPoints([{ x: mid2.x - 22, y: mid2.y + 11 - 38 }, { x: mid2.x + 22, y: mid2.y - 11 - 38 }, { x: mid2.x + 22, y: mid2.y - 11 - 20 }, { x: mid2.x - 22, y: mid2.y + 11 - 20 }], true);
          g.lineStyle(1, C.gold, 0.9);
          for (let i = 0; i < 3; i++) g.lineBetween(mid2.x - 16, mid2.y + 8 - 33 + i * 5, mid2.x + 16, mid2.y - 8 - 33 + i * 5);
          g.setDepth(-5);
          this.buildingLayer.add(g);
          continue;
        }
        case 'tatami': {
          const pts = this.tilePoints(b.x, b.y, 1, 1, 0, 2);
          g.fillStyle(C.tatami, 1).fillPoints(pts, true);
          g.lineStyle(1, shade(C.tatami, 1.35), 0.9).strokePoints(this.tilePoints(b.x + 0.08, b.y + 0.08, 0.84, 0.84, 0, 2), true);
          break;
        }
        case 'vestiaire': {
          this.box(g, b.x, b.y, s.w, s.h, 38, C.linen, shade(C.hinoki, 0.9));
          const [, , Cc, D] = this.tilePoints(b.x, b.y, s.w, s.h);
          const m = { x: (Cc.x + D.x) / 2, y: (Cc.y + D.y) / 2 };
          g.fillStyle(C.tatami, 1).fillRect(m.x - 6, m.y - 26, 12, 22);
          // gi pictogram
          g.fillStyle(C.linen, 1).fillTriangle(m.x - 4, m.y - 22, m.x + 4, m.y - 22, m.x, m.y - 16).fillRect(m.x - 3, m.y - 17, 6, 7);
          break;
        }
        case 'accueil': {
          this.box(g, b.x, b.y, s.w, s.h, 28, shade(C.hinoki, 0.95), C.linen);
          const [, , Cc, D] = this.tilePoints(b.x, b.y, s.w, s.h);
          g.fillStyle(C.slate, 1).fillRect((Cc.x + D.x) / 2 - 10, (Cc.y + D.y) / 2 - 22, 20, 10);
          g.fillStyle(C.gold, 1).fillRect((Cc.x + D.x) / 2 - 7, (Cc.y + D.y) / 2 - 19, 14, 2);
          break;
        }
        case 'parking': {
          const pts = this.tilePoints(b.x, b.y, s.w, s.h, 0, 1);
          g.fillStyle(0x3b434e, 1).fillPoints(pts, true);
          g.lineStyle(2, 0xdedad0, 0.8);
          for (let i = 0.5; i < s.w; i += 0.5) {
            const a = toScreen(b.x + i, b.y + 0.15);
            const c = toScreen(b.x + i, b.y + 0.9);
            g.lineBetween(a.x, a.y - 1, c.x, c.y - 1);
          }
          this.box(g, b.x + 0.6, b.y + 1.15, 0.45, 0.7, 10, C.crisis);
          break;
        }
      }
      g.setDepth(order(b));
      this.buildingLayer.add(g);
    }
    this.buildingLayer.sort('depth');
    this.drawCracks();
  }

  // ---------- kintsugi cracks & alert badges ----------
  setAlerts(alerts: Alert[]) {
    this.alerts = alerts;
    this.whenReady(() => this.drawCracks());
  }

  private drawCracks() {
    const g = this.crackLayer;
    g.clear();
    this.badgeLayer.removeAll(true);
    const stack = new Map<string, number>();
    for (const a of this.alerts) {
      const typ: BuildingType = a.target === 'dojo' ? 'dojo' : a.target;
      const targets = this.buildings.filter((b) => b.type === typ);
      const b = typ === 'tatami' ? targets[Math.floor(targets.length / 2)] : targets[0];
      if (!b) continue;
      const s = BUILDING_SPECS[b.type];
      const center = toScreen(b.x + s.w / 2, b.y + s.h / 2);
      const lift = b.type === 'vestiaire' ? 38 : b.type === 'accueil' ? 28 : 4;
      const rng = new Phaser.Math.RandomDataGenerator([b.id + a.text]);
      const spread = Math.min(s.w, s.h) * 22 + 18;
      for (let k = 0; k < (a.level === 'crise' ? 5 : 3); k++) {
        let px = center.x + rng.between(-spread / 2, spread / 2);
        let py = center.y - lift + rng.between(-spread / 4, spread / 4);
        const pts: Pt[] = [{ x: px, y: py }];
        for (let i = 0; i < 6; i++) {
          px += rng.between(-16, 16);
          py += rng.between(-9, 9);
          pts.push({ x: px, y: py });
        }
        g.lineStyle(5, C.gold, 0.25).strokePoints(pts, false);
        g.lineStyle(2, C.gold, 1).strokePoints(pts, false);
      }
      // Stack badges that land on the same spot.
      const key = `${Math.round(center.x / 60)},${Math.round(center.y / 60)}`;
      const k = stack.get(key) ?? 0;
      stack.set(key, k + 1);
      const by = center.y - lift - 34 - k * 26;
      const color = a.level === 'crise' ? '#D35B4F' : '#E59F3A';
      const label = this.add
        .text(center.x, by, `${a.level === 'crise' ? '⬣' : '▲'} ${a.text}`, {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '12px',
          color: '#1F2A3D',
          backgroundColor: '#E9E4D8',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5, 1);
      const bar = this.add.rectangle(center.x - label.width / 2, by, 4, label.height, Phaser.Display.Color.HexStringToColor(color).color).setOrigin(0, 1);
      this.badgeLayer.add([label, bar]);
    }
  }

  // ---------- people & weather ----------
  /** Shows the attendance of the day on the mats, with belts in the real proportions. */
  setPeople(count: number, belts: { belt: Belt; kid: boolean }[]) {
    this.whenReady(() => {
      const mats = this.buildings.filter((b) => b.type === 'tatami');
      const target = mats.length ? Math.min(60, Math.round(count)) : 0;
      while (this.people.length > target) this.people.pop()!.destroy();
      while (this.people.length < target && belts.length) {
        const who = belts[Math.floor(Math.random() * belts.length)];
        const img = this.add.image(0, 0, `p-${who.belt}${who.kid ? '-k' : ''}`).setOrigin(0.5, 1);
        this.placeOnMat(img, mats, false);
        this.people.push(img);
      }
    });
  }

  private placeOnMat(img: Phaser.GameObjects.Image, mats: Building[], animate: boolean) {
    if (!mats.length) return;
    const t = mats[Math.floor(Math.random() * mats.length)];
    const fx = t.x + 0.2 + Math.random() * 0.6;
    const fy = t.y + 0.2 + Math.random() * 0.6;
    const s = toScreen(fx, fy);
    const depth = (fx + fy) * 10 + 2;
    if (!animate) {
      img.setPosition(s.x, s.y + ORIGIN_Y - 2).setDepth(depth);
    } else {
      img.setFlipX(s.x < img.x);
      this.tweens.add({ targets: img, x: s.x, y: s.y + ORIGIN_Y - 2, duration: 900 + Math.random() * 900, ease: 'Sine.easeInOut', onComplete: () => img.setDepth(depth) });
    }
  }

  setWeather(w: Weatherish, month: number) {
    this.whenReady(() => {
      this.drawGround(month);
      const cold = w.tempMaxC < 2;
      const rainy = w.precipMm > 2;
      this.rain.emitting = rainy && !cold;
      this.snow.emitting = rainy && cold;
      this.heat.fillAlpha = w.tempMaxC >= 28 ? Math.min(0.22, (w.tempMaxC - 26) * 0.03) : 0;
      this.cameras.main.setBackgroundColor(rainy ? shade(C.slate, 0.85) : C.slate);
    });
  }

  // ---------- tools & input ----------
  setTool(t: Tool) {
    this.tool = t;
    if (this.ghost) this.ghost.clear();
  }

  private setupInput() {
    const cam = this.cameras.main;
    this.input.mouse?.disableContextMenu();
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.4, 2.5));
    });
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.dragStart = { x: ptr.x, y: ptr.y, sx: cam.scrollX, sy: cam.scrollY };
    });
    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      const moved = this.dragStart ? Math.hypot(ptr.x - this.dragStart.x, ptr.y - this.dragStart.y) : 0;
      this.dragStart = null;
      if (moved > 6 || ptr.rightButtonReleased()) return;
      const t = this.pointerTile(ptr);
      if (this.tool === 'supprimer') {
        const hit = this.buildingAt(t.x, t.y);
        if (hit && hit.type !== 'dojo') this.hooks.onRemove(hit);
      } else if (this.tool) {
        if (canPlace(this.buildings, this.tool, t.x, t.y, MAP_SIZE)) this.hooks.onPlace(this.tool, t.x, t.y);
      }
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.dragStart && ptr.isDown) {
        cam.scrollX = this.dragStart.sx - (ptr.x - this.dragStart.x) / cam.zoom;
        cam.scrollY = this.dragStart.sy - (ptr.y - this.dragStart.y) / cam.zoom;
        return;
      }
      const t = this.pointerTile(ptr);
      this.drawGhost(t.x, t.y);
      const b = this.buildingAt(t.x, t.y);
      this.hooks.onHoverInfo(b ? `${BUILDING_SPECS[b.type].label} : ${BUILDING_SPECS[b.type].description}` : null);
    });
  }

  private pointerTile(ptr: Phaser.Input.Pointer) {
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    return toTile(wp.x, wp.y - ORIGIN_Y);
  }

  private buildingAt(x: number, y: number): Building | undefined {
    const hits = this.buildings.filter((b) => footprint(b).some((t) => t.x === x && t.y === y));
    return hits.find((b) => b.type !== 'dojo') ?? hits[0];
  }

  private drawGhost(x: number, y: number) {
    const g = this.ghost;
    g.clear();
    if (!this.tool) return;
    if (this.tool === 'supprimer') {
      const b = this.buildingAt(x, y);
      if (b && b.type !== 'dojo') {
        const s = BUILDING_SPECS[b.type];
        g.fillStyle(C.crisis, 0.35).fillPoints(this.tilePoints(b.x, b.y, s.w, s.h), true);
      }
      return;
    }
    const s = BUILDING_SPECS[this.tool];
    const ok = canPlace(this.buildings, this.tool, x, y, MAP_SIZE);
    g.fillStyle(ok ? C.ok : C.crisis, 0.4).fillPoints(this.tilePoints(x, y, s.w, s.h), true);
    g.lineStyle(2, ok ? C.ok : C.crisis, 1).strokePoints(this.tilePoints(x, y, s.w, s.h), true);
  }

  update(_t: number, dt: number) {
    // People wander between tatamis.
    if (!this.people.length) return;
    const mats = this.buildings.filter((b) => b.type === 'tatami');
    const chance = dt / 2500;
    for (const img of this.people) if (Math.random() < chance) this.placeOnMat(img, mats, true);
  }
}

function p(q: Pt, oy: number): Pt {
  return { x: q.x, y: q.y + oy };
}

function order(b: Building): number {
  const s = BUILDING_SPECS[b.type];
  if (b.type === 'dojo') return -5;
  if (b.type === 'tatami' || b.type === 'parking') return (b.x + b.y) * 10 - 4;
  return (b.x + s.w - 1 + b.y + s.h - 1) * 10 + 5;
}

