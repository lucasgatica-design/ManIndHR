/**
 * TALLER.APP — script.js
 * Optimizador Industrial de Materiales v1.0
 *
 * Módulos:
 *   1. Optimizador de Corte de Caños/Barras (algoritmo First-Fit-Decreasing)
 *   2. Calculadora de Peso de Chapas
 *   3. Cálculo de Metros Lineales para Estructuras Rectangulares
 *
 * Persistencia: localStorage
 * Exportación: archivos .txt descargables
 */

'use strict';

/* ══════════════════════════════════════════════════════
   ESTADO GLOBAL (se sincroniza con localStorage)
   ══════════════════════════════════════════════════════ */
const STATE_KEY = 'tallerApp_v1';

/** @type {Object} estado persistido */
let state = {
  corte: {
    piezas: [],                // [{long: Number, cant: Number}]
    config: {},                // longComercial, kerf, minScrap, matDesc
    resultado: null            // plan de corte calculado
  },
  peso: {
    listaMateriales: []        // [{material, densidad, espesor, ancho, largo, cant, kgU, kgTotal}]
  },
  estructura: {
    config: {},                // últimos parámetros ingresados
    resultado: null
  }
};

/** Carga el estado desde localStorage */
function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge profundo simple para no perder campos nuevos en futuras versiones
      state = { ...state, ...parsed };
    }
  } catch (e) {
    console.warn('Error al cargar estado:', e);
  }
}

/** Persiste el estado en localStorage */
function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Error al guardar estado:', e);
  }
}

/* ══════════════════════════════════════════════════════
   UTILIDADES GENERALES
   ══════════════════════════════════════════════════════ */

/**
 * Muestra una notificación tipo "toast" en la esquina inferior derecha.
 * @param {string} msg  — Mensaje a mostrar
 * @param {'ok'|'error'} type — Tipo visual
 */
function showToast(msg, type = 'ok') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show' + (type === 'error' ? ' error' : '');
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

/**
 * Descarga un string como archivo de texto.
 * @param {string} content — Contenido del archivo
 * @param {string} filename — Nombre del archivo
 */
function downloadTxt(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Descarga un objeto como archivo JSON.
 * @param {Object} obj
 * @param {string} filename
 */
function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Formatea un número con 2 decimales y punto de miles (estilo argentino). */
function fmt(n, dec = 2) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/* ══════════════════════════════════════════════════════
   MÓDULO 1 — CORTE DE CAÑOS / BARRAS
   Algoritmo: First-Fit-Decreasing (FFD) adaptado
   ══════════════════════════════════════════════════════ */

/** Referencia a la lista de piezas en el estado actual */
let piezas = []; // Se sincroniza con state.corte.piezas

/**
 * Renderiza la lista de piezas en el DOM.
 */
function renderPiezas() {
  const container = document.getElementById('piezasList');
  container.innerHTML = '';

  if (piezas.length === 0) {
    container.innerHTML = '<div class="empty-state">Sin piezas. Agregá al menos una.</div>';
    return;
  }

  piezas.forEach((p, idx) => {
    const item = document.createElement('div');
    item.className = 'pieza-item';
    item.innerHTML = `
      <div class="pieza-info">
        Pieza #${idx + 1}: <span>${p.long} mm</span> × <span>${p.cant} u</span>
        <span style="color:var(--text-dim);font-size:.8rem"> = ${p.long * p.cant} mm total</span>
      </div>
      <button class="pieza-delete" data-idx="${idx}" title="Eliminar pieza">✕</button>
    `;
    container.appendChild(item);
  });

  // Delegación de eventos para borrar piezas
  container.querySelectorAll('.pieza-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      piezas.splice(idx, 1);
      state.corte.piezas = piezas;
      saveState();
      renderPiezas();
    });
  });
}

/**
 * ALGORITMO DE OPTIMIZACIÓN DE CORTE — First-Fit-Decreasing (FFD)
 *
 * El algoritmo ordena las piezas de mayor a menor longitud y las "encaja"
 * en la primera barra que tenga espacio suficiente. Esto produce un resultado
 * cercano al óptimo con complejidad O(n²) en el peor caso.
 *
 * @param {number} longBarra  — Longitud comercial de la barra (mm)
 * @param {number} kerf       — Pérdida por corte (mm) por cada corte
 * @param {number} minScrap   — Retazo mínimo clasificado como reutilizable (mm)
 * @param {Array}  listaPiezas — Array de {long, cant}
 * @returns {Object} plan de corte completo
 */
