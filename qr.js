/* ============================================================
   Códigos QR dibujados aquí mismo — sin librerías, sin internet
   ------------------------------------------------------------
   Copiado sin cambios del generador de fichas THIQA
   (github.com/eliasgaribi-ctrl-z/generador-fichas-thiqa).

   Se codifica aquí y no con un servicio de imágenes porque el
   tablero se imprime: una liga a api.qrserver.com necesitaría
   internet a la hora de imprimir, le mandaría la URL de tu carpeta
   de Drive a un tercero, y en el PDF quedaría un hueco si falla.

   Nivel L a propósito: es el que menos módulos gasta, y menos
   módulos es un QR menos apretado. Una carpeta de Drive mide 72
   caracteres y cae en la versión 4 —33x33 módulos—; con nivel M
   serían 41x41 para el mismo dato. El código va sobre papel, bajo
   techo, no en una etiqueta de intemperie.
   ============================================================ */
(function(){

const GF_EXP = new Uint8Array(512), GF_LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++){ GF_EXP[i] = x; GF_LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
const gfMul = (a, b) => (a && b) ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0;

/* Por versión (1 a 15): [códigos de corrección por bloque, bloques del grupo 1,
   datos por bloque del grupo 1, bloques del grupo 2, datos por bloque del grupo 2].
   Son las cifras del estándar para nivel L. */
const BLOQUES_L = [
  [ 7, 1,  19, 0,  0], [10, 1, 34, 0,  0], [15, 1, 55, 0,  0], [20, 1, 80, 0,  0],
  [26, 1, 108, 0,  0], [18, 2, 68, 0,  0], [20, 2, 78, 0,  0], [24, 2, 97, 0,  0],
  [30, 2, 116, 0,  0], [18, 2, 68, 2, 69], [20, 4, 81, 0,  0], [24, 2, 92, 2, 93],
  [26, 4, 107, 0, 0], [30, 3, 115, 1, 116], [22, 5, 87, 1, 88],
];
/* Centros de los patrones de alineación. La versión 1 no lleva. */
const ALINEACION = [
  [], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42],
  [6,26,46], [6,28,50], [6,30,54], [6,32,58], [6,34,62], [6,26,46,66], [6,26,48,70],
];
/* Bits sobrantes que se rellenan con ceros al final del área de datos. */
const SOBRANTES = [0,7,7,7,7,7,0,0,0,0,0,0,0,3,3];

const datosDeVersion = v => { const [, b1, d1, b2, d2] = BLOQUES_L[v-1]; return b1*d1 + b2*d2; };
/* Cuántos bytes de texto caben: lo que queda después del indicador de modo (4
   bits) y del contador de caracteres (8 bits hasta la versión 9, 16 de la 10). */
const cabenBytes = v => Math.floor((datosDeVersion(v) * 8 - 4 - (v < 10 ? 8 : 16)) / 8);

/* El polinomio generador se arma multiplicando (x - α^0)(x - α^1)… El arreglo
   va del coeficiente de mayor grado al menor: multiplicar por x corre el
   coeficiente a la misma posición y el término de α^i a la siguiente. */
function polGenerador(n){
  let p = [1];
  for (let i = 0; i < n; i++){
    const r = new Array(p.length + 1).fill(0);
    for (let a = 0; a < p.length; a++){ r[a] ^= p[a]; r[a+1] ^= gfMul(p[a], GF_EXP[i]); }
    p = r;
  }
  return p;
}

function correccion(datos, n){
  const g = polGenerador(n), res = new Array(n).fill(0);
  for (const d of datos){
    const f = d ^ res[0];
    res.shift(); res.push(0);
    if (f) for (let i = 0; i < n; i++) res[i] ^= gfMul(g[i+1], f);
  }
  return res;
}

/* Los 8 patrones de máscara del estándar, por fila y columna. */
const MASCARAS = [
  (i,j) => (i + j) % 2 === 0,
  (i,j) => i % 2 === 0,
  (i,j) => j % 3 === 0,
  (i,j) => (i + j) % 3 === 0,
  (i,j) => (Math.floor(i/2) + Math.floor(j/3)) % 2 === 0,
  (i,j) => (i*j) % 2 + (i*j) % 3 === 0,
  (i,j) => ((i*j) % 2 + (i*j) % 3) % 2 === 0,
  (i,j) => ((i+j) % 2 + (i*j) % 3) % 2 === 0,
];

/* Los datos de formato y de versión van con su propio código detector de
   errores, porque si se leen mal no hay forma de decodificar el resto. */
function bchFormato(dato){          // 5 bits de dato + 10 de BCH(15,5)
  let v = dato << 10;
  for (let i = 14; i >= 10; i--) if (v & (1 << i)) v ^= 0b10100110111 << (i - 10);
  return (((dato << 10) | v) ^ 0b101010000010010);
}
function bchVersion(ver){           // 6 bits de dato + 12 de BCH(18,6)
  let v = ver << 12;
  for (let i = 17; i >= 12; i--) if (v & (1 << i)) v ^= 0b1111100100101 << (i - 12);
  return (ver << 12) | v;
}

function reservar(size, ver){
  const res = Array.from({length: size}, () => new Uint8Array(size));
  const marca = (y, x, h, w) => { for (let a = 0; a < h; a++) for (let b = 0; b < w; b++)
    if (y+a >= 0 && y+a < size && x+b >= 0 && x+b < size) res[y+a][x+b] = 1; };
  /* Los tres localizadores con su separador, y el área del formato pegada a ellos. */
  marca(0, 0, 9, 9); marca(0, size-8, 9, 8); marca(size-8, 0, 8, 9);
  for (let i = 8; i < size - 8; i++){ res[6][i] = 1; res[i][6] = 1; }   // sincronía
  for (const cy of ALINEACION[ver-1]) for (const cx of ALINEACION[ver-1]){
    if ((cy <= 8 && cx <= 8) || (cy <= 8 && cx >= size-9) || (cy >= size-9 && cx <= 8)) continue;
    marca(cy-2, cx-2, 5, 5);
  }
  if (ver >= 7){ marca(0, size-11, 6, 3); marca(size-11, 0, 3, 6); }
  return res;
}

function dibujarFijos(m, size, ver){
  /* El localizador es de 7x7; el renglón y la columna de más que se recorren
     son el separador en blanco que lo rodea, así que ahí no entra el borde. */
  const cuadro = (y, x) => {
    for (let a = -1; a <= 7; a++) for (let b = -1; b <= 7; b++){
      const yy = y+a, xx = x+b;
      if (yy < 0 || yy >= size || xx < 0 || xx >= size) continue;
      const dentro = a >= 0 && a <= 6 && b >= 0 && b <= 6;
      const borde = dentro && (a === 0 || a === 6 || b === 0 || b === 6);
      const centro = a >= 2 && a <= 4 && b >= 2 && b <= 4;
      m[yy][xx] = (borde || centro) ? 1 : 0;
    }
  };
  cuadro(0, 0); cuadro(0, size-7); cuadro(size-7, 0);
  for (let i = 8; i < size - 8; i++){ const v = i % 2 === 0 ? 1 : 0; m[6][i] = v; m[i][6] = v; }
  for (const cy of ALINEACION[ver-1]) for (const cx of ALINEACION[ver-1]){
    if ((cy <= 8 && cx <= 8) || (cy <= 8 && cx >= size-9) || (cy >= size-9 && cx <= 8)) continue;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++)
      m[cy+a][cx+b] = (Math.max(Math.abs(a), Math.abs(b)) !== 1) ? 1 : 0;
  }
}

