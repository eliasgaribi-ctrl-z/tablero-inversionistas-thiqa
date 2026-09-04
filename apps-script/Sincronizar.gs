/**
 * Sincronizar.gs — le sirve el maestro al Tablero de Inversionistas THIQA
 * ---------------------------------------------------------------------------
 * Este archivo va pegado al Google Sheet del maestro de remates. Publica una
 * dirección web que devuelve las casas en JSON, y el botón "Sincronizar con el
 * maestro" del tablero la consume. Así no hay que bajar el Excel a mano.
 *
 * POR QUÉ HACE FALTA ESTO Y NO SE PUEDE LEER EL SHEET DIRECTO
 *
 * El tablero es una página estática: no tiene servidor ni manera de guardar una
 * contraseña. Un Sheet privado no se puede leer desde el navegador de nadie más,
 * y las dos salidas fáciles no sirven:
 *
 *   · La descarga `.../export?format=xlsx` la bloquea el navegador por CORS, y
 *     además necesita que la persona esté firmada con una cuenta que tenga
 *     acceso al archivo.
 *   · Publicar el Sheet como CSV sí se puede leer, pero **pierde todas las
 *     ligas**: las carpetas de Drive no viven en la celda, cuelgan aparte. Y son
 *     justamente lo que le da valor al tablero.
 *
 * Este script resuelve las dos cosas: corre con TU permiso —así que el Sheet
 * sigue privado— y saca las URLs de las ligas de donde de veras están.
 *
 * QUÉ SALE Y QUÉ NO
 *
 * Sólo salen las columnas de la lista COLUMNAS. El nombre del acreditado, el
 * número de crédito y el expediente judicial **no están en esa lista**, así que
 * no salen del Sheet ni por accidente. Si algún día hace falta agregar una
 * columna, se agrega ahí y en ningún otro lado.
 *
 * SE LEE POR NOMBRE DE ENCABEZADO, NO POR POSICIÓN
 *
 * A propósito, y es la diferencia más importante contra el otro Apps Script del
 * maestro (el de la página de carga): ése lee `d[i][1]`, por posición, y
 * cualquier columna que se inserte a la izquierda lo descuadra en silencio. Este
 * busca "MONTO ACORDADO" por su nombre, así que puedes mover, insertar o borrar
 * columnas y sigue funcionando. Si una columna no aparece, lo dice en la
 * respuesta en lugar de traer el dato equivocado.
 *
 * ---------------------------------------------------------------------------
 * CÓMO INSTALARLO (una vez)
 *
 * VA EN UN PROYECTO APARTE, NO PEGADO AL MAESTRO. Es importante y es fácil
 * equivocarse: el maestro YA tiene un proyecto de Apps Script —el de la página
 * de carga de expedientes— y ése ya define su propio `doGet`. Dos `doGet` en el
 * mismo proyecto no conviven: Apps Script se queda con uno y el otro deja de
 * existir sin decir nada. O sea que pegar este archivo ahí rompería la página
 * de carga, o este script nunca contestaría, y en los dos casos sin un error
 * que lo explique.
 *
 * Por eso este script entra por su propia puerta y lee el maestro por su ID
 * (la constante SHEET_ID de abajo). No necesita estar pegado al Sheet:
 * necesita que quien lo publique tenga acceso al Sheet, que es distinto.
 *
 * 1. Ve a script.google.com → **Nuevo proyecto**, firmado con la cuenta que
 *    tiene acceso al maestro (remates@thiqa.mx). No pases por el maestro.
 * 2. Ponle de nombre `RMV — Sincronizar tablero` y pega todo este archivo,
 *    reemplazando lo que traiga.
 * 3. Cambia la CLAVE de abajo por una tuya, larga y que no sea una palabra.
 *    Mientras no la cambies el script no contesta nada, a propósito.
 * 4. Guarda, y corre una vez la función `probar` para autorizarlo: Google va a
 *    pedir permiso para leer tus hojas de cálculo y hay que dárselo. La primera
 *    vez sale una pantalla de "Google no ha verificado esta aplicación" →
 *    *Configuración avanzada* → *Ir a (nombre del proyecto)*. Es tu propio
 *    script; esa pantalla sale siempre con los que uno escribe.
 * 5. **Implementar → Nueva implementación** → tipo *Aplicación web*, con:
 *        Ejecutar como:      Yo (remates@thiqa.mx)
 *        Quién tiene acceso: Cualquier usuario
 *    Copia la dirección que termina en `/exec`.
 * 6. Pega esa dirección y la clave en el archivo `config.js` del repositorio,
 *    en `SYNC_URL` y `SYNC_KEY`. Ahí es donde el tablero se vuelve un botón:
 *    lo pones una vez y ningún inversionista vuelve a capturar nada.
 *
 *    (Si prefieres no dejarlas en el repositorio, se pueden pegar en Ajustes
 *    dentro del tablero, pero entonces hay que hacerlo una vez en cada
 *    navegador que lo abra. Lo que hay que saber para decidir está escrito
 *    en `config.js`.)
 *
 * **Guardar no es publicar.** Cada vez que cambies este archivo hay que hacer
 * Implementar → Administrar implementaciones → editar → Nueva versión. Sin eso,
 * el tablero sigue recibiendo la versión vieja y parece que el cambio no sirvió.
 *
 * ---------------------------------------------------------------------------
 * SOBRE "CUALQUIER USUARIO" Y LA CLAVE
 *
 * "Cualquier usuario" es la única opción que sirve, porque una página estática
 * no puede firmarse con Google. Eso significa que **quien tenga la dirección y
 * la clave puede leer esas columnas**. Por eso:
 *
 *   · La clave no es adorno: sin ella el script no contesta nada.
 *   · Del Sheet sale lo mínimo, nunca datos de personas.
 *   · En cuanto la dirección y la clave se pongan en `config.js` para que el
 *     tablero sea un botón, quedan a la vista de quien abra el código de la
 *     página. Es el precio de que el inversionista no capture nada, y por eso
 *     importa que lo que sale de aquí sea lo mínimo. Con las carpetas de Drive
 *     compartidas como "sólo personas invitadas", la liga no le sirve de nada
 *     a un extraño.
 *   · Si se te sale de las manos, cambia la CLAVE aquí, publica nueva versión y
 *     la anterior deja de servir en ese momento. Acuérdate de actualizarla
 *     también en `config.js`.
 */

