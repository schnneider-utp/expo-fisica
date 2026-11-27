/* ============================================================
   SIMULADOR DE TORQUE · Física + animaciones
   ============================================================ */
"use strict";

const TAU = Math.PI * 2;
const C = {
  cyan: "#22d3ee",
  amber: "#fbbf24",
  magenta: "#f472b6",
  green: "#34d399",
  text: "#e6edf7",
  muted: "#93a4bd",
  line: "rgba(148,163,184,0.18)",
  white: "#e2e8f0",
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Helpers de dibujo ---------- */
function setupCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.width;
  const h = (rect.width || canvas.width) * (canvas.height / canvas.width);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function drawGrid(ctx, w, h, step = 26) {
  ctx.save();
  ctx.strokeStyle = "rgba(148,163,184,0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y <= h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.restore();
}

function drawArrow(ctx, x1, y1, x2, y2, color, width = 3, head = 11) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 4) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(ang - 0.42), y2 - head * Math.sin(ang - 0.42));
  ctx.lineTo(x2 - head * Math.cos(ang + 0.42), y2 - head * Math.sin(ang + 0.42));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawArcArrow(ctx, cx, cy, r, a0, a1, color, width = 3) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a1, a1 < a0);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // punta al final del arco
  const tip = a1;
  const tx = cx + Math.cos(tip) * r;
  const ty = cy + Math.sin(tip) * r;
  const dir = a1 > a0 ? 1 : -1;
  const tang = tip + (Math.PI / 2) * dir;
  const hs = 10;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - hs * Math.cos(tang - 0.4), ty - hs * Math.sin(tang - 0.4));
  ctx.lineTo(tx - hs * Math.cos(tang + 0.4), ty - hs * Math.sin(tang + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHinge(ctx, x, y, r = 9) {
  ctx.save();
  ctx.fillStyle = "#0a0e17";
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.white;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function label(ctx, text, x, y, color = C.muted, size = 13, align = "left", bold = false) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${bold ? 600 : 500} ${size}px "IBM Plex Mono", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawDoorPanel(ctx, hx, hy, angle, len, thick, opts = {}) {
  const { fill = "rgba(34,211,238,0.10)", stroke = C.cyan, handle = true } = opts;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(angle);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.shadowColor = stroke;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.rect(0, -thick / 2, len, thick);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  // líneas de veta
  ctx.strokeStyle = "rgba(226,232,240,0.14)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const x = (len * i) / 4;
    ctx.beginPath();
    ctx.moveTo(x, -thick / 2 + 3);
    ctx.lineTo(x, thick / 2 - 3);
    ctx.stroke();
  }
  if (handle) {
    ctx.fillStyle = C.amber;
    ctx.shadowColor = C.amber;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(len * 0.88, 0, 4.5, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

/* ============================================================
   HERO · puerta con torque pulsante
   ============================================================ */
function heroScene() {
  const canvas = document.getElementById("heroCanvas");
  if (!canvas) return;
  let { ctx, w, h } = setupCanvas(canvas);
  let t = 0;

  window.addEventListener("resize", () => ({ ctx, w, h } = setupCanvas(canvas)));

  function frame() {
    t += reduceMotion ? 0 : 0.016;
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 30);

    const hx = w * 0.16;
    const hy = h * 0.78;
    const scale = Math.min(w / 760, h / 320);
    const doorLen = 300 * scale;
    const thick = 26 * scale;

    // ángulo oscilante suave
    const ang = -Math.PI / 2 + Math.sin(t * 0.9) * 0.55;
    const omega = Math.cos(t * 0.9) * 0.55 * 0.9;

    // suelo
    ctx.save();
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - 40 * scale, hy + thick / 2 + 6);
    ctx.lineTo(w * 0.9, hy + thick / 2 + 6);
    ctx.stroke();
    ctx.restore();

    drawDoorPanel(ctx, hx, hy, ang, doorLen, thick);

    // punto de aplicación + brazo
    const px = hx + Math.cos(ang) * doorLen * 0.88;
    const py = hy + Math.sin(ang) * doorLen * 0.88;

    // brazo r
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.restore();

    // fuerza perpendicular
    const fAng = ang + Math.PI / 2;
    const fLen = 74 * scale * (0.8 + 0.2 * Math.sin(t * 1.8));
    drawArrow(ctx, px, py, px + Math.cos(fAng) * fLen, py + Math.sin(fAng) * fLen, C.amber, 3.5, 12);
    label(ctx, "F", px + Math.cos(fAng) * (fLen + 16), py + Math.sin(fAng) * (fLen + 16), C.amber, 15, "center", true);

    // arco de torque
    drawArcArrow(ctx, hx, hy, 52 * scale, ang + 0.15, ang + 1.25, C.white, 3);
    label(ctx, "τ", hx + Math.cos(ang + 0.7) * (52 * scale + 18), hy + Math.sin(ang + 0.7) * (52 * scale + 18), C.white, 15, "center", true);

    // ω indicador
    if (Math.abs(omega) > 0.05) {
      label(ctx, `ω = ${omega.toFixed(2)} rad/s`, w * 0.5, 30, C.magenta, 14, "center", true);
    }
    label(ctx, "τ = F · d · sen θ", w * 0.5, h - 24, C.muted, 14, "center");
    drawHinge(ctx, hx, hy, 9 * scale + 2);

    requestAnimationFrame(frame);
  }
  frame();
}

/* ============================================================
   1 · TORQUE ESTÁTICO — equilibrio
   ============================================================ */
function staticScene() {
  const canvas = document.getElementById("staticCanvas");
  if (!canvas) return;
  let { ctx, w, h } = setupCanvas(canvas);
  let t = 0;
  window.addEventListener("resize", () => ({ ctx, w, h } = setupCanvas(canvas)));

  function frame() {
    t += reduceMotion ? 0 : 0.016;
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 26);

    const hx = w * 0.5;
    const hy = h * 0.56;
    const len = Math.min(w, h) * 0.62;
    const thick = 22;
    const ang = -Math.PI / 2; // puerta hacia arriba (vista cenital)

    drawDoorPanel(ctx, hx, hy, ang, len, thick, { fill: "rgba(34,211,238,0.08)" });

    // brazo
    const p1x = hx + Math.cos(ang) * len * 0.8;
    const p1y = hy + Math.sin(ang) * len * 0.8;
    const p2x = hx + Math.cos(ang) * len * 0.3;
    const p2y = hy + Math.sin(ang) * len * 0.3;

    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(p1x, p1y); ctx.stroke();
    ctx.restore();
    label(ctx, "d₁", (hx + p1x) / 2 + 10, (hy + p1y) / 2, C.cyan, 12);

    // F1 (empuja hacia la derecha) y F2 (empuja hacia la izquierda) -> torque opuestos
    const puls = 0.75 + 0.25 * Math.sin(t * 2);
    const f1 = 60 * puls;
    drawArrow(ctx, p1x, p1y, p1x + f1, p1y, C.amber, 3.5, 11);
    label(ctx, "F₁", p1x + f1 + 12, p1y, C.amber, 14, "left", true);

    drawArrow(ctx, p2x, p2y, p2x - f1, p2y, C.magenta, 3.5, 11);
    label(ctx, "F₂", p2x - f1 - 12, p2y, C.magenta, 14, "right", true);

    // arcos de torque opuestos
    drawArcArrow(ctx, hx, hy, 44, -0.1, 1.1, C.amber, 3);
    drawArcArrow(ctx, hx, hy, 66, 1.1, 0.1, C.magenta, 3);

    // etiqueta central
    label(ctx, "τ₁ = τ₂", hx, 42, C.white, 16, "center", true);
    label(ctx, "τ neto = 0  →  sin rotación", hx, h - 34, C.green, 14, "center", true);

    drawHinge(ctx, hx, hy, 9);
    requestAnimationFrame(frame);
  }
  frame();
}

/* ============================================================
   2 · TORQUE DINÁMICO — rotación acelerada
   ============================================================ */
function dynamicScene() {
  const canvas = document.getElementById("dynamicCanvas");
  if (!canvas) return;
  let { ctx, w, h } = setupCanvas(canvas);
  let t = 0, theta = 0, omega = 0;
  let trail = [];
  window.addEventListener("resize", () => ({ ctx, w, h } = setupCanvas(canvas)));

  function frame() {
    const dt = reduceMotion ? 0 : 0.016;
    t += dt;
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 26);

    // física: torque neto constante + fricción leve
    const tau = 14;
    const I = 2.2;
    const alpha = tau / I - omega * 0.35;
    omega += alpha * dt;
    theta += omega * dt;
    if (theta > 1.35) { theta = 1.35; omega *= -0.25; } // rebote en el tope
    if (theta < -0.15) { theta = -0.15; omega = Math.abs(omega) * 0.4; }

    const hx = w * 0.5;
    const hy = h * 0.6;
    const len = Math.min(w, h) * 0.6;
    const thick = 22;
    const ang = -Math.PI / 2 + theta;

    // estela
    const tipX = hx + Math.cos(ang) * len;
    const tipY = hy + Math.sin(ang) * len;
    trail.push({ x: tipX, y: tipY, a: 1 });
    if (trail.length > 30) trail.shift();
    ctx.save();
    for (let i = 1; i < trail.length; i++) {
      const p = trail[i];
      p.a *= 0.97;
      ctx.strokeStyle = `rgba(244,114,182,${p.a * 0.5})`;
      ctx.lineWidth = 3 * (i / trail.length);
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.restore();

    drawDoorPanel(ctx, hx, hy, ang, len, thick, { fill: "rgba(251,191,36,0.09)", stroke: C.amber });

    // fuerza constante en el extremo
    const fAng = ang + Math.PI / 2;
    const fLen = 78;
    drawArrow(ctx, tipX, tipY, tipX + Math.cos(fAng) * fLen, tipY + Math.sin(fAng) * fLen, C.amber, 3.5, 12);
    label(ctx, "F", tipX + Math.cos(fAng) * (fLen + 16), tipY + Math.sin(fAng) * (fLen + 16), C.amber, 15, "center", true);

    // brazo
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.restore();

    // torque + omega
    drawArcArrow(ctx, hx, hy, 46, ang + 0.1, ang + 1.3, C.white, 3);
    label(ctx, "τ", hx + Math.cos(ang + 0.7) * 66, hy + Math.sin(ang + 0.7) * 66, C.white, 15, "center", true);
    label(ctx, `ω = ${omega.toFixed(2)} rad/s`, w * 0.5, 36, C.magenta, 15, "center", true);
    label(ctx, "τ neto ≠ 0  →  gira y acelera", w * 0.5, h - 30, C.amber, 14, "center", true);

    drawHinge(ctx, hx, hy, 9);
    requestAnimationFrame(frame);
  }
  frame();
}

/* ============================================================
   3 · ACELERACIÓN ANGULAR — gráfica ω vs t
   ============================================================ */
function angularScene() {
  const canvas = document.getElementById("angularCanvas");
  if (!canvas) return;
  let { ctx, w, h } = setupCanvas(canvas);
  let t = 0;
  window.addEventListener("resize", () => ({ ctx, w, h } = setupCanvas(canvas)));

  const alpha = 1.6; // rad/s²
  const history = [];

  function frame() {
    t += reduceMotion ? 0.016 : 0.03;
    const time = t % 4;
    const omega = alpha * time;
    history.push({ t: time, w: omega });
    if (history.length > 200 || time < 0.02) history.length = 0;

    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 26);

    // Zona izquierda: puerta girando
    const cx = w * 0.25;
    const cy = h * 0.5;
    const R = Math.min(w, h) * 0.16;
    const ang = omega * 1.4;

    ctx.save();
    ctx.strokeStyle = "rgba(148,163,184,0.3)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.restore();

    drawDoorPanel(ctx, cx, cy, ang, R, 14, { fill: "rgba(244,114,182,0.12)", stroke: C.magenta, handle: false });
    drawHinge(ctx, cx, cy, 7);

    // flecha de ω
    drawArcArrow(ctx, cx, cy, R + 22, ang - 1.4, ang + 0.4, C.magenta, 3);
    label(ctx, `ω=${omega.toFixed(1)}`, cx, cy + R + 46, C.magenta, 13, "center", true);

    // Zona derecha: gráfica
    const gx = w * 0.48, gy = h * 0.14, gw = w * 0.44, gh = h * 0.62;
    ctx.save();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx, gy, gw, gh);
    // ejes
    ctx.strokeStyle = "rgba(148,163,184,0.5)";
    ctx.beginPath();
    ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh);
    ctx.stroke();
    ctx.restore();
    label(ctx, "ω (rad/s)", gx - 4, gy - 12, C.magenta, 12, "left");
    label(ctx, "t (s)", gx + gw, gy + gh + 16, C.muted, 12, "right");

    // recta teórica ω = α·t
    const maxT = 4, maxW = alpha * maxT;
    ctx.save();
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(gx, gy + gh);
    ctx.lineTo(gx + gw, gy + gh - gh);
    ctx.stroke();
    ctx.restore();

    // línea trazada (parte transcurrida)
    if (time > 0.03) {
      ctx.save();
      ctx.strokeStyle = C.magenta;
      ctx.lineWidth = 3;
      ctx.shadowColor = C.magenta;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(gx, gy + gh);
      ctx.lineTo(gx + gw * (time / maxT), gy + gh - gh * (omega / maxW));
      ctx.stroke();
      ctx.restore();

      // punto actual
      const px = gx + gw * (time / maxT);
      const py = gy + gh - gh * (omega / maxW);
      ctx.save();
      ctx.fillStyle = C.magenta;
      ctx.shadowColor = C.magenta;
      ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill();
      ctx.restore();

      // indicador de pendiente
      label(ctx, `α = ${alpha} rad/s²`, gx + gw * 0.5, gy + 26, C.cyan, 14, "center", true);
    }

    label(ctx, "Pendiente = α", gx + gw * 0.55, gy + gh - 34, C.muted, 12, "center");
    requestAnimationFrame(frame);
  }
  frame();
}

