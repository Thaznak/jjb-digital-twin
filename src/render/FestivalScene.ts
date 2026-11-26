import Phaser from 'phaser';
import type { Site, Stage } from '../engine';
import { C, hexNum, shade } from './palette';
import { MAP_H, MAP_W, TILE_H, toScreen } from './iso';

type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

export interface Pin {
  id: string;
  name: string;
  color: string;
  /** Tile coordinates. */
  x: number;
  y: number;
  /** Set when standing at a stage, so pins at the same stage spread out. */
  stageId?: string;
  active: boolean;
  walking: boolean;
}

export interface SceneView {
  nowPlaying: Record<string, string | null>;
  pins: Pin[];
  groups: { stageId: string; count: number }[];
  selectedStage: string | null;
  /** Rain over the current hour, mm. */
  rain: number;
  /** Minutes since midnight of the festival day. */
  clock: number;
  /** Stages with a favorite of the active person at this time. */
  focusStages: string[];
}

export interface SceneHooks {
  onStage: (id: string) => void;
}

const ZMIN = 0.3;
const ZMAX = 2.6;

/** Draws the stylised site. No business rule here: everything arrives through setView. */
export class FestivalScene extends Phaser.Scene {
  private site!: Site;
  private hooks!: SceneHooks;
  private labels = new Map<string, { name: Phaser.GameObjects.Text; now: Phaser.GameObjects.Text }>();
  private overlay!: G;
  private pinLayer!: Phaser.GameObjects.Container;
  private sky!: Phaser.GameObjects.Rectangle;
  private rainFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lights: G[] = [];
  private view: SceneView | null = null;
  private ready = false;
  private pending: (() => void)[] = [];
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
  private pinch: number | null = null;

  constructor() {
    super('festival');
  }

  init(data: { site: Site; hooks: SceneHooks }) {
    this.site = data.site;
    this.hooks = data.hooks;
  }

  whenReady(fn: () => void) {
    if (this.ready) fn();
    else this.pending.push(fn);
  }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor(C.night);
    this.makeTextures();
    this.drawGround();
    this.drawPaths();
    this.drawDecor();
    for (const s of this.site.stages) this.drawStage(s);
    this.overlay = this.add.graphics().setDepth(90000);
    this.pinLayer = this.add.container(0, 0).setDepth(100000);

    // Night tint and rain stay fixed on screen.
    this.sky = this.add.rectangle(0, 0, 10, 10, 0x0a1430, 0).setOrigin(0).setScrollFactor(0).setDepth(200000);
    this.rainFx = this.add.particles(0, 0, 'drop', {
      x: { min: -200, max: 2400 },
      y: -20,
      lifespan: 1300,
      speedY: { min: 520, max: 680 },
      speedX: { min: -140, max: -100 },
      quantity: 0,
      frequency: 16,
      alpha: { start: 0.5, end: 0.15 },
      rotate: 12,
    });
    this.rainFx.setScrollFactor(0).setDepth(200001);

