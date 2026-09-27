# Design System — Expense Tracker

## 1. Paleta de colores

### Modo oscuro (por defecto)
| Uso | Color | Hex |
|---|---|---|
| Fondo principal | Negro profundo | `#0A0A0F` |
| Fondo secundario (cards, sheets) | Negro grisáceo | `#151318` |
| Fondo elevado (modales, tab bar) | Gris muy oscuro | `#1C1A21` |
| Morado primario (acciones, acentos) | Morado vibrante | `#8B5CF6` |
| Morado hover/pressed | Morado oscuro | `#7C3AED` |
| Morado suave (fondos de chips, badges) | Morado translúcido | `#8B5CF61A` (10% opacidad) |
| Texto principal | Blanco | `#F5F5F7` |
| Texto secundario | Gris claro | `#A1A1AA` |
| Texto deshabilitado | Gris oscuro | `#52525B` |
| Bordes / divisores | Gris sutil | `#27242E` |
| Éxito (ingreso, balance positivo) | Verde | `#34D399` |
| Error / gasto alto | Rojo suave | `#F87171` |
| Advertencia | Ámbar | `#FBBF24` |

### Modo claro (opcional, futuro)
| Uso | Hex |
|---|---|
| Fondo principal | `#FAFAFA` |
| Morado primario | `#7C3AED` |
| Texto principal | `#18181B` |

## 2. Colores por categoría (para gráficos y chips)
| Categoría | Color |
|---|---|
| Comida | `#8B5CF6` |
| Transporte | `#A78BFA` |
| Vivienda | `#C4B5FD` |
| Entretenimiento | `#D946EF` |
| Salud | `#F472B6` |
| Educación | `#6D28D9` |
| Otros | `#52525B` |

Nota: derivar la paleta de categorías en tonos morados/violeta como familia base, con dos acentos magenta (Entretenimiento, Salud) para diferenciar visualmente sin salir del esquema negro/morado.

## 3. Tipografía
- Familia: `Inter` (o system font: `-apple-system, SF Pro Text` para iOS nativo)
- Escala:
  - Título de pantalla: 28px / 700 (bold)
  - Título de sección: 18px / 600 (semibold)
  - Monto destacado (en cards de gasto): 22px / 700, color blanco
  - Cuerpo: 15px / 400
  - Caption / metadata (fecha, categoría): 13px / 400, color texto secundario

## 4. Espaciado y bordes
- Grid base: múltiplos de 4px (4, 8, 12, 16, 24, 32)
- Radio de bordes:
  - Cards: 16px
  - Botones: 12px
  - Chips/badges: 999px (pill)
  - Inputs: 10px
- Sombras: evitar sombras oscuras clásicas; usar glow sutil morado en elementos activos: `box-shadow: 0 0 20px #8B5CF633`

## 5. Componentes clave

**Tab bar inferior (estilo iOS)**
- Fondo: `#1C1A21` con blur (backdrop-filter)
- Ícono activo: morado `#8B5CF6` + label visible
- Ícono inactivo: gris `#A1A1AA`, sin label o label tenue
- 3 tabs: Gastos · Resumen · Categorías

**Botón flotante "+ Agregar gasto"**
- Circular, fondo morado `#8B5CF6`, ícono blanco
- Posición fija, esquina inferior derecha, sobre el tab bar
- Glow morado sutil al presionar

**Card de gasto**
- Fondo `#151318`, borde 1px `#27242E`
- Ícono de categoría (circular, fondo del color de la categoría al 15% opacidad)
- Monto alineado a la derecha, blanco, bold
- Fecha y categoría como metadata debajo de la descripción

**Gráfico de resumen (dona/barras)**
- Fondo transparente
- Usar la paleta de categorías (sección 2)
- Centro de la dona (si es tipo donut): total del período en blanco, bold

**Inputs y formularios**
- Fondo `#1C1A21`, texto blanco, placeholder gris
- Borde por defecto `#27242E`, borde en foco `#8B5CF6` (2px)
- Selector de categoría: chips horizontales scrolleables, chip seleccionado con fondo morado sólido

## 6. Principios de UI/UX
- Mobile-first estricto: todo diseñado primero para viewport ~390px (iPhone), luego escalar
- Contraste alto: texto blanco sobre fondos oscuros, cumplir mínimo AA de accesibilidad
- Botones táctiles grandes: mínimo 44x44px (guideline de Apple HIG)
- Feedback visual inmediato: al guardar un gasto, mostrar toast/snackbar morado con check verde
- Safe areas de iOS: respetar `env(safe-area-inset-*)` en tab bar y contenido para notch/home indicator
- Transiciones suaves (200–250ms ease) entre pantallas, sin animaciones exageradas

## 7. Iconografía
- Set de íconos: `lucide-react` (line icons, consistente con el estilo minimalista)
- Grosor de línea uniforme (1.5–2px)
- Color por defecto: gris secundario; morado cuando está activo/seleccionado
