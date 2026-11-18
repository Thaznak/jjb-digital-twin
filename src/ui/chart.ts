/** Tiny canvas line chart, no dependency. Colors are passed explicitly from the DA palette. */
export interface Series {
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

export function lineChart(canvas: HTMLCanvasElement, labels: string[], series: Series[], format: (n: number) => string, opts: { zeroLine?: boolean } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 360;
  const h = canvas.clientHeight || 170;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const pad = { l: 58, r: 10, t: 10, b: 22 };
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  if (!all.length) return;
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (opts.zeroLine) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (max === min) max = min + 1;
  const span = max - min;
  min -= span * 0.08;
  max += span * 0.08;
  const n = Math.max(...series.map((s) => s.values.length));
  const X = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (w - pad.l - pad.r));
  const Y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);

  ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = '#5b5d62';
  ctx.strokeStyle = '#e4e4e1';
  ctx.lineWidth = 1;
  for (let k = 0; k <= 3; k++) {
    const v = min + ((max - min) * k) / 3;
    const y = Y(v);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(format(v), pad.l - 6, y + 4);
  }
  if (opts.zeroLine && min < 0) {
    ctx.strokeStyle = '#d4513f';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.l, Y(0));
    ctx.lineTo(w - pad.r, Y(0));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5b5d62';
  const step = Math.max(1, Math.ceil(labels.length / 6));
  labels.forEach((l, i) => {
    if (i % step === 0 || i === labels.length - 1) ctx.fillText(l, X(i), h - 6);
  });
  for (const s of series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.setLineDash(s.dashed ? [5, 4] : []);
    ctx.beginPath();
    s.values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.stroke();
    ctx.setLineDash([]);
    const last = s.values.length - 1;
    if (last >= 0) {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(X(last), Y(s.values[last]), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function legend(series: Pick<Series, 'label' | 'color' | 'dashed'>[]): string {
  return `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}${s.dashed ? ';opacity:.6' : ''}"></i>${s.label}</span>`).join('')}</div>`;
}