/**
 * La clave. Cámbiala por una tuya antes de publicar.
 *
 * Mientras siga siendo ésta, el script no contesta datos aunque la pidan bien.
 * Es a propósito: este archivo vive en un repositorio público, así que la clave
 * de fábrica la conoce cualquiera, y una implementación publicada con ella
 * estaría abierta de par en par sin que se notara.
 */
const CLAVE = 'cambia-esta-clave-por-una-tuya-larga';
const CLAVE_DE_FABRICA = 'cambia-esta-clave-por-una-tuya-larga';

/** La pestaña de trabajo del maestro. */
const HOJA = 'Base_Carteras_Asignadas';

/**
 * El maestro, por si este archivo termina en un proyecto suelto en lugar de
 * pegado al Sheet. Pegado —que es como debe ir— no se usa: manda el archivo que
 * lo contiene. Suelto, es lo único que le dice a qué libro entrar, y sin esto
 * fallaría con un "no puedo leer la propiedad de null" que no explica nada.
 */
const SHEET_ID = '1J44hMg1grwYKQe13zvyxn5CTzadQ9H86vfR6pre8t3A';

/** El libro: el que contiene al script y, si no hay ninguno, el de arriba. */
function libroMaestro() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SHEET_ID);
}

/**
 * Las únicas columnas que salen del Sheet, por nombre de encabezado.
 * Agregar aquí = agregar al tablero. Quitar de aquí = que no salga nunca.
 */
const COLUMNAS = [
  'FOLIO THIQA',
  'CARTERA',
  'ESTATUS RUTA',
  'CUADRILLA',
  'NO. RUTA',
  'DIRECCION',
  'LINK',
  'COLONIA',
  'CP',
  'MUNICIPIO',
  'FECHA DESALOJO',
  'FECHA CONVENIO',
  'MONTO ACORDADO',
  'CARTA PODER',
  'MONTO MAXIMO POR CASA',
  'EXP. DIGITAL',
];

/** Las columnas de las que hay que sacar la URL de la liga, no sólo el texto. */
const CON_LIGA = ['LINK', 'EXP. DIGITAL'];

