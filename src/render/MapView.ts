import type { Point, Poi, Stage } from '../engine';
import { art, FRAMES, project, type Level, type ViewBox } from './mapArt';
import { iconPaths } from '../ui/icons';

/**
 * Pan / pinch / wheel zoom over the vector art of a level, plus an overlay
 * (labels, people, route, position) whose size stays constant on screen.
 * Display only: it receives ready-made data through setOverlay and reports taps through hooks.
 */

export interface StageMark {
  stage: Stage;
  selected: boolean;
  now: string | null;
}

export interface PersonMark {
  id: string;
  initials: string;
  color: string;
  at: Point;
  stageId: string | null;
  walking: boolean;
  active: boolean;
}

export interface Overlay {
  stages: StageMark[];
  showStageLabels: boolean;
  pois: { poi: Poi; selected: boolean }[];
  people: PersonMark[];
  groups: { stageId: string; count: number }[];
  route: Point[] | null;
  me: Point | null;
  meLabel: string;
}

export interface MapHooks {
  onStage: (id: string) => void;
  onPoi: (id: string) => void;
  onTapGround: (p: Point) => void;
  onLevel: (l: Level) => void;
}

const NS = 'http://www.w3.org/2000/svg';
const ORDER: Level[] = ['site', 'abords', 'clisson'];

const POI_STYLE: Record<string, { fill: string; icon: string }> = {
  eau: { fill: '#5FB3D9', icon: 'eau' },
  wc: { fill: '#EFE6D2', icon: 'wc' },
  secours: { fill: '#D4513F', icon: 'secours' },
  bar: { fill: '#F2C14E', icon: 'bar' },
  info: { fill: '#EFE6D2', icon: 'info' },
};

export class MapView {
  readonly el: HTMLDivElement;
  private svg: SVGSVGElement;
  private artG: SVGGElement;
  private routeG: SVGGElement;
  private marks: SVGGElement;
  private level: Level = 'site';
  private base!: ViewBox;
  private vb!: ViewBox;
  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: { moved: boolean; pinch: number | null; start: { x: number; y: number } } | null = null;
  private overlay: Overlay | null = null;
  private scaled: SVGGElement[] = [];
  /** While true, taps choose a starting point instead of selecting a stage. */
  picking = false;
  private sized = false;

  constructor(parent: HTMLElement, private hooks: MapHooks) {
    this.el = document.createElement('div');
    this.el.className = 'mapview';
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', 'Carte du site');
    this.artG = document.createElementNS(NS, 'g');
    this.routeG = document.createElementNS(NS, 'g');
    this.marks = document.createElementNS(NS, 'g');
    this.svg.append(this.artG, this.routeG, this.marks);
    this.el.append(this.svg);
    parent.append(this.el);
    this.bind();
    this.setLevel('site');
    new ResizeObserver(() => {
      if (!this.sized && this.el.clientWidth > 0) {
        this.sized = true;
        this.reset();
      } else this.fitAspect();
    }).observe(this.el);
  }

  get currentLevel() {
    return this.level;
  }

  setLevel(l: Level, keepView = false) {
    const changed = l !== this.level || !this.base;
    this.level = l;
    const a = art(l);
    if (changed) this.artG.innerHTML = a.body;
    this.base = a.viewBox;
    if (!keepView || changed) this.reset();
    this.draw();
  }

  /** Default framing: the whole festival width, the heart of the site above the bottom sheet. */
  reset() {
    if (this.level === 'site') {
      this.fit([{ u: 10, v: 9 }, { u: 38, v: 9 }, { u: 10, v: 24 }, { u: 38, v: 24 }], 1.0);
      return;
    }
    const r = this.aspect();
    const b = this.base;
    // Fill the height so roads stay readable; the sides can be panned.
    let h = b.h * 1.15;
    let w = h * r;
    if (w > b.w) {
      w = b.w;
      h = w / r;
    }
    this.vb = { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h * 0.45, w, h };
    this.apply();
  }