    const centre = toScreen(MAP_W / 2, MAP_H / 2 - 4);
    const narrow = this.scale.width < 700;
    cam.setZoom(narrow ? 0.42 : 0.72);
    cam.centerOn(centre.x, centre.y);
    this.bindInput();
    this.scale.on('resize', () => this.layoutOverlay());
    this.layoutOverlay();
    this.ready = true;
    this.pending.splice(0).forEach((f) => f());
  }

  // ---------- public setters ----------
  setView(v: SceneView) {
    this.view = v;
    if (!this.ready) return;
    for (const s of this.site.stages) {
      const l = this.labels.get(s.id)!;
      const band = v.nowPlaying[s.id];
      l.now.setText(band ?? '·').setColor(band ? '#f08a24' : '#6f6a60');
      const sel = v.selectedStage === s.id || v.focusStages.includes(s.id);
      l.name.setColor(sel ? '#0b0b0c' : '#efe6d2').setBackgroundColor(sel ? '#efe6d2' : '#0b0b0cdd');
    }
    this.drawOverlay();
    this.drawPins();
    const night = nightAlpha(v.clock);
    this.sky.setFillStyle(0x0a1430, night);
    for (const g of this.lights) g.setAlpha(Math.min(1, night * 2.2));
    this.rainFx.setQuantity(v.rain >= 0.2 ? Math.min(6, 1 + Math.round(v.rain * 2)) : 0);
  }

  zoomBy(f: number) {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * f, ZMIN, ZMAX));
  }

  focusStage(id: string) {
    const s = this.site.stages.find((x) => x.id === id);
    if (!s) return;
    const p = toScreen(s.x, s.y);
    this.cameras.main.pan(p.x, p.y, 450, 'Sine.easeInOut');
  }

  resetView() {
    const c = toScreen(MAP_W / 2, MAP_H / 2 - 4);
    const cam = this.cameras.main;
    cam.setZoom(this.scale.width < 700 ? 0.42 : 0.72);
    cam.centerOn(c.x, c.y);
  }

  // ---------- input: drag to pan, wheel and pinch to zoom, tap a stage ----------
  private bindInput() {
    const cam = this.cameras.main;
    this.input.addPointer(1);
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const before = cam.getWorldPoint(p.x, p.y);
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), ZMIN, ZMAX));
      const after = cam.getWorldPoint(p.x, p.y);
      cam.scrollX += before.x - after.x;
      cam.scrollY += before.y - after.y;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.drag = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY, moved: false };
    });
    this.input.on('pointermove', () => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.pinch) cam.setZoom(Phaser.Math.Clamp(cam.zoom * (d / this.pinch), ZMIN, ZMAX));
        this.pinch = d;
        if (this.drag) this.drag.moved = true;
        return;
      }
      this.pinch = null;
      const p = this.input.activePointer;
      if (!this.drag || !p.isDown) return;
      const dx = p.x - this.drag.x;
      const dy = p.y - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) this.drag.moved = true;
      cam.scrollX = this.drag.sx - dx / cam.zoom;
      cam.scrollY = this.drag.sy - dy / cam.zoom;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const tap = this.drag && !this.drag.moved;
      this.drag = null;
      this.pinch = null;
      if (!tap) return;
      const w = cam.getWorldPoint(p.x, p.y);
      const hit = this.site.stages
        .map((s) => ({ s, d: Phaser.Math.Distance.Between(w.x, w.y, toScreen(s.x, s.y).x, toScreen(s.x, s.y).y - 40) }))
        .sort((a, b) => a.d - b.d)[0];
      if (hit && hit.d < 150) this.hooks.onStage(hit.s.id);
    });
  }

  private layoutOverlay() {
    this.sky.setSize(this.scale.width, this.scale.height);
  }

  // ---------- textures ----------
  private makeTextures() {
    const g = this.add.graphics();
    g.fillStyle(0x9fc3e0, 1).fillRect(0, 0, 2, 14);
    g.generateTexture('drop', 2, 14);
    g.destroy();
  }

  // ---------- ground ----------
  private poly(g: G, pts: Pt[], color: number, alpha = 1) {
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
    g.closePath();
    g.fillPath();
  }

  private tileRect(x0: number, y0: number, x1: number, y1: number, dz = 0): Pt[] {
    return [toScreen(x0, y0), toScreen(x1, y0), toScreen(x1, y1), toScreen(x0, y1)].map((p) => ({ x: p.x, y: p.y - dz }));
  }

  private drawGround() {
    const g = this.add.graphics().setDepth(-1000);
    // Soil edge under the map, so it reads as a slab.
    const edge = 18;
    this.poly(g, [toScreen(0, MAP_H), toScreen(MAP_W, MAP_H), { x: toScreen(MAP_W, MAP_H).x, y: toScreen(MAP_W, MAP_H).y + edge }, { x: toScreen(0, MAP_H).x, y: toScreen(0, MAP_H).y + edge }], 0x241d16);
    this.poly(g, [toScreen(MAP_W, 0), toScreen(MAP_W, MAP_H), { x: toScreen(MAP_W, MAP_H).x, y: toScreen(MAP_W, MAP_H).y + edge }, { x: toScreen(MAP_W, 0).x, y: toScreen(MAP_W, 0).y + edge }], 0x1a1510);
    for (let x = 0; x < MAP_W; x++) {
      for (let y = 0; y < MAP_H; y++) {
        const n = ((x * 73856093) ^ (y * 19349663)) & 7;
        this.poly(g, this.tileRect(x, y, x + 1, y + 1), n < 4 ? C.grass : C.grass2);
      }
    }
    // Trampled crowd areas in front of each stage.
    for (const s of this.site.stages) {
      const r = s.kind === 'main' ? 4 : 2.6;
      this.poly(g, this.tileRect(s.x - r, s.y - 0.5, s.x + r, s.y + r * 1.1), C.trampled, 0.9);
    }
    // Water: a stylised river along the north-west edge (the Sèvre runs near the site).
    for (let y = 0; y < MAP_H; y++) this.poly(g, this.tileRect(0, y, 1.4 + Math.sin(y / 3) * 0.4, y + 1), C.water);
  }

  private nodePos(id: string): Pt {
    const n = this.site.stages.find((s) => s.id === id) ?? this.site.hubs.find((h) => h.id === id)!;
    return { x: n.x, y: n.y };
  }

  private drawPaths() {
    const g = this.add.graphics().setDepth(-900);
    for (const e of this.site.edges) {
      const a = toScreen(this.nodePos(e.a).x, this.nodePos(e.a).y);
      const b = toScreen(this.nodePos(e.b).x, this.nodePos(e.b).y);
      g.lineStyle(30, C.pathEdge, 1).lineBetween(a.x, a.y, b.x, b.y);
    }
    for (const e of this.site.edges) {
      const a = toScreen(this.nodePos(e.a).x, this.nodePos(e.a).y);
      const b = toScreen(this.nodePos(e.b).x, this.nodePos(e.b).y);
      g.lineStyle(22, C.path, 1).lineBetween(a.x, a.y, b.x, b.y);
    }
    for (const h of this.site.hubs) {
      const p = toScreen(h.x, h.y);
      g.fillStyle(C.path, 1).fillEllipse(p.x, p.y, 70, 35);
    }
  }

  // ---------- volumes ----------
  /** Extruded box: tile rectangle, height in px. Light from top-left. */
  private box(g: G, x0: number, y0: number, x1: number, y1: number, z0: number, h: number, color: number) {
    const top = this.tileRect(x0, y0, x1, y1, z0 + h);
    const fl = [toScreen(x0, y1), toScreen(x1, y1)];
    const fr = [toScreen(x1, y0), toScreen(x1, y1)];
    this.poly(g, [{ x: fl[0].x, y: fl[0].y - z0 }, { x: fl[1].x, y: fl[1].y - z0 }, { x: fl[1].x, y: fl[1].y - z0 - h }, { x: fl[0].x, y: fl[0].y - z0 - h }], color);
    this.poly(g, [{ x: fr[0].x, y: fr[0].y - z0 }, { x: fr[1].x, y: fr[1].y - z0 }, { x: fr[1].x, y: fr[1].y - z0 - h }, { x: fr[0].x, y: fr[0].y - z0 - h }], shade(color, 0.72));
    this.poly(g, top, shade(color, 1.3));
    g.lineStyle(1, C.ink, 0.9);
    g.strokePoints([...top, top[0]], false);
  }

  private depthOf(x: number, y: number) {
    return (x + y) * 10;
  }

  private drawStage(s: Stage) {
    const g = this.add.graphics();
    const hw = s.w / 2;
    let labelZ = 0;
    if (s.kind === 'tent') {
      const x0 = s.x - hw;
      const x1 = s.x + hw;
      const y0 = s.y - s.h / 2 - 1;
      const y1 = s.y + s.h / 2 - 1;
      g.setDepth(this.depthOf(x1, y1));
      this.box(g, x0, y0, x1, y1, 0, 34, C.tentB);
      // Peaked roof with fabric stripes.
      const apex = toScreen(s.x, (y0 + y1) / 2);
      const peak = { x: apex.x, y: apex.y - 34 - 70 };
      const c = this.tileRect(x0, y0, x1, y1, 34);
      this.poly(g, [c[3], c[2], peak], C.tentA);
      this.poly(g, [c[2], c[1], peak], shade(C.tentA, 0.7));
      for (let k = 1; k < 4; k++) {
        const t = k / 4;
        g.lineStyle(2, C.rust, 0.8).lineBetween(c[3].x + (c[2].x - c[3].x) * t, c[3].y + (c[2].y - c[3].y) * t, peak.x, peak.y);
      }
      g.lineStyle(1, C.ink, 1).lineBetween(c[3].x, c[3].y, peak.x, peak.y).lineBetween(c[2].x, c[2].y, peak.x, peak.y).lineBetween(c[1].x, c[1].y, peak.x, peak.y);
      // Glowing entrance on the crowd side.
      const d0 = toScreen(s.x - 1, y1);
      const d1 = toScreen(s.x + 1, y1);
      const glow = this.add.graphics().setDepth(this.depthOf(x1, y1) + 1);
      this.poly(glow, [d0, d1, { x: d1.x, y: d1.y - 26 }, { x: d0.x, y: d0.y - 26 }], C.ember, 0.85);
      this.lights.push(glow);
      labelZ = 120;
    } else {
      const big = s.kind === 'main';
      const x0 = s.x - hw;
      const x1 = s.x + hw;
      const y1 = s.y - 1;
      const y0 = y1 - s.h;
      g.setDepth(this.depthOf(x1, y1));
      const H = big ? 120 : 70;
      // Deck, back wall, towers, roof truss, screens.
      this.box(g, x0, y0, x1, y1, 0, 18, C.stage);
      this.box(g, x0, y0, x1, y0 + 0.8, 18, H - 18, C.stage);
      this.box(g, x0 - 0.8, y1 - 1, x0, y1, 0, H + 10, C.metal);
      this.box(g, x1, y1 - 1, x1 + 0.8, y1, 0, H + 10, C.metal);
      this.box(g, x0 - 0.8, y0, x1 + 0.8, y1, H + 10, 10, C.metal);
      const light = this.add.graphics().setDepth(this.depthOf(x1, y1) + 1);
      if (big) {
        for (const sx of [x0 - 0.75, x1 + 0.05]) {
          const a = toScreen(sx, y1 + 0.02);
          const b = toScreen(sx + 0.7, y1 + 0.02);
          this.poly(light, [{ x: a.x, y: a.y - 40 }, { x: b.x, y: b.y - 40 }, { x: b.x, y: b.y - 100 }, { x: a.x, y: a.y - 100 }], C.screen, 0.9);
        }
      }
      // Stage lights under the roof.
      for (let k = 0; k < (big ? 6 : 4); k++) {
        const p = toScreen(x0 + ((k + 0.5) * s.w) / (big ? 6 : 4), y1);
        light.fillStyle(k % 2 ? C.ember : C.bone, 1).fillCircle(p.x, p.y - H, 4);
        light.fillStyle(k % 2 ? C.ember : C.bone, 0.08).fillTriangle(p.x, p.y - H, p.x - 30, p.y + 10, p.x + 30, p.y + 10);
      }
      this.lights.push(light);
      // Mixing desk in the crowd.
      if (big) {
        const m = this.add.graphics().setDepth(this.depthOf(s.x + 0.6, s.y + 5));
        this.box(m, s.x - 0.6, s.y + 4.4, s.x + 0.6, s.y + 5.2, 0, 26, C.metal);
      }
      labelZ = H + 30;
    }
    const p = toScreen(s.x, s.y - (s.kind === 'tent' ? 1 : s.h / 2 + 1));
    const name = this.add
      .text(p.x, p.y - labelZ, s.name.toUpperCase(), { fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif', fontSize: s.kind === 'main' ? '30px' : '24px', fontStyle: '700', color: '#efe6d2', backgroundColor: '#0b0b0cdd', padding: { x: 8, y: 2 } })
      .setOrigin(0.5, 1)
      .setDepth(95000);
    const now = this.add
      .text(p.x, p.y - labelZ + 4, '·', { fontFamily: 'Inter, sans-serif', fontSize: '17px', fontStyle: '600', color: '#f08a24', backgroundColor: '#0b0b0cbb', padding: { x: 6, y: 2 } })
      .setOrigin(0.5, 0)
      .setDepth(95000);
    this.labels.set(s.id, { name, now });
  }

  private drawDecor() {
    // Entrance gate: two stone towers and a lintel, our own design.
    const e = this.site.hubs.find((h) => h.id === 'entree')!;
    const gate = this.add.graphics().setDepth(this.depthOf(e.x + 3, e.y + 1));
    this.box(gate, e.x - 3, e.y, e.x - 1.8, e.y + 1, 0, 90, 0x3a3936);
    this.box(gate, e.x + 1.8, e.y, e.x + 3, e.y + 1, 0, 90, 0x3a3936);
    this.box(gate, e.x - 3, e.y, e.x + 3, e.y + 1, 90, 20, 0x2b2a28);
    const fire = this.add.graphics().setDepth(this.depthOf(e.x + 3, e.y + 1) + 1);
    for (const dx of [-2.4, 2.4]) {
      const p = toScreen(e.x + dx, e.y + 0.5);
      fire.fillStyle(C.ember, 1).fillTriangle(p.x - 6, p.y - 112, p.x + 6, p.y - 112, p.x, p.y - 132);
    }
    this.lights.push(fire);
    this.text(e.x, e.y + 2.5, 'ENTRÉE', 18);

    // Hell City: a street of small shops and bars.
    const hc = this.site.hubs.find((h) => h.id === 'hellcity')!;
    for (let k = 0; k < 5; k++) {
      for (const side of [-1, 1]) {
        const x0 = hc.x + side * 2 + (side < 0 ? -1.6 : 0);
        const y0 = hc.y - 4 + k * 1.8;
        const g = this.add.graphics().setDepth(this.depthOf(x0 + 1.6, y0 + 1.4));
        this.box(g, x0, y0, x0 + 1.6, y0 + 1.4, 0, 28, k % 2 ? 0x4a3f33 : 0x3d3a36);
        const awn = this.tileRect(x0, y0, x0 + 1.6, y0 + 1.4, 30);
        this.poly(g, awn, k % 2 ? C.rust : 0x2f2f33);
      }
    }
    this.text(hc.x, hc.y + 2, 'HELL CITY', 18);

    // Bars, food trucks, toilets: small blocks near the hubs.
    const props: [number, number, number][] = [
      [20, 20, 0x6b4d2e], [25, 20, 0x6b4d2e], [34, 19, 0x3d3a36], [29, 30, 0x6b4d2e], [14, 22, 0x3d3a36], [14, 30, 0x6b4d2e], [8, 24, 0x2f3a46], [35, 14, 0x2f3a46],
    ];
    for (const [x, y, c] of props) {
      const g = this.add.graphics().setDepth(this.depthOf(x + 1.4, y + 1));
      this.box(g, x, y, x + 1.4, y + 1, 0, 22, c);
    }

    // Trees around the edges and between zones.
    const r = (n: number) => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1;
    for (let k = 0; k < 120; k++) {
      const onEdge = k % 2 === 0;
      const x = onEdge ? (r(k) < 0.5 ? 1.5 + r(k + 1) * 2 : MAP_W - 1 - r(k + 1) * 2) : 2 + r(k + 2) * (MAP_W - 4);
      const y = onEdge ? 2 + r(k + 3) * (MAP_H - 4) : r(k + 4) < 0.5 ? 1 + r(k + 5) * 3 : MAP_H - 1 - r(k + 5) * 2;
      if (this.nearSomething(x, y)) continue;
      this.tree(x, y, 0.8 + r(k + 6) * 0.5);
    }

    // Light towers.
    for (const [x, y] of [[22, 24], [33, 21], [12, 21]]) {
      const g = this.add.graphics().setDepth(this.depthOf(x + 0.3, y + 0.3));
      this.box(g, x, y, x + 0.3, y + 0.3, 0, 110, C.metal);
      const l = this.add.graphics().setDepth(this.depthOf(x + 0.3, y + 0.3) + 1);
      const p = toScreen(x + 0.15, y + 0.15);
      l.fillStyle(C.bone, 1).fillRect(p.x - 8, p.y - 122, 16, 8);
      l.fillStyle(C.bone, 0.06).fillTriangle(p.x, p.y - 116, p.x - 90, p.y + 30, p.x + 90, p.y + 30);
      this.lights.push(l);
    }
    this.text(4, 37, 'Vers le camping', 15);
  }

  private nearSomething(x: number, y: number) {
    const all = [...this.site.stages.map((s) => ({ x: s.x, y: s.y - 2, r: 5 })), ...this.site.hubs.map((h) => ({ x: h.x, y: h.y, r: 3.5 }))];
    return all.some((n) => Math.hypot(n.x - x, n.y - y) < n.r);
  }

  private tree(x: number, y: number, s: number) {
    const g = this.add.graphics().setDepth(this.depthOf(x, y));
    const p = toScreen(x, y);
    g.fillStyle(0x000000, 0.25).fillEllipse(p.x + 6, p.y + 2, 40 * s, 16 * s);
    g.fillStyle(C.wood, 1).fillRect(p.x - 2, p.y - 18 * s, 4, 18 * s);
    g.fillStyle(C.tree, 1).fillCircle(p.x, p.y - 30 * s, 16 * s);
    g.fillStyle(C.tree2, 1).fillCircle(p.x - 5 * s, p.y - 35 * s, 9 * s);
  }

  private text(x: number, y: number, t: string, size: number) {
    const p = toScreen(x, y);
    this.add
      .text(p.x, p.y, t, { fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif', fontSize: `${size}px`, fontStyle: '600', color: '#cfc6b2' })
      .setOrigin(0.5)
      .setDepth(94000);
  }

  // ---------- dynamic layers ----------
  private drawOverlay() {
    const g = this.overlay;
    g.clear();
    if (!this.view) return;
    for (const s of this.site.stages) {
      const sel = this.view.selectedStage === s.id;
      const focus = this.view.focusStages.includes(s.id);
      if (!sel && !focus) continue;
      const p = toScreen(s.x, s.y + 1.2);
      g.lineStyle(sel ? 4 : 3, sel ? C.bone : C.ember, sel ? 0.95 : 0.8).strokeEllipse(p.x, p.y, s.kind === 'main' ? 300 : 210, s.kind === 'main' ? 150 : 105);
    }
  }

  private drawPins() {
    if (!this.view) return;
    this.pinLayer.removeAll(true);
    const byStage = new Map<string, Pin[]>();
    for (const p of this.view.pins) if (p.stageId) byStage.set(p.stageId, [...(byStage.get(p.stageId) ?? []), p]);

    for (const g of this.view.groups) {
      if (g.count < 2) continue;
      const s = this.site.stages.find((x) => x.id === g.stageId)!;
      const c = toScreen(s.x, s.y + 1.2);
      const ring = this.add.graphics();
      ring.fillStyle(C.ember, 0.16).fillEllipse(c.x, c.y, 160, 80);
      ring.lineStyle(2, C.ember, 0.9).strokeEllipse(c.x, c.y, 160, 80);
      const tag = this.add
        .text(c.x, c.y + 44, `${g.count} ensemble`, { fontFamily: 'Inter, sans-serif', fontSize: '16px', fontStyle: '700', color: '#0b0b0c', backgroundColor: '#f08a24', padding: { x: 6, y: 2 } })
        .setOrigin(0.5, 0);
      this.pinLayer.add([ring, tag]);
    }

    for (const p of this.view.pins) {
      let pos = toScreen(p.x, p.y);
      if (p.stageId) {
        const list = byStage.get(p.stageId)!;
        const i = list.indexOf(p);
        const n = list.length;
        const s = this.site.stages.find((x) => x.id === p.stageId)!;
        const c = toScreen(s.x, s.y + 1.2);
        const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
        const rad = n > 1 ? 38 : 0;
        pos = { x: c.x + Math.cos(a) * rad * 1.4, y: c.y + Math.sin(a) * rad * 0.7 };
      }
      const col = hexNum(p.color);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.35).fillEllipse(pos.x, pos.y + 2, 26, 10);
      g.fillStyle(col, 1).fillTriangle(pos.x - 7, pos.y - 16, pos.x + 7, pos.y - 16, pos.x, pos.y);
      g.fillCircle(pos.x, pos.y - 24, 13);
      g.lineStyle(p.active ? 3 : 2, p.active ? C.bone : C.ink, 1).strokeCircle(pos.x, pos.y - 24, 13);
      const t = this.add
        .text(pos.x, pos.y - 24, p.name.slice(0, 2).toUpperCase(), { fontFamily: 'Inter, sans-serif', fontSize: '13px', fontStyle: '700', color: '#0b0b0c' })
        .setOrigin(0.5);
      this.pinLayer.add([g, t]);
      if (p.walking) {
        const w = this.add.text(pos.x + 15, pos.y - 40, '›', { fontFamily: 'Inter', fontSize: '18px', fontStyle: '700', color: p.color }).setOrigin(0.5);
        this.pinLayer.add(w);
      }
    }
  }
}

/** 0 by day, up to 0.45 deep in the night. Sunset is late in June (about 22:15 in Clisson). */
export function nightAlpha(clock: number): number {
  const h = clock / 60;
  if (h < 21.5) return 0;
  if (h < 23) return ((h - 21.5) / 1.5) * 0.45;
  return 0.45;
}

export { TILE_H };
