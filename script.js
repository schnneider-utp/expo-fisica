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
function simulator() {
  const canvas = document.getElementById("simCanvas");
  if (!canvas) return;

  const $ = (id) => document.getElementById(id);
  const inputs = {
    force: $("force"), dist: $("dist"), angle: $("angle"),
    mass: $("mass"), width: $("width"), fric: $("fric"),
  };
  const out = {
    force: $("forceVal"), dist: $("distVal"), angle: $("angleVal"),
    mass: $("massVal"), width: $("widthVal"), fric: $("fricVal"),
    torque: $("roTorque"), inertia: $("roInertia"), alpha: $("roAlpha"),
    omega: $("roOmega"), theta: $("roTheta"), state: $("roState"),
    eq: $("liveEq"),
  };

  // Estado de la física
  let mode = "static";
  let theta = 0;      // ángulo de la puerta (rad), 0 = cerrada
  let omega = 0;      // velocidad angular
  let pushImpulse = 0;
  let resistTimer = 0; // segundos que muestra "Resistiendo…" tras un empujón estático

  // Estado para el modo estático: puerta fija en un ángulo de equilibrio
  const staticTheta = Math.PI / 2.6;

  // Historial para la gráfica
  let graphData = [];
  let graphTime = 0;

  const MAX_ANGLE = Math.PI * 0.62;   // tope de apertura
  const MIN_ANGLE = -0.05;

  /* ---------- Lectura de parámetros ---------- */
  function params() {
    const F = +inputs.force.value;
    const d = +inputs.dist.value * +inputs.width.value; // m del eje (proporcional al ancho)
    const th = (+inputs.angle.value * Math.PI) / 180;    // ángulo entre r y F
    const m = +inputs.mass.value;
    const L = +inputs.width.value;
    const fric = +inputs.fric.value;
    const I = (1 / 3) * m * L * L;
    const tau = F * d * Math.sin(th);
    return { F, d, th, m, L, fric, I, tau };
  }

  /* ---------- Actualiza etiquetas ---------- */
  function updateLabels() {
    out.force.textContent = inputs.force.value;
    out.dist.textContent = (+inputs.dist.value * +inputs.width.value).toFixed(2);
    out.angle.textContent = inputs.angle.value;
    out.mass.textContent = inputs.mass.value;
    out.width.textContent = (+inputs.width.value).toFixed(2);
    out.fric.textContent = (+inputs.fric.value).toFixed(2);

    // pintar el track del range
    Object.values(inputs).forEach((el) => {
      const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
      el.style.background = `linear-gradient(90deg, #22d3ee 0%, #22d3ee ${pct}%, rgba(148,163,184,0.2) ${pct}%)`;
    });
  }

  /* ---------- Modo ---------- */
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      mode = btn.dataset.mode;
      resetSim();
    });
  });

  /* ---------- Presets ---------- */
  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = btn.dataset.preset;
      if (p === "light") { inputs.mass.value = 10; inputs.width.value = 0.7; inputs.force.value = 55; inputs.fric.value = 0.3; }
      if (p === "heavy") { inputs.mass.value = 70; inputs.width.value = 1.3; inputs.force.value = 110; inputs.fric.value = 1.4; }
      if (p === "edge") { inputs.dist.value = 1; inputs.force.value = 45; inputs.angle.value = 90; }
      resetSim();
    });
  });

  function resetSim() {
    theta = mode === "static" ? staticTheta : 0;
    omega = 0;
    pushImpulse = 0;
    resistTimer = 0;
    graphData = [];
    graphTime = 0;
  }

  $("resetBtn").addEventListener("click", resetSim);

  // Etiqueta flotante que aparece en el canvas al empujar
  let pushToast = null; // { text, color, t }

  $("pushBtn").addEventListener("click", (e) => {
    // animación de pulsación del botón
    const btn = e.currentTarget;
    btn.classList.remove("pulse");
    void btn.offsetWidth; // reinicia la animación
    btn.classList.add("pulse");

    if (mode === "dynamic") {
      // empujón fuerte: impulso angular notable (aunque F = 0)
      pushImpulse = 18;
      pushToast = { text: "¡Empujón! ω aumenta", color: "#f472b6", t: 1.4 };
    } else {
      // modo estático: perturbación momentánea que el torque
      // de resistencia compensa → la puerta regresa al equilibrio
      pushImpulse = 14;
      resistTimer = 1.6; // muestra "Resistiendo…" en el panel
      pushToast = { text: "τ resistente lo compensa → equilibrio", color: "#34d399", t: 1.8 };
    }
  });

  Object.values(inputs).forEach((el) => el.addEventListener("input", updateLabels));
  updateLabels();

  /* ---------- Física ---------- */
  function physics(dt) {
    const { I, tau, fric } = params();

    if (mode === "static") {
      // Equilibrio: la puerta se mantiene en su ángulo.
      // Si el torque aplicado no alcanza para "sostenerla", tiende a cerrarse
      // y se muestra el torque de resistencia que lo compensa.
      const desired = staticTheta;
      // resorte que representa el torque de resistencia (gravedad/balance)
      const k = 14;
      const tauResist = -k * (theta - desired);
      // amortiguamiento
      omega += (tauResist / I - omega * 2.2) * dt;
      omega = Math.max(-4, Math.min(4, omega));
      theta += omega * dt;

      // empujón del botón: perturbación momentánea que el torque
      // de resistencia compensa (la puerta se desplaza y regresa)
      if (pushImpulse !== 0) {
        omega += pushImpulse / I;
        pushImpulse = 0;
      }
      if (resistTimer > 0) resistTimer -= dt;
    } else {
      // Dinámico: τ_neto = τ_aplicada − fricción·signo(ω) − resorte de tope
      let alpha = tau / I;

      // impulso del botón (empujón)
      if (pushImpulse > 0) {
        omega += pushImpulse / I;
        pushImpulse = 0;
      }

      // fricción viscosa de la bisagra
      alpha -= (fric * omega) / I;

      // fricción seca cuando casi no se mueve -> se detiene
      if (Math.abs(omega) < 0.12 && Math.abs(tau) < 0.6) {
        alpha -= (omega * 6) / I;
      }

      omega += alpha * dt;
      theta += omega * dt;

      // topes con rebote
      if (theta > MAX_ANGLE) { theta = MAX_ANGLE; omega = -Math.abs(omega) * 0.35; }
      if (theta < MIN_ANGLE) { theta = MIN_ANGLE; omega = Math.abs(omega) * 0.35; }
    }
  }

  /* ---------- Dibujo del simulador ---------- */
  function draw() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round((rect.width * 460) / 720 * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = (rect.width * 460) / 720;

    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 26);

    const { F, d: arm, th, L } = params();

    // geometría de la puerta
    const hx = w * 0.22;
    const hy = h * 0.82;
    const scale = Math.min(w * 0.62, h * 0.72) / Math.max(L, 0.6);
    const doorLen = L * scale;
    const thick = Math.max(16, 26 * (0.7 + L * 0.3));
    const ang = -Math.PI / 2 + theta; // puerta hacia arriba, rota con theta

    // suelo / pared
    ctx.save();
    ctx.strokeStyle = "rgba(148,163,184,0.4)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hx - 46, hy + thick / 2 + 8);
    ctx.lineTo(hx + doorLen + 30, hy + thick / 2 + 8);
    ctx.stroke();
    // muro de la bisagra
    ctx.strokeStyle = "rgba(148,163,184,0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const x = hx - 46 + i * 8;
      ctx.beginPath();
      ctx.moveTo(x, hy + thick / 2 + 8);
      ctx.lineTo(x - 7, hy + thick / 2 + 20);
      ctx.stroke();
    }
    ctx.restore();

    // puerta
    drawDoorPanel(ctx, hx, hy, ang, doorLen, thick, {
      fill: mode === "static" ? "rgba(34,211,238,0.10)" : "rgba(251,191,36,0.10)",
      stroke: mode === "static" ? C.cyan : C.amber,
    });

    // punto de aplicación (proporcional al ancho)
    const appFrac = Math.min(arm / L, 1);
    const px = hx + Math.cos(ang) * doorLen * appFrac;
    const py = hy + Math.sin(ang) * doorLen * appFrac;

    // brazo r (línea discontinua desde el eje)
    ctx.save();
    ctx.setLineDash([7, 6]);
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 2;
    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(px, py); ctx.stroke();
    ctx.restore();
    label(ctx, `r = ${arm.toFixed(2)} m`, (hx + px) / 2 + 14, (hy + py) / 2, C.cyan, 12, "left", true);

    // ángulo θ entre r y F (arco)
    if (th > 0.05 && th < Math.PI - 0.05) {
      const arcR = 40;
      const a0 = ang;
      const a1 = ang + th;
      ctx.save();
      ctx.strokeStyle = "rgba(226,232,240,0.6)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(hx, hy, arcR, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
      ctx.restore();
      const mid = ang + th / 2;
      label(ctx, `θ=${Math.round(th * 180 / Math.PI)}°`, hx + Math.cos(mid) * (arcR + 20), hy + Math.sin(mid) * (arcR + 20), C.white, 11, "center");
    }

    // vector fuerza F
    const fAng = ang + th; // dirección de F respecto al brazo
    const fLen = 40 + F * 0.55;
    if (F > 0.5) {
      drawArrow(ctx, px, py, px + Math.cos(fAng) * fLen, py + Math.sin(fAng) * fLen, C.amber, 4, 13);
      label(ctx, `F = ${F.toFixed(0)} N`, px + Math.cos(fAng) * (fLen + 14), py + Math.sin(fAng) * (fLen + 14), C.amber, 13, "center", true);
    }

    // punto de aplicación
    ctx.save();
    ctx.fillStyle = C.white;
    ctx.shadowColor = C.white;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill();
    ctx.restore();

    // torque: arco grande desde el eje
    const { tau } = params();
    if (Math.abs(tau) > 0.05) {
      const dir = tau >= 0 ? 1 : -1;
      const base = ang;
      const span = 1.3 * Math.min(1, Math.abs(tau) / 40 + 0.3);
      drawArcArrow(ctx, hx, hy, Math.min(doorLen * 0.5, 92), base + 0.05 * dir, base + span * dir, C.white, 3.5);
      const midA = base + (span / 2) * dir;
      const rr = Math.min(doorLen * 0.5, 92) + 22;
      label(ctx, `τ = ${tau.toFixed(1)} N·m`, hx + Math.cos(midA) * rr, hy + Math.sin(midA) * rr, C.white, 13, "center", true);
    }

    // ω: flecha de velocidad en el extremo
    if (Math.abs(omega) > 0.08) {
      const tipX = hx + Math.cos(ang) * doorLen;
      const tipY = hy + Math.sin(ang) * doorLen;
      const dir = omega >= 0 ? 1 : -1;
      drawArcArrow(ctx, hx, hy, doorLen + 26, ang - 0.9 * dir, ang + 0.3 * dir, C.magenta, 3);
      label(ctx, `ω ${omega >= 0 ? "↺" : "↻"} ${Math.abs(omega).toFixed(2)} rad/s`, w - 16, 26, C.magenta, 13, "right", true);
    }

    drawHinge(ctx, hx, hy, 10);

    // estado estático: flechas de torque opuestas + etiqueta
    if (mode === "static") {
      const tauApplied = tau;
      const tauResist = -14 * (theta - staticTheta); // igual que en physics
      // indicador visual de equilibrio
      ctx.save();
      ctx.fillStyle = "rgba(52,211,153,0.12)";
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      const bw = 176, bh = 34, bx = w - bw - 14, by = h - bh - 14;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 8) : ctx.rect(bx, by, bw, bh);
      ctx.fill(); ctx.stroke();
      ctx.restore();
      label(ctx, `τ₁ ${tauApplied.toFixed(1)}  =  τ₂ ${Math.abs(tauResist).toFixed(1)}`, bx + bw / 2, by + bh / 2, C.green, 13, "center", true);
    }

    // hint
    label(ctx, mode === "static"
      ? "Modo estático: la puerta permanece en equilibrio (τ neto = 0)"
      : "Modo dinámico: τ neto ≠ 0 → la puerta gira", 16, 24, C.muted, 12.5, "left");

    // etiqueta flotante tras pulsar "Empujar"
    if (pushToast && pushToast.t > 0) {
      const p = 1 - pushToast.t / 1.8;          // 0 → 1 durante la vida del toast
      const alpha = Math.min(1, pushToast.t * 2.5);
      const y = h * 0.42 - p * 34;               // flota hacia arriba
      ctx.save();
      ctx.globalAlpha = alpha;
      const text = pushToast.text;
      ctx.font = '600 15px "IBM Plex Mono", monospace';
      const tw = ctx.measureText(text).width + 30;
      const tx = w / 2 - tw / 2;
      ctx.fillStyle = "rgba(8,12,20,0.92)";
      ctx.strokeStyle = pushToast.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(tx, y - 16, tw, 32, 16) : ctx.rect(tx, y - 16, tw, 32);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      label(ctx, text, w / 2, y, pushToast.color, 15, "center", true);
    }
  }

  /* ---------- Panel de lecturas ---------- */
  function updateReadouts() {
    const { I, tau, fric } = params();
    let alpha;
    if (mode === "static") {
      // en equilibrio la aceleración es ~0; mostramos la que generaría el τ aplicado
      alpha = 0;
    } else {
      alpha = (tau - fric * omega) / I;
    }

    out.torque.textContent = tau.toFixed(2);
    out.inertia.textContent = I.toFixed(2);
    out.alpha.textContent = alpha.toFixed(2);
    out.omega.textContent = omega.toFixed(2);
    out.theta.textContent = ((theta * 180) / Math.PI).toFixed(0);
    out.eq.textContent = `${tau.toFixed(2)} = ${I.toFixed(2)} · ${alpha.toFixed(2)}`;

    let state;
    if (mode === "static") {
      state = resistTimer > 0 ? "🛡 Resistiendo…" : "⚡ Equilibrio (τ = 0)";
    }
    else if (Math.abs(omega) < 0.05 && Math.abs(alpha) < 0.05) state = "En reposo";
    else if (omega > 0.05) state = "▲ Girando (antihorario)";
    else if (omega < -0.05) state = "▼ Girando (horario)";
    else state = "Acelerando";
    if (out.state.textContent !== state) {
      out.state.textContent = state;
      out.state.parentElement.classList.remove("flash");
      void out.state.offsetWidth;
      out.state.parentElement.classList.add("flash");
    }
  }

  /* ---------- Gráfica ω vs t ---------- */
  const graph = document.getElementById("graphCanvas");
  function drawGraph() {
    if (!graph) return;
    const rect = graph.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (graph.width !== Math.round(rect.width * dpr)) {
      graph.width = Math.round(rect.width * dpr);
      graph.height = Math.round((rect.width * 160) / 320 * dpr);
    }
    const ctx = graph.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = (rect.width * 160) / 320;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(8,12,20,0.6)";
    ctx.fillRect(0, 0, w, h);

    const pad = 26;
    const gw = w - pad * 1.4, gh = h - pad * 1.6;
    const gx = pad * 0.8, gy = pad * 0.5;

    // ejes
    ctx.strokeStyle = "rgba(148,163,184,0.45)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh);
    ctx.stroke();
    // línea cero
    const maxAbsW = Math.max(2, ...graphData.map((p) => Math.abs(p.w)));
    const zeroY = gy + gh / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(148,163,184,0.3)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(gx, zeroY); ctx.lineTo(gx + gw, zeroY); ctx.stroke();
    ctx.restore();

    label(ctx, "ω", gx - 14, gy + 6, C.magenta, 11, "center");
    label(ctx, "t", gx + gw + 8, gy + gh + 4, C.muted, 11, "center");

    if (graphData.length < 2) {
      label(ctx, "esperando datos…", gx + gw / 2, gy + gh / 2, "rgba(148,163,184,0.6)", 11, "center");
      return;
    }

    const maxT = Math.max(2, graphData[graphData.length - 1].t);
    const toX = (t) => gx + (t / maxT) * gw;
    const toY = (v) => zeroY - (v / maxAbsW) * (gh / 2);

    // área bajo la curva
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(toX(graphData[0].t), zeroY);
    graphData.forEach((p) => ctx.lineTo(toX(p.t), toY(p.w)));
    ctx.lineTo(toX(graphData[graphData.length - 1].t), zeroY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, gy, 0, gy + gh);
    grad.addColorStop(0, "rgba(244,114,182,0.28)");
    grad.addColorStop(1, "rgba(244,114,182,0.02)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // línea
    ctx.save();
    ctx.strokeStyle = C.magenta;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = C.magenta;
    ctx.shadowBlur = 8;
    ctx.lineJoin = "round";
    ctx.beginPath();
    graphData.forEach((p, i) => {
      const x = toX(p.t), y = toY(p.w);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // punto actual
    const last = graphData[graphData.length - 1];
    ctx.save();
    ctx.fillStyle = C.magenta;
    ctx.shadowColor = C.magenta;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(toX(last.t), toY(last.w), 4, 0, TAU); ctx.fill();
    ctx.restore();

    label(ctx, `${last.w.toFixed(2)} rad/s`, gx + gw - 4, gy + 8, C.magenta, 10.5, "right", true);
  }

  /* ---------- Bucle principal ---------- */
  let last = performance.now();
  let graphAcc = 0;

  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.05); // pestañas en background

    if (!reduceMotion || document.hasFocus()) {
      physics(dt);

      // decae la etiqueta flotante del empujón
      if (pushToast) {
        pushToast.t -= dt;
        if (pushToast.t <= 0) pushToast = null;
      }

      graphTime += dt;
      graphAcc += dt;
      if (graphAcc > 0.05) {
        graphAcc = 0;
        graphData.push({ t: graphTime, w: omega });
        if (graphData.length > 400) graphData.shift();
        if (graphTime > 8) { graphData = graphData.filter((p) => p.t > graphTime - 8); }
      }
    }

    draw();
    updateReadouts();
    drawGraph();
    requestAnimationFrame(loop);
  }

  resetSim();
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(loop); });
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