  private aspect() {
    return this.el.clientWidth / Math.max(1, this.el.clientHeight) || 0.5;
  }

  /** "Tout le site": the whole level in view. */
  showAll() {
    const r = this.aspect();
    const b = this.base;
    let w = b.w;
    let h = w / r;
    if (h < b.h) {
      h = b.h;
      w = h * r;
    }
    this.vb = { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
    this.apply();
  }

  /** Centres a plan point in the visible band between the top bar and the bottom sheet. */
  focus(p: Point, zoomIn = false) {
    if (this.level !== 'site') this.setLevel('site');
    const c = project(FRAMES.site, p);
    if (zoomIn) {
      // About 22 plan units across: the stage and its surroundings.
      const r = this.vb.w / this.vb.h;
      this.vb.w = Math.min(this.vb.w, FRAMES.site.k * 22);
      this.vb.h = this.vb.w / r;
    }
    this.vb.x = c.x - this.vb.w / 2;
    this.vb.y = c.y - this.vb.h * 0.42;
    this.apply();
  }

  /**
   * Frames plan points so they fill the visible band: below the top bar (about 20 %)
   * and above the bottom sheet (about 30 %).
   */
  fit(points: Point[], margin = 1.25) {
    if (!points.length) return;
    if (this.level !== 'site') this.setLevel('site');
    const ps = points.map((p) => project(FRAMES.site, p));
    const x0 = Math.min(...ps.map((p) => p.x));
    const x1 = Math.max(...ps.map((p) => p.x));
    const y0 = Math.min(...ps.map((p) => p.y));
    const y1 = Math.max(...ps.map((p) => p.y));
    const r = this.aspect();
    const band = 0.5;
    let w = Math.max(300, (x1 - x0) * margin);
    let h = Math.max(300 / band, ((y1 - y0) * margin) / band);
    if (w / h > r) h = w / r;
    else w = h * r;
    this.vb = { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h * 0.45, w, h };
    this.apply();
  }

  zoomBy(f: number) {
    const cx = this.vb.x + this.vb.w / 2;
    const cy = this.vb.y + this.vb.h / 2;
    this.zoomAround(cx, cy, f);
  }

  setOverlay(o: Overlay) {
    this.overlay = o;
    this.draw();
  }

  // ---------- view box ----------
  private fitAspect() {
    if (!this.vb) return;
    const r = this.el.clientWidth / Math.max(1, this.el.clientHeight);
    if (!r) return;
    const cx = this.vb.x + this.vb.w / 2;
    const cy = this.vb.y + this.vb.h / 2;
    this.vb.w = this.vb.h * r;
    this.vb.x = cx - this.vb.w / 2;
    this.vb.y = cy - this.vb.h / 2;
    this.apply();
  }

  private unitsPerPx() {
    return this.vb.w / Math.max(1, this.el.clientWidth);
  }

  private apply() {
    const b = this.base;
    // Keep part of the art in view.
    this.vb.x = Math.min(Math.max(this.vb.x, b.x - this.vb.w * 0.5), b.x + b.w - this.vb.w * 0.5);
    this.vb.y = Math.min(Math.max(this.vb.y, b.y - this.vb.h * 0.5), b.y + b.h - this.vb.h * 0.5);
    this.svg.setAttribute('viewBox', `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`);
    const s = this.unitsPerPx();
    for (const g of this.scaled) {
      const x = Number(g.dataset.x);
      const y = Number(g.dataset.y);
      g.setAttribute('transform', `translate(${x} ${y}) scale(${s})`);
    }
    this.routeG.style.setProperty('--u', String(s));
    this.routeG.querySelectorAll('polyline').forEach((pl) => pl.setAttribute('stroke-width', String(Number(pl.dataset.w) * s)));
  }

  private zoomAround(x: number, y: number, f: number) {
    const minH = this.base.h * 0.18;
    const maxH = this.base.h * 1.25;
    const nh = this.vb.h / f;
    const i = ORDER.indexOf(this.level);
    if (nh > maxH && i < ORDER.length - 1) {
      this.hooks.onLevel(ORDER[i + 1]);
      return;
    }
    if (nh < minH * 1.4 && i > 0 && this.level !== 'site') {
      this.hooks.onLevel(ORDER[i - 1]);
      return;
    }
    const h = Math.min(maxH, Math.max(minH, nh));
    const k = h / this.vb.h;
    this.vb = { x: x - (x - this.vb.x) * k, y: y - (y - this.vb.y) * k, w: this.vb.w * k, h };
    this.apply();
  }

  private toSvg(clientX: number, clientY: number) {
    const r = this.svg.getBoundingClientRect();
    return { x: this.vb.x + ((clientX - r.left) / r.width) * this.vb.w, y: this.vb.y + ((clientY - r.top) / r.height) * this.vb.h };
  }

  /** Inverse of the projection, for taps on the ground. */
  private toPlan(x: number, y: number): Point {
    const f = FRAMES.site;
    const v = (y - f.oy) / (f.k * 0.55);
    const u = (x - f.ox - (40 - v) * f.k * 0.25) / f.k;
    return { u, v };
  }

  private bind() {
    const s = this.svg;
    s.addEventListener('pointerdown', (e) => {
      s.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) this.gesture = { moved: false, pinch: null, start: { x: e.clientX, y: e.clientY } };
      else if (this.gesture) this.gesture.moved = true;
    });
    s.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev || !this.gesture) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...this.pointers.values()];
      if (pts.length >= 2) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this.gesture.pinch) {
          const mid = this.toSvg((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
          this.zoomAround(mid.x, mid.y, d / this.gesture.pinch);
        }
        this.gesture.pinch = d;
        return;
      }
      const u = this.unitsPerPx();
      if (Math.hypot(e.clientX - this.gesture.start.x, e.clientY - this.gesture.start.y) > 6) this.gesture.moved = true;
      this.vb.x -= (e.clientX - prev.x) * u;
      this.vb.y -= (e.clientY - prev.y) * u;
      this.apply();
    });
    const end = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size) {
        if (this.gesture) this.gesture.pinch = null;
        return;
      }
      const g = this.gesture;
      this.gesture = null;
      if (!g || g.moved || e.type === 'pointercancel') return;
      this.tap(e);
    };
    s.addEventListener('pointerup', end);
    s.addEventListener('pointercancel', end);
    s.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const p = this.toSvg(e.clientX, e.clientY);
        this.zoomAround(p.x, p.y, e.deltaY > 0 ? 0.88 : 1.14);
      },
      { passive: false },
    );
    s.addEventListener('dblclick', (e) => {
      const p = this.toSvg(e.clientX, e.clientY);
      this.zoomAround(p.x, p.y, 1.6);
    });
  }

  private tap(e: PointerEvent) {
    const target = (e.target as Element).closest('[data-hit]') as SVGElement | null;
    if (target && !this.picking) {
      const [kind, id] = target.dataset.hit!.split(':');
      if (kind === 'stage') this.hooks.onStage(id);
      if (kind === 'poi') this.hooks.onPoi(id);
      return;
    }
    if (this.level !== 'site') return;
    const p = this.toSvg(e.clientX, e.clientY);
    // A tap close to a stage building selects it.
    const near = Object.entries(art('site').anchors)
      .map(([id, a]) => ({ id, d: Math.hypot(a.x - p.x, a.y + 40 - p.y) }))
      .sort((a, b) => a.d - b.d)[0];
    if (!this.picking && near && near.d < 70 && this.overlay?.stages.some((m) => m.stage.id === near.id)) {
      this.hooks.onStage(near.id);
      return;
    }
    this.hooks.onTapGround(this.toPlan(p.x, p.y));
  }

  // ---------- overlay ----------
  private el2(tag: string, attrs: Record<string, string | number>, parent?: Element) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    parent?.append(n);
    return n;
  }

  /** A group positioned in SVG units whose content is drawn in screen pixels. */
  private pinGroup(x: number, y: number, hit?: string) {
    const g = this.el2('g', { class: 'mk' }, this.marks) as SVGGElement;
    g.dataset.x = String(x);
    g.dataset.y = String(y);
    if (hit) g.dataset.hit = hit;
    this.scaled.push(g);
    return g;
  }

  private pill(g: Element, text: string, opts: { fill: string; stroke: string; color: string; dashed?: boolean; dy?: number; size?: number; weight?: number; font?: string }) {
    const size = opts.size ?? 13;
    const w = text.length * size * 0.56 + 18;
    const h = size + 12;
    const dy = opts.dy ?? 0;
    this.el2('rect', { x: -w / 2, y: dy - h, width: w, height: h, rx: 6, fill: opts.fill, stroke: opts.stroke, 'stroke-width': 1.6, ...(opts.dashed ? { 'stroke-dasharray': '4 3' } : {}) }, g);
    const t = this.el2('text', { x: 0, y: dy - h / 2 + size * 0.36, 'text-anchor': 'middle', fill: opts.color, 'font-size': size, 'font-weight': opts.weight ?? 700, 'font-family': opts.font ?? 'Barlow Condensed, Arial Narrow, sans-serif' }, g);
    t.textContent = text;
    return h;
  }

  private draw() {
    this.marks.innerHTML = '';
    this.routeG.innerHTML = '';
    this.scaled = [];
    const o = this.overlay;
    if (!o) return;
    if (this.level !== 'site') {
      for (const l of art(this.level).labels) {
        const g = this.pinGroup(l.x, l.y);
        if (l.kind === 'hint') this.pill(g, l.text, { fill: '#0B0B0Ccc', stroke: 'none', color: '#EFE6D2', size: 12, weight: 500, font: 'Inter, sans-serif', dy: 12 });
        else this.pill(g, l.text, { fill: '#EFE6D2', stroke: '#0B0B0C', color: '#0B0B0C', size: l.kind === 'strong' ? 16 : 13, dy: 12 });
      }
      this.apply();
      return;
    }
    const f = FRAMES.site;
    const anchors = art('site').anchors;

    // Route: white casing then blue line, widths in screen pixels.
    if (o.route && o.route.length > 1) {
      const pts = o.route.map((p) => project(f, p)).map((p) => `${p.x},${p.y}`).join(' ');
      for (const [w, c] of [[11, '#FFFFFF'], [6, '#2278EC']] as [number, string][]) {
        const pl = this.el2('polyline', { points: pts, fill: 'none', stroke: c, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.routeG) as SVGPolylineElement;
        pl.dataset.w = String(w);
      }
      const end = project(f, o.route[o.route.length - 1]);
      const g = this.pinGroup(end.x, end.y);
      this.el2('circle', { r: 9, fill: '#F08A24', stroke: '#0B0B0C', 'stroke-width': 2 }, g);
    }

    // POIs.
    for (const { poi, selected } of o.pois) {
      const p = project(f, poi);
      const st = POI_STYLE[poi.kind];
      const g = this.pinGroup(p.x, p.y, `poi:${poi.id}`);
      this.el2('circle', { r: selected ? 19 : 16, cy: -20, fill: st.fill, stroke: '#0B0B0C', 'stroke-width': selected ? 3 : 1.6 }, g);
      const ic = this.el2('g', { transform: 'translate(-9 -29) scale(.75)', fill: 'none', stroke: poi.kind === 'secours' ? '#FFFFFF' : '#0B0B0C', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      ic.innerHTML = iconPaths(st.icon);
      this.el2('path', { d: 'M-5 -6 L0 0 L5 -6', fill: st.fill, stroke: '#0B0B0C', 'stroke-width': 1.4 }, g);
    }

    // Stage labels with what is playing now.
    if (o.showStageLabels) {
      for (const m of o.stages) {
        const a = anchors[m.stage.id];
        if (!a) continue;
        const g = this.pinGroup(a.x, a.y, `stage:${m.stage.id}`);
        const name = m.stage.provisional ? `${m.stage.name.toUpperCase()} · 2027` : m.stage.name.toUpperCase();
        const h = this.pill(g, name, { fill: m.selected ? '#F08A24' : '#EFE6D2', stroke: m.stage.provisional ? '#F08A24' : '#0B0B0C', color: '#0B0B0C', dashed: m.stage.provisional, size: 15 });
        if (m.now && m.selected) this.pill(g, `♪ ${m.now}`, { fill: '#0B0B0Cdd', stroke: 'none', color: '#FFD69A', size: 11, weight: 600, font: 'Inter, sans-serif', dy: -h - 4 });
      }
    }

    // People: spread around their stage, groups get a bubble.
    const byStage = new Map<string, PersonMark[]>();
    for (const p of o.people) if (p.stageId) byStage.set(p.stageId, [...(byStage.get(p.stageId) ?? []), p]);
    for (const p of o.people) {
      let c = project(f, p.at);
      if (p.stageId) {
        const list = byStage.get(p.stageId)!;
        const i = list.indexOf(p);
        const n = list.length;
        const base = project(f, { u: p.at.u, v: p.at.v + 1.4 });
        const off = n > 1 ? (i - (n - 1) / 2) * 24 : 0;
        c = { x: base.x, y: base.y };
        const g = this.pinGroup(c.x, c.y);
        this.person(g, p, off);
        continue;
      }
      const g = this.pinGroup(c.x, c.y);
      this.person(g, p, 0);
    }
    for (const gr of o.groups) {
      if (gr.count < 2) continue;
      const st = o.stages.find((m) => m.stage.id === gr.stageId)?.stage;
      if (!st) continue;
      const c = project(f, { u: st.u, v: st.v + 1.4 });
      const g = this.pinGroup(c.x, c.y);
      this.pill(g, `${gr.count} ensemble`, { fill: '#EFE6D2', stroke: '#0B0B0C', color: '#0B0B0C', size: 13, weight: 700, font: 'Inter, sans-serif', dy: 38 });
    }

    // Me.
    if (o.me) {
      const c = project(f, o.me);
      const g = this.pinGroup(c.x, c.y);
      this.el2('circle', { r: 30, fill: '#2278EC', opacity: 0.18 }, g);
      this.el2('circle', { r: 9, fill: '#2278EC', stroke: '#FFFFFF', 'stroke-width': 3 }, g);
      g.setAttribute('class', 'mk me');
      const lg = this.el2('g', { transform: 'translate(46 12)' }, g);
      this.pill(lg, o.meLabel, { fill: '#EFE6D2', stroke: '#0B0B0C', color: '#0B0B0C', size: 13, weight: 700, font: 'Inter, sans-serif' });
    }
    this.apply();
  }

  private person(g: Element, p: PersonMark, dx: number) {
    const pg = this.el2('g', { transform: `translate(${dx} 0)`, opacity: p.walking ? 0.9 : 1 }, g);
    if (p.walking) this.el2('circle', { r: 17, cy: -6, fill: 'none', stroke: p.color, 'stroke-width': 2, 'stroke-dasharray': '3 3' }, pg);
    this.el2('circle', { r: 13, cy: -6, fill: p.color, stroke: p.active ? '#FFFFFF' : '#0B0B0C', 'stroke-width': p.active ? 3 : 2 }, pg);
    const t = this.el2('text', { y: -2, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#0B0B0C', 'font-family': 'Inter, sans-serif' }, pg);
    t.textContent = p.initials;
  }
}