function calcularCorteFFD(longBarra, kerf, minScrap, listaPiezas) {
  // 1. Expandir la lista a piezas individuales ordenadas de mayor a menor
  const items = [];
  listaPiezas.forEach(p => {
    for (let i = 0; i < p.cant; i++) {
      items.push(p.long);
    }
  });
  items.sort((a, b) => b - a);

  if (items.length === 0) return null;

  // Validación: ninguna pieza puede superar la longitud comercial
  const tooBig = items.find(l => l > longBarra);
  if (tooBig) {
    throw new Error(`La pieza de ${tooBig}mm supera la longitud comercial de ${longBarra}mm.`);
  }

  // 2. Estructuras de barras: cada barra tiene cortes y sobrante
  const barras = []; // [{cortes: [mm, ...], sobrante: mm}]

  /**
   * Calcula el espacio disponible en una barra dado sus cortes actuales.
   * Se descuenta kerf por cada corte (excepto el último extremo).
   */
  function espacioDisponible(barra) {
    const totalCortado = barra.cortes.reduce((s, c) => s + c, 0);
    const totalKerf    = barra.cortes.length * kerf; // kerf por cada corte realizado
    return longBarra - totalCortado - totalKerf;
  }

  // 3. FFD: asignar cada pieza a la primera barra con espacio
  items.forEach(pieza => {
    let asignada = false;

    for (let b = 0; b < barras.length; b++) {
      // Espacio = longitud libre - kerf del próximo corte
      const libre = espacioDisponible(barras[b]) - kerf;
      if (libre >= pieza) {
        barras[b].cortes.push(pieza);
        asignada = true;
        break;
      }
    }

    if (!asignada) {
      // Abrir una barra nueva
      barras.push({ cortes: [pieza] });
    }
  });

  // 4. Calcular sobrantes y estadísticas
  let totalDesperdicioMm = 0;
  let totalSobrante      = 0;
  let retazosReutilizables = [];

  const planDetallado = barras.map((barra, idx) => {
    const totalCortado = barra.cortes.reduce((s, c) => s + c, 0);
    const totalKerf    = barra.cortes.length * kerf;
    const sobrante     = longBarra - totalCortado - totalKerf;
    totalDesperdicioMm += sobrante + totalKerf;
    totalSobrante += sobrante;
    if (sobrante >= minScrap) retazosReutilizables.push(sobrante);

    return {
      nroBarra: idx + 1,
      cortes:   barra.cortes.slice(), // copia del array
      sobrante,
      totalCortado,
      totalKerf,
      aprovechamiento: ((totalCortado / longBarra) * 100).toFixed(1)
    };
  });

  // 5. Totales globales
  const numBarras          = barras.length;
  const metrosTotales      = (numBarras * longBarra) / 1000;
  const totalPiezasMm      = items.reduce((s, x) => s + x, 0);
  const porcentajeEfic     = ((totalPiezasMm / (numBarras * longBarra)) * 100).toFixed(1);
  const porcentajeDesperc  = (100 - parseFloat(porcentajeEfic)).toFixed(1);

  return {
    numBarras,
    longBarra,
    kerf,
    minScrap,
    metrosTotales,
    totalPiezas: items.length,
    totalPiezasMm,
    totalDesperdicioMm,
    totalSobrante,
    porcentajeEfic,
    porcentajeDesperc,
    retazosReutilizables,
    planDetallado
  };
}

/**
 * Genera el HTML con el resumen estadístico del plan de corte.
 */
function renderSummaryCorte(plan) {
  document.getElementById('summaryCorte').innerHTML = `
    <div class="stat-box">
      <span class="stat-value">${plan.numBarras}</span>
      <span class="stat-label">Barras a comprar</span>
    </div>
    <div class="stat-box blue">
      <span class="stat-value">${fmt(plan.metrosTotales, 2)} m</span>
      <span class="stat-label">Metros lineales</span>
    </div>
    <div class="stat-box green">
      <span class="stat-value">${plan.porcentajeEfic}%</span>
      <span class="stat-label">Aprovechamiento</span>
    </div>
    <div class="stat-box red">
      <span class="stat-value">${plan.porcentajeDesperc}%</span>
      <span class="stat-label">Desperdicio</span>
    </div>
    <div class="stat-box">
      <span class="stat-value">${fmt(plan.totalDesperdicioMm, 0)} mm</span>
      <span class="stat-label">Descarte total</span>
    </div>
  `;
}

/**
 * Renderiza el plan detallado con barras visuales.
 */