/* ============================================================
   4 · RELACIÓN τ = I·α — comparación de inercias
   ============================================================ */
function relationScene() {
  const canvas = document.getElementById("relationCanvas");
  if (!canvas) return;
  let { ctx, w, h } = setupCanvas(canvas);
  let t = 0;
  window.addEventListener("resize", () => ({ ctx, w, h } = setupCanvas(canvas)));

  // dos puertas: misma fuerza, distinta masa/ancho -> distinta I -> distinta α
  const doors = [
    { m: 12, L: 0.7, color: C.cyan, label: "Ligera", theta: 0, omega: 0 },
    { m: 45, L: 1.1, color: C.amber, label: "Pesada", theta: 0, omega: 0 },
  ];
  const F = 55, d = 0.85, dt = 1 / 60;

  function frame() {
    t += reduceMotion ? 0 : dt;
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 26);

    const tau = F * d; // mismo torque para ambas

    doors.forEach((door, i) => {
      const I = (1 / 3) * door.m * door.L * door.L;
      const alpha = tau / I;
      door.omega += alpha * dt;
      door.theta += door.omega * dt;
      if (door.theta > 1.2) { door.theta = 1.2; door.omega *= -0.3; }

      const hx = w * (i === 0 ? 0.27 : 0.73);
      const hy = h * 0.5;
      const len = Math.min(w * 0.2, h * 0.34) * (0.7 + door.L * 0.4);
      const thick = 14 + door.m * 0.28;
      const ang = -Math.PI / 2 + door.theta;

      drawDoorPanel(ctx, hx, hy, ang, len, thick, {
        fill: door.color === C.cyan ? "rgba(34,211,238,0.12)" : "rgba(251,191,36,0.12)",
        stroke: door.color,
        handle: false,
      });
      drawHinge(ctx, hx, hy, 7);

      // torque en cada una
      drawArcArrow(ctx, hx, hy, 34, ang + 0.1, ang + 1.2, C.white, 2.5);

      label(ctx, door.label, hx, h - 74, door.color, 14, "center", true);
      label(ctx, `I = ${I.toFixed(2)}`, hx, h - 52, C.cyan, 12, "center");
      label(ctx, `α = ${alpha.toFixed(2)}`, hx, h - 32, C.magenta, 12, "center");
      label(ctx, `ω = ${door.omega.toFixed(2)}`, hx, h - 14, C.muted, 12, "center");
    });

    // título central
    label(ctx, "Mismo τ = 55 · 0.85 N·m", w * 0.5, 30, C.white, 14, "center", true);
    label(ctx, "Menor I → mayor α", w * 0.5, 52, C.muted, 12, "center");

    // divisor
    ctx.save();
    ctx.strokeStyle = C.line;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(w * 0.5, 70); ctx.lineTo(w * 0.5, h - 90); ctx.stroke();
    ctx.restore();

    requestAnimationFrame(frame);
  }
  frame();
}

