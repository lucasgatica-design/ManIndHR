# ⚙ TALLER.APP — Optimizador Industrial de Materiales

> Aplicación web de lado del cliente (SPA) para digitalizar procesos de taller.  
> Sin servidores. Sin bases de datos externas. 100% offline tras la primera carga.

---

## 📋 Índice

1. [Descripción](#descripción)
2. [Módulos](#módulos)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Uso local](#uso-local)
5. [Subir a GitHub](#subir-a-github)
6. [Desplegar en GitHub Pages (gratis)](#desplegar-en-github-pages-gratis)
7. [Persistencia de datos](#persistencia-de-datos)
8. [Glosario para el usuario](#glosario-para-el-usuario)

---

## Descripción

**TALLER.APP** es una herramienta profesional para talleres metalmecánicos que resuelve los problemas más frecuentes de planificación de materiales:

- **Desperdicio en cortes**: El operario sabe exactamente cuántas barras comprar y cómo cortarlas.
- **Presupuesto de chapas**: Cálculo de peso exacto con densidades técnicas reales por material.
- **Metros lineales de estructura**: Planificación de perfiles para marcos con refuerzos internos.

Los datos se guardan automáticamente en el navegador (LocalStorage) y se pueden exportar como `.txt` o `.json`.

---

## Módulos

### ✂ Módulo 1 — Optimizador de Corte de Caños/Barras

**Qué hace:** Dado un listado de piezas a cortar y la longitud comercial del material, calcula la cantidad mínima de barras a comprar y el plan de cortes para cada una.

**Algoritmo:** *First-Fit-Decreasing (FFD)* — ordena las piezas de mayor a menor y las asigna a la primera barra que tenga espacio. Produce resultados cercanos al óptimo.

**Parámetros de entrada:**
| Parámetro | Descripción |
|-----------|-------------|
| Longitud comercial | Largo de la barra que se vende (típicamente 6000 mm en Argentina) |
| Kerf | Pérdida de material por el paso del disco o sierra (mm) |
| Retazo mínimo | Sobrante mínimo que se clasifica como reutilizable |
| Lista de piezas | Longitud en mm + cantidad de cada pieza |

**Salida:** Número de barras, porcentaje de aprovechamiento, plan visual por barra y lista de retazos reutilizables.

---

### ⊞ Módulo 2 — Calculadora de Peso de Chapas

**Qué hace:** Calcula el peso unitario y total de piezas planas (chapas, planchas) a partir de sus dimensiones y material.

**Fórmula:**
```
Peso (kg) = Espesor(m) × Ancho(m) × Largo(m) × Densidad(kg/m³)
```

**Materiales disponibles:**
| Material | Densidad (kg/m³) |
|----------|-----------------|
| Acero al Carbono | 7850 |
| Acero Inoxidable 304 | 7900 |
| Acero Inoxidable 316 | 7950 |
| Acero Aleado/Herramienta | 7700 |
| Aluminio | 2700 |
| Cobre | 8960 |
| Personalizado | libre |

Permite acumular ítems en una lista de materiales con peso total del pedido.

---

### ▦ Módulo 3 — Cálculo de Estructuras Rectangulares

**Qué hace:** Calcula los metros lineales totales de perfiles necesarios para construir un marco rectangular (con o sin profundidad) con refuerzos internos (travesaños y montantes).

**Desglose de cálculo:**
- Marco exterior: `2 × Ancho + 2 × Alto`
- Profundidad (si es 3D): `4 × Profundidad` (largueros) + cara trasera
- Refuerzos horizontales: `N × Ancho`
- Refuerzos verticales: `N × Alto`
- Desperdicio por cortes: se aplica como porcentaje sobre el total neto

---

## Estructura del proyecto

```
taller-app/
│
├── index.html     # Estructura HTML de la SPA con los tres módulos
├── style.css      # Diseño industrial modo oscuro, mobile-first
├── script.js      # Lógica de negocio, algoritmos y gestión de estado
├── data.json      # Schema de referencia: materiales, perfiles, kerf
└── README.md      # Esta documentación
```

---

## Uso local

Para abrir la app **sin necesitar servidor**:

1. Descargá o cloná los archivos en una carpeta local.
2. Abrí `index.html` directamente en Google Chrome, Firefox o Edge.
3. La app funciona completamente offline (las fuentes se cargan de Google Fonts la primera vez).

> **Nota:** Los archivos `.css` y `.js` deben estar en la misma carpeta que `index.html`.

---

## Subir a GitHub

### Prerrequisitos
- Tener una cuenta en [github.com](https://github.com)
- Tener Git instalado (o usar GitHub Desktop)

### Pasos

```bash
# 1. Inicializar el repositorio en la carpeta del proyecto
cd taller-app
git init

# 2. Agregar todos los archivos al seguimiento
git add .

# 3. Hacer el primer commit
git commit -m "feat: TALLER.APP v1.0 - Optimizador Industrial"

# 4. Conectar con el repositorio remoto de GitHub
#    (crear primero el repo vacío en github.com)
git remote add origin https://github.com/TU_USUARIO/taller-app.git

# 5. Subir los archivos
git push -u origin main
```

---

## Desplegar en GitHub Pages (gratis)

GitHub Pages permite publicar el sitio con una URL pública del tipo:  
`https://TU_USUARIO.github.io/taller-app/`

### Pasos

1. En GitHub, ir a tu repositorio → **Settings** (Configuración).
2. En el menú lateral, hacer clic en **Pages**.
3. En la sección **Source**, seleccionar:
   - Branch: `main`
   - Carpeta: `/ (root)`
4. Hacer clic en **Save**.
5. Esperar ~2 minutos. GitHub te dará la URL pública.

> **La app queda disponible online sin costo, sin servidor y con HTTPS automático.**

---

## Persistencia de datos

Todos los datos se guardan automáticamente en el **LocalStorage** del navegador bajo la clave `tallerApp_v1`.

| Qué se guarda | Cuándo |
|---------------|--------|
| Lista de piezas (módulo 1) | Al agregar/eliminar piezas |
| Configuración de corte | Al calcular |
| Plan de cortes resultante | Al calcular |
| Lista de materiales (módulo 2) | Al agregar ítems |
| Configuración de estructura | Al calcular |

**Para exportar:** usar el botón "Exportar Todo" → genera un `.json` con toda la sesión.  
**Para borrar:** usar el botón "Limpiar Sesión" o borrar manualmente desde DevTools → Application → LocalStorage.

---

## Glosario para el usuario

Este glosario explica los términos de programación utilizados en la solución, en lenguaje accesible para quien no es desarrollador:

| Término | Qué significa en este contexto |
|---------|-------------------------------|
| **SPA (Single Page Application)** | La app vive en un solo archivo HTML. Los módulos se muestran/ocultan sin recargar la página, como si fueran pestañas. |
| **Client-Side** | Todo el código corre en el navegador del usuario, sin enviar datos a ningún servidor externo. |
| **LocalStorage** | Un "cajón de memoria" del navegador donde se guardan datos en texto. Persiste aunque cierres la pestaña, pero se borra si limpiás el caché del navegador. |
| **JSON (JavaScript Object Notation)** | Formato de archivo para guardar datos estructurados, legible por humanos y por máquinas. Es como un formulario digital con campos y valores. |
| **Algoritmo FFD (First-Fit-Decreasing)** | Estrategia matemática de optimización de cortes: ordena las piezas de mayor a menor y las "encaja" en la primera barra que tenga espacio disponible. Es la estrategia que usaría un cortador experimentado intuitivamente. |
| **Kerf** | En programación de corte CNC/semiautomático, es el ancho del paso de la herramienta de corte que "consume" material. |
| **ES6+ (JavaScript moderno)** | Versión del lenguaje JavaScript lanzada en 2015 y posteriores, que permite escribir código más limpio y organizado. |
| **DOM (Document Object Model)** | La representación interna que tiene el navegador de la página HTML. JavaScript la manipula para actualizar la pantalla sin recargar. |
| **Canvas HTML5** | Elemento de la página que permite dibujar gráficos 2D directamente con código JavaScript. Se usa aquí para el diagrama del marco estructural. |
| **CSS Variables** | Valores reutilizables definidos una sola vez (como `--accent: #f0a500`) que se aplican en toda la hoja de estilos. Facilita cambiar el tema visual completo desde un solo lugar. |
| **Blob / URL.createObjectURL** | Técnica para generar archivos descargables (`.txt`, `.json`) directamente en el navegador, sin necesitar un servidor. |
| **Mobile-first** | Estrategia de diseño donde se diseña primero para pantalla pequeña (celular) y luego se adapta para escritorio. Garantiza usabilidad en tablets de taller. |
| **Estado (state)** | Objeto JavaScript que centraliza todos los datos de la app en memoria. Se sincroniza con LocalStorage para persistencia. |

---

*TALLER.APP v1.0 — Desarrollado para talleres metalmecánicos.*  
*Código abierto. Modificá libremente para tu operación.*