function renderPlanDetalle(plan) {
  const container = document.getElementById('planCorteDetalle');
  container.innerHTML = '';

  plan.planDetallado.forEach(barra => {
    const div = document.createElement('div');
    div.className = 'barra-corte';

    // Cabecera de la barra
    div.innerHTML = `
      <div class="barra-header">
        BARRA #${barra.nroBarra} — ${plan.longBarra} mm
        <span>Aprovechamiento: ${barra.aprovechamiento}% | Sobrante: ${barra.sobrante} mm</span>
      </div>
    `;

    // Barra visual
    const visual = document.createElement('div');
    visual.className = 'barra-visual';

    // Colores para distinguir piezas repetidas
    const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#9333ea'];
    let colorIdx = 0;
    const colorMap = {};

    barra.cortes.forEach((c, i) => {
      const pct = (c / plan.longBarra) * 100;
      const kerfPct = (plan.kerf / plan.longBarra) * 100;

      // Segmento de la pieza
      if (!colorMap[c]) colorMap[c] = COLORS[colorIdx++ % COLORS.length];
      const seg = document.createElement('div');
      seg.className = 'seg-pieza';
      seg.style.flexBasis = pct + '%';
      seg.style.background = colorMap[c];
      seg.title = `${c} mm`;
      seg.textContent = pct > 4 ? `${c}` : '';
      visual.appendChild(seg);

      // Kerf entre piezas
      if (i < barra.cortes.length - 1 || barra.sobrante > 0) {
        const kSeg = document.createElement('div');
        kSeg.className = 'seg-kerf';
        kSeg.style.flexBasis = kerfPct + '%';
        kSeg.title = `Kerf: ${plan.kerf} mm`;
        visual.appendChild(kSeg);
      }
    });

    // Sobrante al final
    if (barra.sobrante > 0) {
      const scrapPct = (barra.sobrante / plan.longBarra) * 100;
      const scrap = document.createElement('div');
      scrap.className = 'seg-scrap';
      scrap.style.flexBasis = scrapPct + '%';
      scrap.title = `Sobrante: ${barra.sobrante} mm`;
      scrap.textContent = scrapPct > 5 ? `${barra.sobrante}` : '';
      visual.appendChild(scrap);
    }

    div.appendChild(visual);

    // Lista de cortes
    const cutsList = document.createElement('div');
    cutsList.className = 'barra-cuts-list';
    const grouped = {};
    barra.cortes.forEach(c => { grouped[c] = (grouped[c] || 0) + 1; });
    const parts = Object.entries(grouped).map(([mm, qty]) =>
      `<strong>${mm} mm</strong> × ${qty}`
    );
    cutsList.innerHTML = `Cortes: ${parts.join(' | ')} — Kerf total: ${barra.totalKerf} mm`;
    div.appendChild(cutsList);

    container.appendChild(div);
  });

  // Retazos reutilizables
  const scrapSection = document.getElementById('scrapSection');
  if (plan.retazosReutilizables.length > 0) {
    scrapSection.innerHTML = `
      <div class="scrap-title">♻ Retazos reutilizables (≥ ${plan.minScrap} mm)</div>
      <div class="barra-cuts-list">
        ${plan.retazosReutilizables.map((r, i) => `<strong>Retazo #${i+1}:</strong> ${r} mm`).join(' | ')}
      </div>
    `;
  } else {
    scrapSection.innerHTML = '';
  }
}

/**
 * Genera el texto de exportación del plan de corte.
 */
function generarTextoCorte(plan, config) {
  const linea = '═'.repeat(60);
  const fecha = new Date().toLocaleString('es-AR');
  let txt = `${linea}\n`;
  txt += `  TALLER.APP — PLAN DE CORTES OPTIMIZADO\n`;
  txt += `  Fecha: ${fecha}\n`;
  txt += `${linea}\n\n`;

  if (config.matDesc) txt += `MATERIAL: ${config.matDesc}\n`;
  txt += `Longitud comercial : ${plan.longBarra} mm\n`;
  txt += `Kerf (paso de disco): ${plan.kerf} mm\n`;
  txt += `Retazo mínimo      : ${plan.minScrap} mm\n\n`;

  txt += `── RESUMEN ──────────────────────────────────────────\n`;
  txt += `Barras a comprar   : ${plan.numBarras}\n`;
  txt += `Metros lineales    : ${fmt(plan.metrosTotales, 2)} m\n`;
  txt += `Total piezas       : ${plan.totalPiezas}\n`;
  txt += `Aprovechamiento    : ${plan.porcentajeEfic}%\n`;
  txt += `Desperdicio        : ${plan.porcentajeDesperc}% (${fmt(plan.totalDesperdicioMm,0)} mm)\n\n`;

  txt += `── PLAN DETALLADO ───────────────────────────────────\n`;
  plan.planDetallado.forEach(b => {
    txt += `\nBARRA #${b.nroBarra} (${plan.longBarra} mm):\n`;
    const grouped = {};
    b.cortes.forEach(c => { grouped[c] = (grouped[c] || 0) + 1; });
    Object.entries(grouped).forEach(([mm, qty]) => {
      txt += `  · ${mm} mm × ${qty}\n`;
    });
    txt += `  Sobrante: ${b.sobrante} mm | Aprovechamiento: ${b.aprovechamiento}%\n`;
  });

  if (plan.retazosReutilizables.length > 0) {
    txt += `\n── RETAZOS REUTILIZABLES (≥${plan.minScrap}mm) ──────────\n`;
    plan.retazosReutilizables.forEach((r, i) => {
      txt += `  Retazo #${i+1}: ${r} mm\n`;
    });
  }

  txt += `\n${linea}\n`;
  return txt;
}