function escribirFormato(m, size, mascara){
  /* 01 es el nivel L; los tres bits siguientes son la máscara. Los 15 bits van
     dos veces, para que el lector aún pueda arrancar si una esquina se maltrata. */
  const fmt = bchFormato((0b01 << 3) | mascara);
  const bit = i => (fmt >> i) & 1;
  /* Primera copia: baja por la columna 8 y da vuelta por el renglón 8. */
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
  m[7][8] = bit(6);
  m[8][8] = bit(7);
  m[8][7] = bit(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
  /* Segunda copia: los primeros ocho bits por el renglón 8 desde la orilla
     derecha, y los siete que quedan por la columna 8 desde abajo. */
  for (let i = 0; i < 8; i++) m[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) m[size - 15 + i][8] = bit(i);
  /* El módulo que siempre va oscuro cae encima del último de la segunda copia,
     así que se pone al final. */
  m[size - 8][8] = 1;
}

function escribirVersion(m, size, ver){
  if (ver < 7) return;
  const v = bchVersion(ver);
  for (let i = 0; i < 18; i++){
    const bit = (v >> i) & 1, a = Math.floor(i / 3), b = i % 3;
    m[a][size - 11 + b] = bit;
    m[size - 11 + b][a] = bit;
  }
}

function penalizacion(m, size){
  let p = 0;
  /* Regla 1: corridas de 5 o más del mismo color, por fila y por columna. */
  for (let i = 0; i < size; i++){
    for (const fila of [true, false]){
      let run = 1, ant = -1;
      for (let j = 0; j < size; j++){
        const v = fila ? m[i][j] : m[j][i];
        if (v === ant) run++; else { if (run >= 5) p += 3 + (run - 5); run = 1; ant = v; }
      }
      if (run >= 5) p += 3 + (run - 5);
    }
  }
  /* Regla 2: cada cuadro de 2x2 de un solo color. */
  for (let i = 0; i < size - 1; i++) for (let j = 0; j < size - 1; j++)
    if (m[i][j] === m[i][j+1] && m[i][j] === m[i+1][j] && m[i][j] === m[i+1][j+1]) p += 3;
  /* Regla 3: el patrón 1:1:3:1:1 con cuatro claros de un lado, que se puede
     confundir con un localizador. */
  const A = [1,0,1,1,1,0,1,0,0,0,0], B = [0,0,0,0,1,0,1,1,1,0,1];
  const casa = (get, j) => {
    let a = true, b = true;
    for (let k = 0; k < 11; k++){ const v = get(j + k); if (v !== A[k]) a = false; if (v !== B[k]) b = false; }
    return a || b;
  };
  for (let i = 0; i < size; i++) for (let j = 0; j + 11 <= size; j++){
    if (casa(k => m[i][k], j)) p += 40;
    if (casa(k => m[k][i], j)) p += 40;
  }
  /* Regla 4: qué tan lejos del 50% está la proporción de módulos oscuros. */
  let oscuros = 0;
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) oscuros += m[i][j];
  p += Math.floor(Math.abs(oscuros * 100 / (size * size) - 50) / 5) * 10;
  return p;
}