/* ============================================================
   SIMULADOR INTERACTIVO
   ============================================================ */
/* ============================================================
   NUEVO SIMULADOR CON DOS MODOS
   ============================================================ */
function simulator() {
  const $ = (id) => document.getElementById(id);

  document.querySelectorAll('.sim-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sim-tab').forEach((t) => {
        t.classList.remove('active'); t.setAttribute('aria-selected','false');
      });
      tab.classList.add('active'); tab.setAttribute('aria-selected','true');
      const angular = tab.dataset.sim === 'angular';
      $('torqueModule').classList.toggle('active', !angular);
      $('angularModule').classList.toggle('active', angular);
    });
  });

  let torqueSolve = 'tau';
  const torqueEls = {
    force:$('torqueForce'), distance:$('torqueDistance'), angle:$('torqueAngle'), tau:$('torqueTau')
  };

  function torqueValues() { return {F:+torqueEls.force.value,r:+torqueEls.distance.value,deg:+torqueEls.angle.value,tau:+torqueEls.tau.value}; }

  function updateTorqueTracks() {
    Object.values(torqueEls).forEach((el) => {
      const pct=((+el.value-+el.min)/(+el.max-+el.min))*100;
      el.style.background=`linear-gradient(90deg,#22d3ee 0%,#22d3ee ${pct}%,rgba(148,163,184,.2) ${pct}%)`;
    });
  }

  function updateTorque() {
    const v=torqueValues();
    $('forceVal').textContent=v.F.toFixed(0); $('distanceVal').textContent=v.r.toFixed(2);
    $('angleVal').textContent=v.deg.toFixed(0); $('torqueVal').textContent=v.tau.toFixed(1);
    let result=0, message='', valid=true;
    const theta=v.deg*Math.PI/180, sin=Math.sin(theta);

    if (torqueSolve==='tau') {
      result=v.F*v.r*sin;
      $('torqueResultValue').textContent=`τ = ${result.toFixed(1)} N·m`;
      $('torqueEquation').textContent=`τ = ${v.F} × ${v.r.toFixed(2)} × sen ${v.deg}° = ${result.toFixed(1)} N·m`;
      if (Math.abs(sin)<0.0001) message='θ = 0° o 180°: la fuerza es paralela al brazo, así que el torque es cero.';
    }
    if (torqueSolve==='force') {
      if (Math.abs(v.r*sin)<0.0001) { valid=false; message='No existe solución con r · sen θ = 0.'; }
      else result=v.tau/(v.r*sin);
      if(valid&&result>200) {valid=false;message=`F excede el límite: ${result.toFixed(1)} N (máximo 200 N).`;}
      $('torqueResultValue').textContent=valid?`F = ${Math.max(0,result).toFixed(1)} N`:'F sin solución';
      $('torqueEquation').textContent=`F = τ / (r · sen θ) = ${valid?result.toFixed(1):'—'} N`;
    }
    if (torqueSolve==='distance') {
      if (Math.abs(v.F*sin)<0.0001) {valid=false;message='No existe solución con F · sen θ = 0.';}
      else result=v.tau/(v.F*sin);
      if(valid&&(result<0.05||result>2)){valid=false;message=`r excede los límites: ${result.toFixed(2)} m (rango 0.05–2 m).`;}
      $('torqueResultValue').textContent=valid?`r = ${Math.max(0,result).toFixed(2)} m`:'r sin solución';
      $('torqueEquation').textContent=`r = τ / (F · sen θ) = ${valid?result.toFixed(2):'—'} m`;
    }
    if (torqueSolve==='angle') {
      const ratio=v.tau/(v.F*v.r);
      if(v.F<=0||v.r<=0.05){valid=false;message='Necesitas F > 0 y r ≥ 0.05 m.';}
      else if(ratio>1){valid=false;message='Sin solución: τ no puede superar F · r. Máximo posible = '+(v.F*v.r).toFixed(1)+' N·m.';}
      else result=Math.asin(Math.max(0,ratio))*180/Math.PI;
      $('torqueResultValue').textContent=valid?`θ = ${result.toFixed(1)}°`:'θ sin solución';
      $('torqueEquation').textContent=`θ = arcsen(τ / (F · r)) = ${valid?result.toFixed(1)+'°':'—'}`;
    }

    $('torqueReadForce').textContent=torqueSolve==='force'&&valid?Math.max(0,result).toFixed(1):v.F.toFixed(0);
    $('torqueReadDistance').textContent=torqueSolve==='distance'&&valid?Math.max(0,result).toFixed(2):v.r.toFixed(2);
    $('torqueReadAngle').textContent=torqueSolve==='angle'&&valid?result.toFixed(1):v.deg.toFixed(0);
    const val=$('torqueValidation'); val.textContent=message; val.classList.toggle('ok',valid&&!message);
    updateTorqueTracks();
  }

  function showTorqueFields() {
    document.querySelectorAll('[data-field]').forEach((el)=>el.classList.add('hidden'));
    const groups={tau:['force','distance','angle'],force:['torque','distance','angle'],distance:['torque','force','angle'],angle:['torque','force','distance']};
    groups[torqueSolve].forEach((x)=>document.querySelector(`[data-field="${x}"]`)?.classList.remove('hidden'));
  }

  document.querySelectorAll('[data-solve]').forEach((btn)=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-solve]').forEach((b)=>b.classList.remove('active')); btn.classList.add('active');
      torqueSolve=btn.dataset.solve; showTorqueFields(); updateTorque();
    });
  });
  Object.values(torqueEls).forEach((el)=>el.addEventListener('input',updateTorque));
  $('torqueReset').addEventListener('click',()=>{torqueEls.force.value=60;torqueEls.distance.value=.8;torqueEls.angle.value=90;torqueEls.tau.value=48;updateTorque();});

  function drawTorqueCanvas() {
    const canvas=$('torqueCanvas'); if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==Math.round(rect.width*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.width*460/720*dpr);} 
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.width*460/720;
    ctx.clearRect(0,0,w,h);drawGrid(ctx,w,h,26);
    const v=torqueValues();let F=v.F,r=v.r,deg=v.deg,tau=v.tau;const sin=Math.sin(v.deg*Math.PI/180);
    if(torqueSolve==='force'&&Math.abs(v.r*sin)>0.0001){F=Math.min(v.tau/(v.r*sin),200);} 
    if(torqueSolve==='distance'&&Math.abs(v.F*sin)>0.0001){r=Math.max(.05,Math.min(v.tau/(v.F*sin),2));}
    if(torqueSolve==='angle'&&v.F*v.r>0){deg=Math.asin(Math.min(1,v.tau/(v.F*v.r)))*180/Math.PI;}
    const theta=deg*Math.PI/180,tauEff=F*r*Math.sin(theta),hx=w*.20,hy=h*.78,base=-Math.PI/2;
    const len=Math.min(w*.62,h*.50)*(r/2);const ang=base+(torqueSolve==='tau'?Math.sin(performance.now()/900)*.12:theta*.04);
    drawDoorPanel(ctx,hx,hy,ang,Math.max(150,len),24,{fill:'rgba(34,211,238,.09)',stroke:C.cyan});drawHinge(ctx,hx,hy,9);
    const px=hx+Math.cos(ang)*len*.88,py=hy+Math.sin(ang)*len*.88;
    ctx.save();ctx.setLineDash([6,5]);ctx.strokeStyle=C.cyan;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(px,py);ctx.stroke();ctx.restore();
    const fa=ang+theta;drawArrow(ctx,px,py,px+Math.cos(fa)*(44+F*.22),py+Math.sin(fa)*(44+F*.22),C.amber,3.5,11);
    label(ctx,`F=${F.toFixed(1)} N`,px+Math.cos(fa)*75,py+Math.sin(fa)*75,C.amber,12,'center',true);
    label(ctx,`r=${r.toFixed(2)} m`,(hx+px)/2,(hy+py)/2,C.cyan,12,'center',true);
    drawArcArrow(ctx,hx,hy,42,ang+.08,ang+.08+(tauEff>=0?1.15:-1.15),C.magenta,3);
    label(ctx,`τ=${tauEff.toFixed(1)} N·m`,w*.5,30,C.magenta,14,'center',true);
  }

  let angularSolve='alpha',angularT=0,angularRunning=true;
  const angularEls={alpha:$('alphaInput'),omega:$('omegaInput'),time:$('timeInput')};
  function angularValues(){return{alpha:+angularEls.alpha.value,omega:+angularEls.omega.value,time:+angularEls.time.value};}
  function updateAngularTracks(){Object.values(angularEls).forEach(el=>{const pct=((+el.value-+el.min)/(+el.max-+el.min))*100;el.style.background=`linear-gradient(90deg,#f472b6 0%,#f472b6 ${pct}%,rgba(148,163,184,.2) ${pct}%)`;});}

  function updateAngular(){
    const v=angularValues();let alpha=v.alpha,omega=v.omega,t=v.time,msg='',valid=true;
    $('alphaVal').textContent=v.alpha.toFixed(1);$('omegaVal').textContent=v.omega.toFixed(1);$('timeVal').textContent=v.time.toFixed(1);
    if(angularSolve==='alpha'){alpha=v.omega/v.time;if(!Number.isFinite(alpha)||alpha>20){valid=false;msg='α excede el rango máximo de 20 rad/s².';}}
    if(angularSolve==='omega'){omega=v.alpha*v.time;if(omega>30){valid=false;msg='Δω excede el rango máximo de 30 rad/s.';}}
    if(angularSolve==='time'){if(v.alpha<=0){valid=false;msg='No existe Δt finito cuando α = 0.';}else{t=v.omega/v.alpha;if(t<.5||t>10){valid=false;msg=`Δt excede el rango permitido: ${t.toFixed(2)} s.`;}}}
    $('angularResultValue').textContent=angularSolve==='alpha'?`α = ${valid?alpha.toFixed(2):'—'} rad/s²`:angularSolve==='omega'?`Δω = ${valid?omega.toFixed(2):'—'} rad/s`:`Δt = ${valid?t.toFixed(2):'—'} s`;
    $('angularEquation').textContent=`α = ${omega.toFixed(1)} / ${t.toFixed(1)} = ${valid?alpha.toFixed(2):'—'} rad/s²`;
    $('angularReadAlpha').textContent=valid?alpha.toFixed(2):'—';$('angularReadOmega').textContent=omega.toFixed(1);$('angularReadTime').textContent=t.toFixed(1);
    const av=$('angularValidation');av.textContent=msg;av.classList.toggle('ok',valid&&!msg);updateAngularTracks();return{alpha,omega,time:t,valid};
  }

  function showAngularFields(){document.querySelectorAll('[data-angular-field]').forEach(el=>el.classList.add('hidden'));const groups={alpha:['omega','time'],omega:['alpha','time'],time:['alpha','omega']};groups[angularSolve].forEach(x=>document.querySelector(`[data-angular-field="${x}"]`)?.classList.remove('hidden'));}
  document.querySelectorAll('[data-angular-solve]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-angular-solve]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');angularSolve=btn.dataset.angularSolve;showAngularFields();angularT=0;angularRunning=true;updateAngular();}));
  Object.values(angularEls).forEach(el=>el.addEventListener('input',()=>{angularT=0;angularRunning=true;updateAngular();}));
  $('angularReset').addEventListener('click',()=>{angularEls.alpha.value=2;angularEls.omega.value=8;angularEls.time.value=4;angularT=0;angularRunning=true;updateAngular();});
  $('angularRepeat').addEventListener('click',()=>{angularT=0;angularRunning=true;});

  function drawAngularCanvas(){
    const canvas=$('angularSimCanvas');if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==Math.round(rect.width*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.width*460/720*dpr);} 
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.width*460/720;ctx.clearRect(0,0,w,h);drawGrid(ctx,w,h,26);
    const v=updateAngular();if(angularRunning&&v.valid){angularT=Math.min(v.time,angularT+1/60);if(angularT>=v.time)angularRunning=false;}
    const progress=v.time>0?Math.min(1,angularT/v.time):0,omegaNow=v.valid?v.alpha*angularT:0,cx=w*.28,cy=h*.52,R=Math.min(w,h)*.27,angle=omegaNow*1.25;
    ctx.save();ctx.fillStyle='rgba(34,211,238,.08)';ctx.strokeStyle=C.cyan;ctx.lineWidth=8;ctx.beginPath();ctx.arc(cx,cy,R,0,TAU);ctx.fill();ctx.stroke();ctx.restore();
    ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.strokeStyle=C.white;ctx.lineWidth=4;for(let i=0;i<8;i++){const a=i*TAU/8;ctx.beginPath();ctx.moveTo(Math.cos(a)*R*.28,Math.sin(a)*R*.28);ctx.lineTo(Math.cos(a)*R*.82,Math.sin(a)*R*.82);ctx.stroke();}ctx.restore();drawHinge(ctx,cx,cy,6);
    drawArcArrow(ctx,cx,cy,R+24,-.8,1.15,C.magenta,4);label(ctx,`ω = ${omegaNow.toFixed(2)} rad/s`,cx,cy+R+38,C.magenta,14,'center',true);
    const gx=w*.58,gy=h*.18,gw=w*.34,gh=h*.58,maxW=Math.max(v.omega,1);
    ctx.save();ctx.strokeStyle=C.line;ctx.lineWidth=1.5;ctx.strokeRect(gx,gy,gw,gh);ctx.strokeStyle='rgba(148,163,184,.45)';ctx.beginPath();ctx.moveTo(gx,gy+gh);ctx.lineTo(gx+gw,gy+gh);ctx.moveTo(gx,gy+gh);ctx.lineTo(gx,gy);ctx.stroke();ctx.restore();
    ctx.save();ctx.strokeStyle=C.magenta;ctx.lineWidth=3;ctx.shadowColor=C.magenta;ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(gx,gy+gh);ctx.lineTo(gx+gw*progress,gy+gh-gh*(v.valid?(v.alpha*angularT/maxW):0));ctx.stroke();ctx.restore();
    label(ctx,'ω',gx-18,gy,C.magenta,11,'center');label(ctx,'t',gx+gw,gy+gh+18,C.muted,11,'right');label(ctx,`α = ${v.alpha.toFixed(2)} rad/s²`,gx+gw/2,gy-18,C.amber,12,'center',true);
  }

  function drawAngularGraph(){
    const canvas=$('angularGraphCanvas');if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==Math.round(rect.width*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.width*160/320*dpr);}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.width*160/320;ctx.clearRect(0,0,w,h);
    const v=updateAngular(),pad=26,gx=pad*.8,gy=pad*.45,gw=w-pad*1.4,gh=h-pad*1.5,maxW=Math.max(v.omega,1);
    ctx.strokeStyle='rgba(148,163,184,.45)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx,gy+gh);ctx.lineTo(gx+gw,gy+gh);ctx.stroke();
    const progress=v.time>0?Math.min(1,angularT/v.time):0;ctx.save();ctx.strokeStyle=C.magenta;ctx.lineWidth=2.5;ctx.shadowColor=C.magenta;ctx.shadowBlur=7;ctx.beginPath();ctx.moveTo(gx,gy+gh);ctx.lineTo(gx+gw*progress,gy+gh-gh*(progress*v.omega/maxW));ctx.stroke();ctx.restore();
    label(ctx,'ω',gx-12,gy,C.magenta,10,'center');label(ctx,'t',gx+gw,gy+gh+14,C.muted,10,'right');
  }

  showTorqueFields();showAngularFields();updateTorque();updateAngular();
  function loop(){if($('torqueModule').classList.contains('active'))drawTorqueCanvas();else drawAngularCanvas();drawAngularGraph();requestAnimationFrame(loop);}loop();
}

/* ============================================================
   REVEAL AL HACER SCROLL
   ============================================================ */
function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
}

/* ---------- Arranque ---------- */
window.addEventListener("DOMContentLoaded", () => {
  heroScene();
  staticScene();
  dynamicScene();
  angularScene();
  relationScene();
  simulator();
  initReveal();
});