/* ──────────────────── LISTENERS — MÓDULO 1 ─────────── */

document.getElementById('btnAddPieza').addEventListener('click', () => {
  const longEl = document.getElementById('newPiezaLong');
  const cantEl = document.getElementById('newPiezaCant');
  const long = parseFloat(longEl.value);
  const cant = parseInt(cantEl.value);

  if (!long || long <= 0) { showToast('Ingresá una longitud válida.', 'error'); return; }
  if (!cant || cant <= 0) { showToast('Ingresá una cantidad válida.', 'error'); return; }

  piezas.push({ long, cant });
  state.corte.piezas = piezas;
  saveState();
  renderPiezas();

  longEl.value = '';
  cantEl.value = '1';
  longEl.focus();
});

// Agregar pieza con Enter en el campo de longitud
document.getElementById('newPiezaLong').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btnAddPieza').click();
});

document.getElementById('btnCalcularCorte').addEventListener('click', () => {
  const longComercial = parseFloat(document.getElementById('longComercial').value);
  const kerf          = parseFloat(document.getElementById('kerf').value) || 0;
  const minScrap      = parseFloat(document.getElementById('minScrap').value) || 0;
  const matDesc       = document.getElementById('matDesc').value.trim();

  if (!longComercial || longComercial <= 0) {
    showToast('Ingresá la longitud comercial.', 'error'); return;
  }
  if (piezas.length === 0) {
    showToast('Agregá al menos una pieza.', 'error'); return;
  }

  try {
    const plan = calcularCorteFFD(longComercial, kerf, minScrap, piezas);
    if (!plan) { showToast('No hay piezas para calcular.', 'error'); return; }

    // Guardar en estado
    const config = { longComercial, kerf, minScrap, matDesc };
    state.corte.config   = config;
    state.corte.resultado = plan;
    saveState();

    // Mostrar resultados
    const resultDiv = document.getElementById('resultadosCorte');
    resultDiv.style.display = 'block';
    renderSummaryCorte(plan);
    renderPlanDetalle(plan);

    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`✓ ${plan.numBarras} barras calculadas. Eficiencia: ${plan.porcentajeEfic}%`);

  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('btnLimpiarPiezas').addEventListener('click', () => {
  piezas = [];
  state.corte.piezas = [];
  state.corte.resultado = null;
  saveState();
  renderPiezas();
  document.getElementById('resultadosCorte').style.display = 'none';
  showToast('Lista de piezas limpiada.');
});

document.getElementById('btnExportCorte').addEventListener('click', () => {
  const plan   = state.corte.resultado;
  const config = state.corte.config;
  if (!plan) { showToast('No hay resultados para exportar.', 'error'); return; }
  const txt = generarTextoCorte(plan, config);
  downloadTxt(txt, `plan_corte_${Date.now()}.txt`);
  showToast('Plan de corte exportado.');
});

/* ══════════════════════════════════════════════════════
   MÓDULO 2 — PESO DE CHAPAS / PLANCHAS
   Fórmula: Peso (kg) = (E(m) × A(m) × L(m)) × Densidad(kg/m³)
   ══════════════════════════════════════════════════════ */

/** Etiquetas de materiales para mostrar en la tabla */
const MAT_LABELS = {
  '7850': 'Acero Carbono',
  '7900': 'Inox 304',
  '7950': 'Inox 316',
  '7700': 'Acero Aleado',
  '2700': 'Aluminio',
  '8960': 'Cobre',
  'custom': 'Personalizado'
};

/** Último cálculo de peso (para el botón "Agregar a lista") */
let ultimoPeso = null;

/**
 * Muestra/oculta el campo de densidad personalizada.
 */
document.getElementById('materialChapa').addEventListener('change', (e) => {
  document.getElementById('customDensRow').style.display =
    e.target.value === 'custom' ? 'block' : 'none';
});

/**
 * Calcula el peso de una chapa.
 * @returns {{kgU: number, kgTotal: number, volumen: number}}
 */
function calcularPesoChapa() {
  const matSel    = document.getElementById('materialChapa');
  const densidad  = matSel.value === 'custom'
    ? parseFloat(document.getElementById('densidadCustom').value)
    : parseFloat(matSel.value);
  const espesor   = parseFloat(document.getElementById('espesorChapa').value);   // mm
  const ancho     = parseFloat(document.getElementById('anchoChapa').value);     // mm
  const largo     = parseFloat(document.getElementById('largoChapa').value);     // mm
  const cant      = parseInt(document.getElementById('cantChapa').value)  || 1;

  if (!densidad || !espesor || !ancho || !largo) {
    throw new Error('Completá todos los campos dimensionales.');
  }

  // Convertir mm → m
  const e_m = espesor / 1000;
  const a_m = ancho   / 1000;
  const l_m = largo   / 1000;

  const volumenM3 = e_m * a_m * l_m;           // m³ por pieza
  const kgU       = volumenM3 * densidad;        // kg por pieza
  const kgTotal   = kgU * cant;                  // kg totales
  const area      = a_m * l_m;                  // m² por pieza

  return { densidad, espesor, ancho, largo, cant, volumenM3, kgU, kgTotal, area,
           materialLabel: MAT_LABELS[matSel.value] || `${densidad} kg/m³`,
           materialKey: matSel.value };
}

document.getElementById('btnCalcularPeso').addEventListener('click', () => {
  try {
    const r = calcularPesoChapa();

    document.getElementById('pesoUnitario').textContent = fmt(r.kgU, 3);
    document.getElementById('pesoTotal').textContent    = fmt(r.kgTotal, 3);
    document.getElementById('cantDisplay').textContent  = r.cant;

    document.getElementById('pesoDetails').innerHTML = `
      Volumen unitario: ${(r.volumenM3 * 1e6).toFixed(2)} cm³<br>
      Área superficial: ${(r.area).toFixed(4)} m² | ${(r.area * 10000).toFixed(2)} cm²<br>
      Densidad: ${r.densidad} kg/m³
    `;

    document.getElementById('btnAgregarLista').style.display = 'block';
    ultimoPeso = r;
    saveState();
    showToast(`✓ ${fmt(r.kgU, 3)} kg/u | ${fmt(r.kgTotal, 3)} kg total`);

  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('btnAgregarLista').addEventListener('click', () => {
  if (!ultimoPeso) return;
  state.peso.listaMateriales.push({ ...ultimoPeso, ts: Date.now() });
  saveState();
  renderListaMateriales();
  showToast('Ítem agregado a la lista de materiales.');
});

/**
 * Renderiza la tabla de materiales acumulados.
 */
function renderListaMateriales() {
  const lista = state.peso.listaMateriales;
  const card  = document.getElementById('listaMaterialesCard');

  if (lista.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  const tbody = document.getElementById('tablaMaterialesBody');
  tbody.innerHTML = '';

  let pesoGlobal = 0;

  lista.forEach((item, idx) => {
    pesoGlobal += item.kgTotal;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${item.materialLabel}</td>
      <td>${item.espesor}</td>
      <td>${item.ancho} × ${item.largo}</td>
      <td>${item.cant}</td>
      <td>${fmt(item.kgU, 3)}</td>
      <td style="color:var(--accent)">${fmt(item.kgTotal, 3)}</td>
      <td>
        <button class="pieza-delete" data-matidx="${idx}" title="Eliminar">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('pesoTotalGlobal').textContent = fmt(pesoGlobal, 3) + ' kg';

  // Borrar ítem de la lista
  tbody.querySelectorAll('.pieza-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.matidx);
      state.peso.listaMateriales.splice(idx, 1);
      saveState();
      renderListaMateriales();
    });
  });
}

/**
 * Genera el texto de exportación de la lista de materiales.
 */
function generarTextoPeso() {
  const lista = state.peso.listaMateriales;
  const fecha = new Date().toLocaleString('es-AR');
  const linea = '═'.repeat(60);
  let txt = `${linea}\n  TALLER.APP — LISTA DE MATERIALES (CHAPAS)\n  Fecha: ${fecha}\n${linea}\n\n`;

  let total = 0;
  lista.forEach((item, i) => {
    total += item.kgTotal;
    txt += `#${i+1} ${item.materialLabel}\n`;
    txt += `  Esp: ${item.espesor}mm | Ancho: ${item.ancho}mm | Largo: ${item.largo}mm\n`;
    txt += `  Cant: ${item.cant} | Kg/u: ${fmt(item.kgU, 3)} | Total: ${fmt(item.kgTotal, 3)} kg\n\n`;
  });

  txt += `${linea}\nPESO TOTAL DEL PEDIDO: ${fmt(total, 3)} kg\n${linea}\n`;
  return txt;
}

document.getElementById('btnExportPeso').addEventListener('click', () => {
  if (state.peso.listaMateriales.length === 0) {
    showToast('No hay materiales para exportar.', 'error'); return;
  }
  downloadTxt(generarTextoPeso(), `lista_materiales_${Date.now()}.txt`);
  showToast('Lista exportada.');
});

document.getElementById('btnClearListaMat').addEventListener('click', () => {
  state.peso.listaMateriales = [];
  saveState();
  renderListaMateriales();
  showToast('Lista de materiales limpiada.');
});

/* ══════════════════════════════════════════════════════
   MÓDULO 3 — ESTRUCTURAS RECTANGULARES
   ══════════════════════════════════════════════════════ */

let lastEstrucConfig = null; // Para exportación

/**
 * Calcula los metros lineales de perfiles para un marco rectangular
 * con refuerzos internos.
 *
 * @param {number} ancho       — mm
 * @param {number} alto        — mm
 * @param {number} profundidad — mm (0 = marco plano 2D)
 * @param {number} refHoriz    — cantidad de travesaños internos
 * @param {number} refVert     — cantidad de montantes internos
 * @param {number} desp        — % de desperdicio
 * @returns {Object} resultado completo
 */
function calcularEstructura(ancho, alto, profundidad, refHoriz, refVert, desp) {
  const es3D = profundidad > 0;

  // Marco exterior 2D: 2×ancho + 2×alto
  const perimetroMarco = 2 * ancho + 2 * alto;

  // Si es 3D: añadir aristas de profundidad (4 largueros)
  const larguerosProfundidad = es3D ? 4 * profundidad : 0;

  // Si es 3D: también la cara trasera = perimetroMarco
  const caraTrasera = es3D ? perimetroMarco : 0;

  // Refuerzos horizontales (longitud = ancho)
  const mmRefHoriz = refHoriz * ancho;

  // Refuerzos verticales (longitud = alto)
  const mmRefVert  = refVert  * alto;

  const totalMmNeto = perimetroMarco + larguerosProfundidad + caraTrasera
                    + mmRefHoriz + mmRefVert;

  const factorDesp   = 1 + (desp / 100);
  const totalMmBruto = totalMmNeto * factorDesp;
  const totalMtNeto  = totalMmNeto / 1000;
  const totalMtBruto = totalMmBruto / 1000;

  return {
    ancho, alto, profundidad, refHoriz, refVert, desp, es3D,
    perimetroMarco,
    larguerosProfundidad,
    caraTrasera,
    mmRefHoriz,
    mmRefVert,
    totalMmNeto,
    totalMmBruto,
    totalMtNeto,
    totalMtBruto,
    desperdicioMm: totalMmBruto - totalMmNeto
  };
}

/**
 * Dibuja el diagrama del marco en el canvas.
 */
function dibujarMarco(canvas, config) {
  const ctx = canvas.getContext('2d');
  const W   = canvas.width;
  const H   = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const margin = 30;
  const drawW  = W - margin * 2;
  const drawH  = H - margin * 2;

  // Escalar el marco
  const scaleX = drawW / config.ancho;
  const scaleY = drawH / config.alto;
  const scale  = Math.min(scaleX, scaleY);

  const mW = config.ancho * scale;
  const mH = config.alto  * scale;
  const ox  = (W - mW) / 2;
  const oy  = (H - mH) / 2;

  ctx.strokeStyle = '#f0a500';
  ctx.lineWidth   = 3;

  // Marco exterior
  ctx.strokeRect(ox, oy, mW, mH);

  ctx.strokeStyle = '#4a9eff';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([4, 3]);

  // Refuerzos horizontales
  for (let i = 1; i <= config.refHoriz; i++) {
    const y = oy + (mH / (config.refHoriz + 1)) * i;
    ctx.beginPath();
    ctx.moveTo(ox, y);
    ctx.lineTo(ox + mW, y);
    ctx.stroke();
  }

  // Refuerzos verticales
  for (let i = 1; i <= config.refVert; i++) {
    const x = ox + (mW / (config.refVert + 1)) * i;
    ctx.beginPath();
    ctx.moveTo(x, oy);
    ctx.lineTo(x, oy + mH);
    ctx.stroke();
  }

  ctx.setLineDash([]);

  // Cotas
  ctx.fillStyle   = '#7a8099';
  ctx.font        = '11px Share Tech Mono, monospace';
  ctx.textAlign   = 'center';
  ctx.fillText(`${config.ancho} mm`, W / 2, oy - 8);
  ctx.save();
  ctx.translate(ox - 12, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${config.alto} mm`, 0, 0);
  ctx.restore();
}

document.getElementById('btnCalcularEstruc').addEventListener('click', () => {
  const ancho      = parseFloat(document.getElementById('marcoAncho').value);
  const alto       = parseFloat(document.getElementById('marcoAlto').value);
  const profund    = parseFloat(document.getElementById('marcoProfundidad').value) || 0;
  const refHoriz   = parseInt(document.getElementById('refHoriz').value)           || 0;
  const refVert    = parseInt(document.getElementById('refVert').value)            || 0;
  const desp       = parseFloat(document.getElementById('desperdicioEstruc').value) || 0;
  const perfilDesc = document.getElementById('perfilDesc').value.trim();

  if (!ancho || ancho <= 0 || !alto || alto <= 0) {
    showToast('Ingresá ancho y alto válidos.', 'error'); return;
  }

  const r = calcularEstructura(ancho, alto, profund, refHoriz, refVert, desp);
  lastEstrucConfig = { ...r, perfilDesc };

  // Guardar en estado
  state.estructura.config   = { ancho, alto, profund, refHoriz, refVert, desp, perfilDesc };
  state.estructura.resultado = r;
  saveState();

  // Renderizar resultado
  const res = document.getElementById('estructuraResult');
  res.innerHTML = `
    <div class="estruc-stats">
      ${perfilDesc ? `<div class="estruc-row"><span class="er-label">Perfil</span><span class="er-value">${perfilDesc}</span></div>` : ''}
      <div class="estruc-row"><span class="er-label">Marco exterior (perímetro)</span><span class="er-value">${fmt(r.perimetroMarco, 0)} mm</span></div>
      ${r.es3D ? `
      <div class="estruc-row"><span class="er-label">Largueros de profundidad (4)</span><span class="er-value">${fmt(r.larguerosProfundidad, 0)} mm</span></div>
      <div class="estruc-row"><span class="er-label">Cara trasera</span><span class="er-value">${fmt(r.caraTrasera, 0)} mm</span></div>
      ` : ''}
      ${r.mmRefHoriz > 0 ? `<div class="estruc-row"><span class="er-label">Refuerzos horizontales (×${r.refHoriz})</span><span class="er-value">${fmt(r.mmRefHoriz, 0)} mm</span></div>` : ''}
      ${r.mmRefVert > 0  ? `<div class="estruc-row"><span class="er-label">Refuerzos verticales (×${r.refVert})</span><span class="er-value">${fmt(r.mmRefVert, 0)} mm</span></div>` : ''}
      <div class="estruc-row"><span class="er-label">Subtotal neto</span><span class="er-value">${fmt(r.totalMtNeto, 3)} m</span></div>
      <div class="estruc-row"><span class="er-label">Desperdicio (${r.desp}%)</span><span class="er-value">+ ${fmt(r.desperdicioMm/1000, 3)} m</span></div>
      <div class="estruc-row highlight">
        <span class="er-label">⬡ TOTAL A COMPRAR</span>
        <span class="er-value">${fmt(r.totalMtBruto, 2)} m</span>
      </div>
    </div>
  `;

  // Dibujar canvas
  const canvas = document.getElementById('marcoCanvas');
  canvas.style.display = 'block';
  dibujarMarco(canvas, r);

  document.getElementById('btnExportEstruc').style.display = 'block';
  showToast(`✓ Total: ${fmt(r.totalMtBruto, 2)} m lineales a comprar.`);
});

document.getElementById('btnExportEstruc').addEventListener('click', () => {
  if (!lastEstrucConfig) { showToast('No hay resultados.', 'error'); return; }
  const r = lastEstrucConfig;
  const fecha = new Date().toLocaleString('es-AR');
  const linea = '═'.repeat(60);
  let txt = `${linea}\n  TALLER.APP — CÁLCULO DE ESTRUCTURA RECTANGULAR\n  Fecha: ${fecha}\n${linea}\n\n`;

  if (r.perfilDesc) txt += `PERFIL: ${r.perfilDesc}\n\n`;
  txt += `DIMENSIONES:\n  Ancho: ${r.ancho} mm | Alto: ${r.alto} mm`;
  if (r.es3D) txt += ` | Profundidad: ${r.profundidad} mm`;
  txt += `\n\nDESGLOSE:\n`;
  txt += `  Marco exterior          : ${fmt(r.perimetroMarco, 0)} mm\n`;
  if (r.es3D) {
    txt += `  Largueros profundidad   : ${fmt(r.larguerosProfundidad, 0)} mm\n`;
    txt += `  Cara trasera            : ${fmt(r.caraTrasera, 0)} mm\n`;
  }
  if (r.mmRefHoriz) txt += `  Refuerzos horiz (×${r.refHoriz})   : ${fmt(r.mmRefHoriz, 0)} mm\n`;
  if (r.mmRefVert)  txt += `  Refuerzos vert  (×${r.refVert})   : ${fmt(r.mmRefVert, 0)} mm\n`;
  txt += `\n  Subtotal neto           : ${fmt(r.totalMtNeto, 3)} m\n`;
  txt += `  Desperdicio (${r.desp}%)        : ${fmt(r.desperdicioMm/1000, 3)} m\n`;
  txt += `\n  ► TOTAL A COMPRAR       : ${fmt(r.totalMtBruto, 2)} m lineales\n`;
  txt += `\n${linea}\n`;
  downloadTxt(txt, `estructura_${Date.now()}.txt`);
  showToast('Estructura exportada.');
});

/* ══════════════════════════════════════════════════════
   TABS — Navegación entre módulos
   ══════════════════════════════════════════════════════ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

/* ══════════════════════════════════════════════════════
   ACCIONES GLOBALES
   ══════════════════════════════════════════════════════ */

/** Exporta toda la sesión como JSON */
document.getElementById('btnExportAll').addEventListener('click', () => {
  downloadJson(state, `tallerApp_sesion_${Date.now()}.json`);
  showToast('Sesión completa exportada como JSON.');
});

/** Limpia toda la sesión */
document.getElementById('btnClearAll').addEventListener('click', () => {
  if (!confirm('¿Limpiár toda la sesión? Se borrarán todos los datos guardados.')) return;
  localStorage.removeItem(STATE_KEY);
  location.reload();
});

/* ══════════════════════════════════════════════════════
   INIT — Restaurar estado al cargar
   ══════════════════════════════════════════════════════ */
function init() {
  loadState();

  // Restaurar piezas de corte
  piezas = Array.isArray(state.corte.piezas) ? state.corte.piezas : [];
  renderPiezas();

  // Restaurar configuración de corte si existía
  const cfg = state.corte.config;
  if (cfg && cfg.longComercial) {
    document.getElementById('longComercial').value = cfg.longComercial;
    document.getElementById('kerf').value          = cfg.kerf ?? 3;
    document.getElementById('minScrap').value      = cfg.minScrap ?? 50;
    document.getElementById('matDesc').value       = cfg.matDesc || '';
  }

  // Restaurar resultado de corte si había uno
  if (state.corte.resultado) {
    const plan = state.corte.resultado;
    document.getElementById('resultadosCorte').style.display = 'block';
    renderSummaryCorte(plan);
    renderPlanDetalle(plan);
  }

  // Restaurar lista de materiales de peso
  if (Array.isArray(state.peso.listaMateriales)) {
    renderListaMateriales();
  }

  // Restaurar configuración de estructura
  const cfgE = state.estructura.config;
  if (cfgE && cfgE.ancho) {
    document.getElementById('marcoAncho').value        = cfgE.ancho;
    document.getElementById('marcoAlto').value         = cfgE.alto;
    document.getElementById('marcoProfundidad').value  = cfgE.profund || 0;
    document.getElementById('refHoriz').value          = cfgE.refHoriz ?? 2;
    document.getElementById('refVert').value           = cfgE.refVert  ?? 1;
    document.getElementById('desperdicioEstruc').value = cfgE.desp     ?? 7;
    document.getElementById('perfilDesc').value        = cfgE.perfilDesc || '';
  }
}

init();