function qrMatriz(texto){
  const bytes = new TextEncoder().encode(String(texto));
  let ver = 0;
  for (let v = 1; v <= 15; v++) if (bytes.length <= cabenBytes(v)){ ver = v; break; }
  if (!ver) throw new Error('El texto no cabe en un QR versión 15 con corrección L.');

  /* Cadena de bits: modo byte, cuántos caracteres, los bytes, el terminador,
     el relleno hasta cerrar el último byte y los bytes de acolchonado. */
  const bits = [];
  const meter = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  meter(0b0100, 4);
  meter(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) meter(b, 8);
  const tope = datosDeVersion(ver) * 8;
  for (let i = 0; i < 4 && bits.length < tope; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const relleno = [0xEC, 0x11];
  for (let i = 0; bits.length < tope; i++) meter(relleno[i % 2], 8);

  const datos = [];
  for (let i = 0; i < bits.length; i += 8){
    let b = 0; for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
    datos.push(b);
  }

  /* Los datos se parten en bloques, cada uno con su corrección, y luego se
     intercalan: primer byte de cada bloque, segundo de cada bloque, etc. */
  const [nEc, b1, d1, b2, d2] = BLOQUES_L[ver-1];
  const bloques = [], eces = [];
  let pos = 0;
  for (let i = 0; i < b1 + b2; i++){
    const largo = i < b1 ? d1 : d2;
    const bl = datos.slice(pos, pos + largo); pos += largo;
    bloques.push(bl); eces.push(correccion(bl, nEc));
  }
  const salida = [];
  for (let i = 0; i < Math.max(d1, d2); i++) for (const bl of bloques) if (i < bl.length) salida.push(bl[i]);
  for (let i = 0; i < nEc; i++) for (const e of eces) salida.push(e[i]);

  const finales = [];
  for (const b of salida) for (let i = 7; i >= 0; i--) finales.push((b >> i) & 1);
  for (let i = 0; i < SOBRANTES[ver-1]; i++) finales.push(0);

  const size = 17 + 4 * ver;
  const res = reservar(size, ver);
  const base = Array.from({length: size}, () => new Uint8Array(size));
  dibujarFijos(base, size, ver);

  /* Recorrido en zigzag desde abajo a la derecha, de dos en dos columnas,
     saltándose la columna 6 que es la de sincronía. */
  const acomodar = m => {
    let idx = 0, arriba = true;
    for (let col = size - 1; col > 0; col -= 2){
      if (col === 6) col--;
      for (let k = 0; k < size; k++){
        const fila = arriba ? size - 1 - k : k;
        for (let c = 0; c < 2; c++){
          const x = col - c;
          if (res[fila][x]) continue;
          m[fila][x] = idx < finales.length ? finales[idx++] : 0;
        }
      }
      arriba = !arriba;
    }
  };

  let mejor = null, mejorP = Infinity;
  for (let mk = 0; mk < 8; mk++){
    const m = base.map(f => Uint8Array.from(f));
    acomodar(m);
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++)
      if (!res[i][j] && MASCARAS[mk](i, j)) m[i][j] ^= 1;
    escribirFormato(m, size, mk);
    escribirVersion(m, size, ver);
    const p = penalizacion(m, size);
    if (p < mejorP){ mejorP = p; mejor = m; }
  }
  return { version: ver, tam: size, matriz: mejor };
}