/* ========================================================================= */

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (CLAVE === CLAVE_DE_FABRICA) {
      return responde({ ok: false, error: 'clave_de_fabrica',
        mensaje: 'Este script sigue con la clave de fábrica, que es pública. ' +
                 'Cámbiala en la constante CLAVE y publica una nueva versión.' });
    }
    if (String(p.k || '') !== CLAVE) {
      return responde({ ok: false, error: 'clave', mensaje: 'La clave no coincide.' });
    }
    return responde(leerMaestro());
  } catch (err) {
    return responde({ ok: false, error: 'falla', mensaje: String((err && err.message) || err) });
  }
}

function responde(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Igual que la del tablero: sin acentos, minúsculas, y la puntuación a espacios. */
function norm(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function leerMaestro() {
  const libro = libroMaestro();
  const hoja = libro.getSheetByName(HOJA);
  if (!hoja) {
    return { ok: false, error: 'hoja',
             mensaje: 'No encontré la pestaña "' + HOJA + '". Pestañas: ' +
                      libro.getSheets().map(function (h) { return h.getName(); }).join(', ') };
  }

  const rango = hoja.getDataRange();
  const valores = rango.getValues();
  if (!valores.length) return { ok: false, error: 'vacia', mensaje: 'La pestaña está vacía.' };

  /* La fila de encabezados no se da por hecho: se busca la que traiga a la vez
     el folio y la fuente, en las primeras doce.

     Y si ninguna las trae —porque en el Sheet renombraron una de las dos—, no
     se muere todo: se toma la fila que más columnas de COLUMNAS reconozca. Sin
     esto, cambiarle el nombre a UNA columna dejaba el tablero sin una sola casa
     y con un mensaje que culpaba a la fila de encabezados, que estaba bien. */
  const buscadas = COLUMNAS.map(norm);
  let hr = -1, mejor = -1, mejorN = 0;
  for (let i = 0; i < Math.min(valores.length, 12); i++) {
    const h = valores[i].map(norm);
    if (h.indexOf('folio thiqa') >= 0 && h.indexOf('fuente') >= 0) { hr = i; break; }
    let n = 0;
    for (let k = 0; k < buscadas.length; k++) if (h.indexOf(buscadas[k]) >= 0) n++;
    if (n > mejorN) { mejorN = n; mejor = i; }
  }
  /* La mitad de las columnas es el mínimo para creerle a una fila que es el
     encabezado y no un renglón de datos que coincidió por casualidad. */
  if (hr < 0 && mejorN >= Math.ceil(COLUMNAS.length / 2)) hr = mejor;
  if (hr < 0) {
    return { ok: false, error: 'encabezados',
             mensaje: 'No encontré la fila de encabezados. Busco una que traiga FOLIO THIQA y ' +
                      'FUENTE, o al menos la mitad de las columnas de la lista. La que más ' +
                      'reconocí trae ' + mejorN + ' de ' + COLUMNAS.length + '. ' +
                      'Lo más probable es que hayan renombrado columnas en el Sheet.' };
  }

  const cabeza = valores[hr].map(norm);
  const cols = [], faltan = [];
  COLUMNAS.forEach(function (nombre) {
    const i = cabeza.indexOf(norm(nombre));
    if (i < 0) faltan.push(nombre); else cols.push({ nombre: nombre, i: i });
  });
  if (!cols.length) {
    return { ok: false, error: 'columnas',
             mensaje: 'Ninguna de las columnas que busco está en la fila ' + (hr + 1) + '.' };
  }

  /* Las URLs de las ligas. Se piden nada más de las columnas que las traen, y de
     las dos formas en que existen: como liga de la celda (lo que hace Google
     cuando pegas una URL) y como fórmula =HYPERLINK(...), que es lo que queda
     cuando la liga se armó con fórmula. */
  const alto = valores.length - hr - 1;
  const urls = {};
  if (alto > 0) {
    CON_LIGA.forEach(function (nombre) {
      const c = cols.filter(function (x) { return x.nombre === nombre; })[0];
      if (!c) return;
      const r = hoja.getRange(hr + 2, c.i + 1, alto, 1);
      const ricos = r.getRichTextValues();
      const formulas = r.getFormulas();
      const porFila = {};
      for (let n = 0; n < alto; n++) {
        let u = '';
        const rt = ricos[n][0];
        if (rt) {
          u = rt.getLinkUrl() || '';
          if (!u) {
            const runs = rt.getRuns() || [];
            for (let k = 0; k < runs.length && !u; k++) u = runs[k].getLinkUrl() || '';
          }
        }
        if (!u) {
          const f = String(formulas[n][0] || '');
          const m = /^\s*=?\s*HYPERLINK\s*\(\s*"((?:[^"]|"")*)"/i.exec(f);
          if (m) u = m[1].replace(/""/g, '"');
          else {
            /* =HYPERLINK(B2;"texto") — la URL no está escrita en la fórmula,
               está en otra celda. Es como quedan las ligas que se armaron
               arrastrando una fórmula hacia abajo. Se sigue la referencia una
               sola vez: si esa celda tampoco trae una URL, se deja pasar. */
            const ref = /^\s*=?\s*HYPERLINK\s*\(\s*\$?([A-Z]{1,3})\$?(\d{1,7})\s*[;,)]/i.exec(f);
            if (ref) {
              try {
                const v = String(hoja.getRange(ref[1] + ref[2]).getValue() || '').trim();
                if (/^https?:\/\//i.test(v)) u = v;
              } catch (err) { /* referencia a otra hoja o rango raro: se ignora */ }
            }
          }
        }
        if (u) porFila[n] = u;
      }
      urls[c.nombre] = porFila;
    });
  }

  const tz = libro.getSpreadsheetTimeZone() || 'America/Mexico_City';
  const encabezados = cols.map(function (c) { return c.nombre; });
  const filas = [], ligas = {};
  let saltadas = 0;

  for (let n = 0; n < alto; n++) {
    const cruda = valores[hr + 1 + n];
    const fila = cols.map(function (c) { return limpia(cruda[c.i], tz); });
    /* Se barre hasta el final del rango, no hasta el primer hueco: en el maestro
       hay 212 casas seguidas y dos más cientos de renglones abajo. Pero un
       renglón enteramente vacío no se manda. */
    if (fila.every(function (v) { return v === '' || v === null; })) { saltadas++; continue; }

    const iSalida = filas.length;
    filas.push(fila);
    cols.forEach(function (c, ci) {
      const u = urls[c.nombre] && urls[c.nombre][n];
      if (u) {
        if (!ligas[iSalida]) ligas[iSalida] = {};
        ligas[iSalida][ci] = u;
      }
    });
  }

  return {
    ok: true,
    hoja: HOJA,
    filaEncabezados: hr + 1,
    actualizado: Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    encabezados: encabezados,
    filas: filas,
    ligas: ligas,
    faltan: faltan,
    renglonesVacios: saltadas
  };
}

/**
 * Las fechas salen ya escritas dd/mm/aaaa con la zona del Sheet, no como número
 * ni como fecha con hora: JSON no tiene fechas, y mandarlas en crudo es la
 * receta para que un desalojo del día 1 aparezca el último día del mes anterior.
 * Los booleanos salen como SÍ/NO, igual que los trae el lector de Excel, para
 * que el tablero no tenga que distinguir de dónde vino el dato.
 */
function limpia(v, tz) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'dd/MM/yyyy');
  if (typeof v === 'boolean') return v ? 'SÍ' : 'NO';
  if (typeof v === 'number') return v;
  return String(v).trim();
}

/**
 * Para probar sin salir del editor: córrela y mira el registro. Debe decir
 * cuántas casas leyó y cuántas ligas encontró. Si dice que faltan columnas, son
 * los nombres que hay que revisar en COLUMNAS.
 */
function probar() {
  const r = leerMaestro();
  if (!r.ok) { Logger.log('FALLÓ: ' + r.error + ' — ' + r.mensaje); return; }
  Logger.log('casas: ' + r.filas.length);
  Logger.log('encabezados en la fila ' + r.filaEncabezados);
  Logger.log('columnas que salen: ' + r.encabezados.join(' · '));
  if (r.faltan.length) Logger.log('NO ENCONTRÉ estas columnas: ' + r.faltan.join(' · '));
  Logger.log('renglones con al menos una liga: ' + Object.keys(r.ligas).length);
  Logger.log('renglones vacíos saltados: ' + r.renglonesVacios);
  if (r.filas.length) Logger.log('primera casa: ' + JSON.stringify(r.filas[0]));
}
