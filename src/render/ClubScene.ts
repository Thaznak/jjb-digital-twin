import Phaser from 'phaser';
import { BUILDING_SPECS, canPlace, footprint, type Alert, type Belt, type Building, type BuildingType } from '../engine';
import { BELT_HEX, C, seasonGround, shade } from './palette';
import { MAP_SIZE, TILE_H, toScreen, toTile } from './iso';
import { HAIR_COLORS, personGrid, SKINS, specKey, type Hair, type PersonSpec } from './pixelSprites';

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
type G = Phaser.GameObjects.Graphics;

const ORIGIN_Y = 60;

interface Person {
  img: Phaser.GameObjects.Image;
  seated: boolean;
}

/** Renders the club. Holds no business logic: everything comes from /engine via setters. */
export class ClubScene extends Phaser.Scene {
  private hooks!: SceneHooks;
  private buildings: Building[] = [];
  private tool: Tool = null;
  private ground!: G;
  private buildingLayer!: Phaser.GameObjects.Container;
  private ghost!: G;
  private crackLayer!: G;
  private badgeLayer!: Phaser.GameObjects.Container;
  private people: Person[] = [];
  private rain!: Phaser.GameObjects.Particles.ParticleEmitter;
  private snow!: Phaser.GameObjects.Particles.ParticleEmitter;
  private heat!: Phaser.GameObjects.Rectangle;
  private month = -1;
  private wet = false;
  private alerts: Alert[] = [];
  private dragStart: { x: number; y: number; sx: number; sy: number } | null = null;
  private ready = false;
  private pending: (() => void)[] = [];
  private seq = 0;

  constructor() {
    super('club');
  }

  init(data: { hooks: SceneHooks }) {
    this.hooks = data.hooks;
  }

  whenReady(fn: () => void) {
    if (this.ready) fn();
    else this.pending.push(fn);
  }