/* SVG de un solo <path>: pesa poco aunque vayan 24 carátulas en un PDF, y al
   ser vectorial la impresora lo saca nítido sin importar a qué tamaño quede.
   crispEdges evita que el navegador difumine los bordes en la vista previa. */
function qrSvg(texto){
  const borde = 4;   // la zona muda que pide el estándar
  /* Un texto que no cabe no puede tumbar la página. qrMatriz sólo llega a la
     versión 15 —520 bytes con corrección L— y Maps genera ligas de compartir
     bastante más largas; como el QR se dibuja dentro del mismo intento que
     carga el maestro, una sola celda con una URL así dejaba la app sin mostrar
     ni una casa, con un mensaje que hablaba de versiones de QR. Ahora esa casa
     se queda sin su código y las demás entran igual. */
  let tam, matriz;
  try {
    ({ tam, matriz } = qrMatriz(texto));
  } catch (e) {
    return '';
  }
  let d = '';
  for (let y = 0; y < tam; y++){
    let x = 0;
    while (x < tam){
      if (!matriz[y][x]){ x++; continue; }
      let ancho = 1;
      while (x + ancho < tam && matriz[y][x + ancho]) ancho++;
      d += 'M' + (x + borde) + ' ' + (y + borde) + 'h' + ancho + 'v1h-' + ancho + 'z';
      x += ancho;
    }
  }
  const lado = tam + borde * 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + lado + ' ' + lado + '" ' +
         'shape-rendering="crispEdges" role="img"><rect width="' + lado + '" height="' + lado +
         '" fill="#FFFFFF"/><path d="' + d + '" fill="#163E6B"/></svg>';
}

/* Drive le cuelga a sus ligas un "?usp=drive_link" que no hace falta para abrir
   la carpeta y sí encarece el código: son 15 caracteres más, justo los que hacen
   brincar de la versión 4 (33x33 módulos) a la 5 (37x37). Sin ese parámetro
   todas las carpetas salen del mismo tamaño y con los módulos más grandes, que
   es lo que se lee mejor en papel. Sólo se quita ese parámetro: lo demás de la
   URL se respeta tal cual venga. */
function qrLimpia(u){
  const m = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(u);
  if (!m || !m[2]) return u;
  const q = m[2].slice(1).split('&').filter(p => !/^usp=/i.test(p));
  return m[1] + (q.length ? '?' + q.join('&') : '') + (m[3] || '');
}

window.qrSvg = qrSvg;
window.qrLimpia = qrLimpia;

})();