  create() {
    this.makeTextures();
    this.cameras.main.setBackgroundColor(C.night);
    this.ground = this.add.graphics().setDepth(-10);
    this.buildingLayer = this.add.container(0, ORIGIN_Y);
    this.crackLayer = this.add.graphics().setDepth(5000);
    this.crackLayer.y = ORIGIN_Y;
    this.badgeLayer = this.add.container(0, ORIGIN_Y).setDepth(6000);
    this.ghost = this.add.graphics().setDepth(4000);
    this.ghost.y = ORIGIN_Y;
    this.tweens.add({ targets: this.crackLayer, alpha: { from: 1, to: 0.55 }, duration: 900, yoyo: true, repeat: -1 });

    const cam = this.cameras.main;
    const narrow = this.scale.width < 700;
    cam.setZoom(narrow ? 0.65 : 1.1);
    // Leave room for the class card floating on the left.
    cam.centerOn(narrow ? 0 : -150 / cam.zoom, ORIGIN_Y + (MAP_SIZE * TILE_H) / 2 - 10);

    const w = Math.max(this.scale.width, 1600);
    this.rain = this.add.particles(0, -10, 'rain', {
      x: { min: -100, max: w + 200 },
      speedY: { min: 420, max: 560 },
      speedX: -90,
      lifespan: 1800,
      quantity: 3,
      frequency: 20,
      alpha: { start: 0.5, end: 0.15 },
      emitting: false,
    });
    this.snow = this.add.particles(0, -10, 'snow', {
      x: { min: -50, max: w + 50 },
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

  // ---------- textures ----------
  private makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xbfd8ef, 1).fillRect(0, 0, 2, 10);
    g.generateTexture('rain', 2, 10);
    g.clear().fillStyle(0xffffff, 1).fillCircle(2, 2, 2);
    g.generateTexture('snow', 4, 4);
    g.destroy();
  }

  /** Builds (once) the pixel-art texture of a practitioner. */
  private personTexture(spec: PersonSpec): string {
    const key = specKey(spec);
    if (this.textures.exists(key)) return key;
    const px = personGrid(spec);
    const tex = this.textures.createCanvas(key, px[0].length, px.length);
    if (!tex) return key;
    const ctx = tex.getContext();
    px.forEach((row, y) =>
      row.forEach((c, x) => {
        if (!c) return;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }),
    );
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return key;
  }

  private randomSpec(belt: Belt, kid: boolean, rnd: () => number, pose: PersonSpec['pose']): PersonSpec {
    const hairs: Hair[] = ['court', 'chignon', 'boucles', 'rase'];
    return {
      skin: SKINS[Math.floor(rnd() * SKINS.length)],
      hair: hairs[Math.floor(rnd() * hairs.length)],
      hairColor: HAIR_COLORS[Math.floor(rnd() * HAIR_COLORS.length)],
      gi: rnd() < 0.6 ? 'blanc' : 'noir',
      belt: BELT_HEX[belt],
      kid,
      beard: !kid && rnd() < 0.3,
      pose,
    };
  }

  // ---------- ground ----------
  private drawGround(month: number, force = false) {
    if (month === this.month && !force) return;
    this.month = month;
    const g = this.ground;
    g.clear();
    const seasonC = seasonGround(month);
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let y = 0; y < MAP_SIZE; y++) {
        const ring = x < 2 || y < 2 || x >= MAP_SIZE - 2 || y >= MAP_SIZE - 2;
        let base = ring ? seasonC : (x + y) % 2 ? C.floor : C.floor2;
        if (this.wet && !ring) base = shade(base, 0.85);
        this.fillTile(g, x, y, base, ORIGIN_Y);
        g.lineStyle(1, ring ? shade(seasonC, 0.85) : C.charcoal, 0.8);
        this.strokeTile(g, x, y, ORIGIN_Y);
        // wet floor sparkle
        if (this.wet && !ring && (x * 7 + y * 13) % 11 === 0) {
          const c = toScreen(x + 0.5, y + 0.5);
          g.fillStyle(0xdfe7ee, 0.35).fillEllipse(c.x, c.y + ORIGIN_Y, 14, 4);
        }
      }
    }
    const L = toScreen(0, MAP_SIZE);
    const B = toScreen(MAP_SIZE, MAP_SIZE);
    const R = toScreen(MAP_SIZE, 0);
    g.fillStyle(shade(seasonC, 0.6), 1).fillPoints([p(L, ORIGIN_Y), p(B, ORIGIN_Y), p(B, ORIGIN_Y + 14), p(L, ORIGIN_Y + 14)], true);
    g.fillStyle(shade(seasonC, 0.45), 1).fillPoints([p(B, ORIGIN_Y), p(R, ORIGIN_Y), p(R, ORIGIN_Y + 14), p(B, ORIGIN_Y + 14)], true);
  }

  private tilePoints(x: number, y: number, w = 1, h = 1, oy = 0, lift = 0): Pt[] {
    return [toScreen(x, y), toScreen(x + w, y), toScreen(x + w, y + h), toScreen(x, y + h)].map((q) => ({ x: q.x, y: q.y + oy - lift }));
  }
  private fillTile(g: G, x: number, y: number, color: number, oy = 0) {
    g.fillStyle(color, 1).fillPoints(this.tilePoints(x, y, 1, 1, oy), true);
  }
  private strokeTile(g: G, x: number, y: number, oy = 0) {
    g.strokePoints(this.tilePoints(x, y, 1, 1, oy), true);
  }

  /** Extruded box lit from the top-left. Returns its visible faces' corners for decoration. */
  private box(g: G, x: number, y: number, w: number, h: number, height: number, color: number, top?: number, base?: number) {
    const [A, B, Cc, D] = this.tilePoints(x, y, w, h);
    const up = (q: Pt, d = height) => ({ x: q.x, y: q.y - d });
    g.fillStyle(color, 1).fillPoints([D, Cc, up(Cc), up(D)], true);
    g.fillStyle(shade(color, 0.8), 1).fillPoints([Cc, B, up(B), up(Cc)], true);
    if (base !== undefined) {
      // dark wainscot band at the bottom of the walls
      g.fillStyle(base, 1).fillPoints([D, Cc, up(Cc, 8), up(D, 8)], true);
      g.fillStyle(shade(base, 0.8), 1).fillPoints([Cc, B, up(B, 8), up(Cc, 8)], true);
    }
    g.fillStyle(top ?? shade(color, 1.1), 1).fillPoints([up(A), up(B), up(Cc), up(D)], true);
    g.lineStyle(1, C.ink, 0.7).strokePoints([up(A), up(B), up(Cc), up(D)], true);
    g.lineBetween(Cc.x, Cc.y, up(Cc).x, up(Cc).y);
    return { A, B, Cc, D, up };
  }

  /** Point along the front-left face (D→C) at ratio t, raised by z. */
  private onLeft(f: { Cc: Pt; D: Pt }, t: number, z: number): Pt {
    return { x: f.D.x + (f.Cc.x - f.D.x) * t, y: f.D.y + (f.Cc.y - f.D.y) * t - z };
  }
  /** Point along the front-right face (C→B) at ratio t, raised by z. */
  private onRight(f: { Cc: Pt; B: Pt }, t: number, z: number): Pt {
    return { x: f.Cc.x + (f.B.x - f.Cc.x) * t, y: f.Cc.y + (f.B.y - f.Cc.y) * t - z };
  }
  /** Small parallelogram drawn flat on the front-left face. */
  private leftPanel(g: G, f: { Cc: Pt; D: Pt }, t0: number, t1: number, z0: number, z1: number, color: number, alpha = 1) {
    g.fillStyle(color, alpha).fillPoints([this.onLeft(f, t0, z0), this.onLeft(f, t1, z0), this.onLeft(f, t1, z1), this.onLeft(f, t0, z1)], true);
  }
  private rightPanel(g: G, f: { Cc: Pt; B: Pt }, t0: number, t1: number, z0: number, z1: number, color: number, alpha = 1) {
    g.fillStyle(color, alpha).fillPoints([this.onRight(f, t0, z0), this.onRight(f, t1, z0), this.onRight(f, t1, z1), this.onRight(f, t0, z1)], true);
  }

  private plant(g: G, at: Pt, size = 1) {
    g.fillStyle(C.pot, 1).fillRect(at.x - 6 * size, at.y - 9 * size, 12 * size, 9 * size);
    g.fillStyle(shade(C.pot, 0.8), 1).fillRect(at.x, at.y - 9 * size, 6 * size, 9 * size);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.42;
      const len = (12 + (i % 3) * 4) * size;
      g.fillStyle(i % 2 ? C.plant : C.plantDark, 1).fillEllipse(at.x + Math.cos(a) * len * 0.6, at.y - 10 * size + Math.sin(a) * len * 0.8, 6 * size, 11 * size);
    }
  }

  private bench(g: G, x: number, y: number, len: number, alongX: boolean) {
    const w = alongX ? len : 0.35;
    const h = alongX ? 0.35 : len;
    const [A, B, Cc, D] = this.tilePoints(x, y, w, h);
    const up = (q: Pt, d: number) => ({ x: q.x, y: q.y - d });
    g.fillStyle(C.ink, 1);
    for (const q of [A, B, Cc, D]) g.fillRect(q.x - 1, q.y - 8, 2, 8);
    g.fillStyle(C.wood, 1).fillPoints([up(A, 8), up(B, 8), up(Cc, 8), up(D, 8)], true);
    g.fillStyle(shade(C.wood, 0.7), 1).fillPoints([up(D, 8), up(Cc, 8), up(Cc, 6), up(D, 6)], true);
  }

  private logo(g: G, at: Pt, size: number, color: number) {
    // Three diagonal stripes, the club's mark (own design).
    for (let i = 0; i < 3; i++) {
      const x = at.x + i * size * 0.9;
      g.fillStyle(i === 2 ? shade(color, 1.6) : color, 1).fillPoints(
        [
          { x, y: at.y },
          { x: x + size * 0.5, y: at.y },
          { x: x + size * 0.1, y: at.y + size * 1.2 },
          { x: x - size * 0.4, y: at.y + size * 1.2 },
        ],
        true,
      );
    }
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
        case 'dojo':
          this.drawDojo(g, b);
          g.setDepth(-5);
          this.buildingLayer.add(g);
          continue;
        case 'tatami': {
          const pts = this.tilePoints(b.x, b.y, 1, 1, 0, 2);
          g.fillStyle(C.mat, 1).fillPoints(pts, true);
          g.lineStyle(1, C.matLine, 1).strokePoints(pts, true);
          break;
        }
        case 'vestiaire': {
          const f = this.box(g, b.x, b.y, s.w, s.h, 40, C.wallLight, C.roof, C.wallDark);
          // wooden door + pictogram on the left face, lockers on the right face
          this.leftPanel(g, f, 0.18, 0.42, 8, 32, shade(C.wood, 0.9));
          this.leftPanel(g, f, 0.6, 0.86, 20, 30, C.ink);
          const m = this.onLeft(f, 0.73, 25);
          g.fillStyle(C.wallLight, 1).fillCircle(m.x - 3, m.y - 2, 1.5).fillCircle(m.x + 3, m.y - 4, 1.5);
          g.fillRect(m.x - 4, m.y, 2, 4).fillRect(m.x + 2, m.y - 2, 2, 4);
          for (let i = 0; i < 4; i++) {
            this.rightPanel(g, f, 0.1 + i * 0.21, 0.27 + i * 0.21, 9, 34, C.wallMid);
            this.rightPanel(g, f, 0.14 + i * 0.21, 0.2 + i * 0.21, 28, 30, C.wallDark);
          }
          break;
        }
        case 'accueil': {
          const f = this.box(g, b.x + 0.15, b.y + 0.25, s.w - 0.3, s.h - 0.5, 18, C.wood, C.wallLight);
          this.leftPanel(g, f, 0.1, 0.9, 4, 6, shade(C.wood, 0.7));
          // monitor on the counter
          const top = { x: (f.A.x + f.Cc.x) / 2, y: (f.A.y + f.Cc.y) / 2 - 18 };
          g.fillStyle(C.ink, 1).fillRect(top.x - 7, top.y - 12, 12, 9);
          g.fillStyle(0x5a7fa8, 1).fillRect(top.x - 6, top.y - 11, 10, 7);
          g.fillStyle(C.ink, 1).fillRect(top.x - 2, top.y - 3, 2, 3);
          this.plant(g, this.onLeft(f, 0.06, 18), 0.6);
          // receptionist standing behind the counter
          const rnd = mulberry(hash(b.id));
          const who = this.add.image(top.x + 12, top.y - 6, this.personTexture({ ...this.randomSpec('noire', false, rnd, 'debout'), gi: 'tshirt' })).setOrigin(0.5, 1);
          who.setDepth(order(b) - 1);
          this.buildingLayer.add(who);
          break;
        }
        case 'boutique': {
          const f = this.box(g, b.x, b.y, s.w, s.h, 40, C.wallLight, C.roof, C.wallDark);
          // shelves with folded gis, white and black
          for (let r = 0; r < 3; r++) {
            this.leftPanel(g, f, 0.1, 0.55, 10 + r * 9, 11 + r * 9, shade(C.wood, 0.85));
            for (let k = 0; k < 4; k++) this.leftPanel(g, f, 0.12 + k * 0.1, 0.2 + k * 0.1, 11 + r * 9, 16 + r * 9, (k + r) % 2 ? C.ink : 0xf6f6f4);
          }
          // hanging gi
          this.leftPanel(g, f, 0.66, 0.8, 12, 30, 0xf6f6f4);
          this.leftPanel(g, f, 0.82, 0.94, 12, 30, C.ink);
          this.leftPanel(g, f, 0.62, 0.98, 30, 31, C.wallDark);
          // sign band
          this.rightPanel(g, f, 0.12, 0.88, 26, 36, C.ink);
          const sign = this.onRight(f, 0.5, 31);
          this.buildingLayer.add(
            this.add
              .text(sign.x, sign.y, 'BOUTIQUE', { fontFamily: '"Barlow Condensed", Arial Narrow, sans-serif', fontSize: '9px', color: '#F4F4F2', fontStyle: '700' })
              .setOrigin(0.5)
              .setRotation(-0.46)
              .setDepth(order(b) + 1),
          );
          break;
        }
        case 'parking': {
          const pts = this.tilePoints(b.x, b.y, s.w, s.h, 0, 1);
          g.fillStyle(0x2a2c30, 1).fillPoints(pts, true);
          g.lineStyle(2, 0xdedad0, 0.7);
          for (let i = 0.5; i < s.w; i += 0.5) {
            const a = toScreen(b.x + i, b.y + 0.15);
            const c = toScreen(b.x + i, b.y + 0.9);
            g.lineBetween(a.x, a.y - 1, c.x, c.y - 1);
          }
          this.box(g, b.x + 0.6, b.y + 1.15, 0.45, 0.7, 9, 0xd8d8d6, 0x2b2d31);
          break;
        }
      }
      g.setDepth(order(b));
      this.buildingLayer.add(g);
    }
    this.buildingLayer.sort('depth');
    this.drawCracks();
  }

  private drawDojo(g: G, b: Building) {
    const s = BUILDING_SPECS.dojo;
    const pts = this.tilePoints(b.x, b.y, s.w, s.h);
    const [A, Bp, Cc, D] = pts;
    // raised concrete platform with a dark border, mats lie on top
    g.fillStyle(shade(C.wallMid, 0.75), 1).fillPoints([D, Cc, { x: Cc.x, y: Cc.y + 6 }, { x: D.x, y: D.y + 6 }], true);
    g.fillStyle(shade(C.wallMid, 0.6), 1).fillPoints([Cc, Bp, { x: Bp.x, y: Bp.y + 6 }, { x: Cc.x, y: Cc.y + 6 }], true);
    g.fillStyle(C.matBorder, 1).fillPoints(pts, true);
    g.lineStyle(1, C.ink, 0.6).strokePoints(pts, true);
    // two back walls: light upper part, dark lower band, club mark
    const wallH = 54;
    const upP = (q: Pt, d: number) => ({ x: q.x, y: q.y - d });
    g.fillStyle(C.wallLight, 1).fillPoints([A, D, upP(D, wallH), upP(A, wallH)], true);
    g.fillStyle(shade(C.wallLight, 0.88), 1).fillPoints([A, Bp, upP(Bp, wallH), upP(A, wallH)], true);
    g.fillStyle(C.wallDark, 1).fillPoints([A, D, upP(D, 12), upP(A, 12)], true);
    g.fillStyle(shade(C.wallDark, 0.85), 1).fillPoints([A, Bp, upP(Bp, 12), upP(A, 12)], true);
    g.lineStyle(1, C.ink, 0.6).strokePoints([upP(D, wallH), upP(A, wallH), upP(Bp, wallH)], false);
    const midL = { x: (A.x + D.x) / 2, y: (A.y + D.y) / 2 };
    const midR = { x: (A.x + Bp.x) / 2, y: (A.y + Bp.y) / 2 };
    this.logo(g, { x: midR.x - 14, y: midR.y - 42 }, 12, C.ink);
    // timetable board on the left wall
    g.fillStyle(C.ink, 1).fillPoints([{ x: midL.x - 20, y: midL.y - 10 - 36 }, { x: midL.x + 20, y: midL.y + 10 - 36 }, { x: midL.x + 20, y: midL.y + 10 - 20 }, { x: midL.x - 20, y: midL.y - 10 - 20 }], true);
    g.lineStyle(1, C.gold, 0.9);
    for (let i = 0; i < 3; i++) g.lineBetween(midL.x - 15, midL.y - 7 - 32 + i * 4, midL.x + 15, midL.y + 7 - 32 + i * 4);
    // hanging lamp
    const lamp = { x: A.x, y: A.y + 40 };
    g.lineStyle(1, C.ink, 1).lineBetween(lamp.x, A.y - wallH, lamp.x, lamp.y - 50);
    g.fillStyle(C.ink, 1).fillTriangle(lamp.x - 9, lamp.y - 44, lamp.x + 9, lamp.y - 44, lamp.x, lamp.y - 52);
    g.fillStyle(0xfff1c4, 0.1).fillTriangle(lamp.x - 40, lamp.y + 20, lamp.x + 40, lamp.y + 20, lamp.x, lamp.y - 44);
    // plants in the two back corners
    this.plant(g, { x: D.x + 18, y: D.y - 6 }, 0.9);
    this.plant(g, { x: Bp.x - 18, y: Bp.y - 6 }, 0.9);
    // low shoe wall along the front-left edge, sneakers lined up
    const shoe = this.add.graphics().setDepth(order({ ...b, type: 'vestiaire' }) + 400);
    const f = { D: { x: D.x, y: D.y }, Cc: { x: Cc.x, y: Cc.y } };
    const up = (q: Pt, d: number) => ({ x: q.x, y: q.y - d });
    const a0 = this.onLeft(f, 0.08, 0);
    const a1 = this.onLeft(f, 0.55, 0);
    shoe.fillStyle(C.wallMid, 1).fillPoints([a0, a1, up(a1, 12), up(a0, 12)], true);
    shoe.fillStyle(C.wallLight, 1).fillPoints([up(a0, 12), up(a1, 12), { x: up(a1, 12).x + 6, y: up(a1, 12).y - 3 }, { x: up(a0, 12).x + 6, y: up(a0, 12).y - 3 }], true);
    for (let i = 0; i < 9; i++) {
      const q = this.onLeft(f, 0.1 + i * 0.05, 4);
      shoe.fillStyle(i % 3 ? 0xf4f4f2 : C.ink, 1).fillRect(q.x - 3, q.y - 2, 5, 3);
    }
    this.buildingLayer.add(shoe);
    // benches beside the room
    const bench = this.add.graphics().setDepth(order({ ...b, type: 'vestiaire' }) + 300);
    this.bench(bench, b.x + s.w + 0.3, b.y + 1.5, 2.2, false);
    this.buildingLayer.add(bench);
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
      const lift = b.type === 'vestiaire' || b.type === 'boutique' ? 40 : b.type === 'accueil' ? 18 : 4;
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
        g.lineStyle(6, C.gold, 0.25).strokePoints(pts, false);
        g.lineStyle(2, C.gold, 1).strokePoints(pts, false);
        g.lineStyle(1, 0xfff3c8, 0.9).strokePoints(pts.slice(0, 3), false);
      }
      const key = `${Math.round(center.x / 60)},${Math.round(center.y / 60)}`;
      const k = stack.get(key) ?? 0;
      stack.set(key, k + 1);
      const by = center.y - lift - 34 - k * 26;
      const color = a.level === 'crise' ? C.crisis : C.warn;
      const label = this.add
        .text(center.x, by, `${a.level === 'crise' ? '⬣' : '▲'} ${a.text}`, {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '12px',
          color: '#141414',
          backgroundColor: '#FFFFFF',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5, 1);
      const bar = this.add.rectangle(center.x - label.width / 2, by, 4, label.height, color).setOrigin(0, 1);
      this.badgeLayer.add([label, bar]);
    }
  }

  // ---------- people & weather ----------
  /** Shows the attendance of the day on the mats, with belts in the real proportions. */
  setPeople(count: number, belts: { belt: Belt; kid: boolean }[]) {
    this.whenReady(() => {
      const mats = this.buildings.filter((b) => b.type === 'tatami');
      const target = mats.length ? Math.min(60, Math.round(count)) : 0;
      while (this.people.length > target) this.people.pop()!.img.destroy();
      while (this.people.length < target && belts.length) {
        const rnd = mulberry(++this.seq * 9973);
        const first = this.people.length === 0;
        const who = first ? { belt: 'noire' as Belt, kid: false } : belts[Math.floor(rnd() * belts.length)];
        const seated = !first && rnd() < 0.35;
        const spec = this.randomSpec(who.belt, who.kid, rnd, seated ? 'assis' : 'debout');
        if (first) spec.gi = 'noir';
        const img = this.add.image(0, 0, this.personTexture(spec)).setOrigin(0.5, 1);
        const person = { img, seated };
        this.placeOnMat(person, mats, false);
        this.people.push(person);
      }
    });
  }

  private placeOnMat(p: Person, mats: Building[], animate: boolean) {
    if (!mats.length) return;
    const t = mats[Math.floor(Math.random() * mats.length)];
    const fx = t.x + 0.2 + Math.random() * 0.6;
    const fy = t.y + 0.2 + Math.random() * 0.6;
    const s = toScreen(fx, fy);
    const depth = (fx + fy) * 10 + 2;
    if (!animate) {
      p.img.setPosition(s.x, s.y + ORIGIN_Y - 2).setDepth(depth);
    } else {
      p.img.setFlipX(s.x < p.img.x);
      this.tweens.add({ targets: p.img, x: s.x, y: s.y + ORIGIN_Y - 2, duration: 900 + Math.random() * 900, ease: 'Sine.easeInOut', onComplete: () => p.img.setDepth(depth) });
    }
  }

  setWeather(w: Weatherish, month: number) {
    this.whenReady(() => {
      const cold = w.tempMaxC < 2;
      const rainy = w.precipMm > 2;
      const wetChanged = rainy !== this.wet;
      this.wet = rainy;
      this.drawGround(month, wetChanged);
      this.rain.emitting = rainy && !cold;
      this.snow.emitting = rainy && cold;
      this.heat.fillAlpha = w.tempMaxC >= 28 ? Math.min(0.22, (w.tempMaxC - 26) * 0.03) : 0;
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
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.4, 3));
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
    if (!this.people.length) return;
    const mats = this.buildings.filter((b) => b.type === 'tatami');
    const chance = dt / 2500;
    for (const person of this.people) if (!person.seated && Math.random() < chance) this.placeOnMat(person, mats, true);
  }
}

function p(q: Pt, oy: number): Pt {
  return { x: q.x, y: q.y + oy };
}

function order(b: Pick<Building, 'type' | 'x' | 'y'>): number {
  const s = BUILDING_SPECS[b.type];
  if (b.type === 'dojo') return -5;
  if (b.type === 'tatami' || b.type === 'parking') return (b.x + b.y) * 10 - 4;
  return (b.x + s.w - 1 + b.y + s.h - 1) * 10 + 5;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
