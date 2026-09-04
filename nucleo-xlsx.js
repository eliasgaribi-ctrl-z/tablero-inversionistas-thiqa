/* ============================================================
   Lector de XLSX/CSV nativo — sin librerías, sin internet
   ------------------------------------------------------------
   Copiado sin cambios del generador de fichas THIQA
   (github.com/eliasgaribi-ctrl-z/generador-fichas-thiqa), donde
   lleva 214 domicilios leídos. Un .xlsx es un ZIP de XML: aquí se
   abre el ZIP a mano, se descomprime con DecompressionStream —que
   ya trae el navegador— y se leen los XML con DOMParser. Eso es lo
   que permite que la app sea un archivo estático: no hay nada que
   instalar ni servidor al que subir el archivo.

   Lo importante para este tablero: las ligas de una celda NO viven
   en la celda. Google Sheets las exporta de dos maneras distintas y
   aquí se leen las dos, porque de ahí salen las carpetas de Drive
   del expediente y de los tapeos.
   ============================================================ */
(function(){

/* ============================================================
   1 · Lector de XLSX nativo (ZIP + XML), sin librerías
   ============================================================ */
const XLSXReader = (() => {
  const HOJA_RELS = ruta => ruta.replace(/([^/]+)$/, '_rels/$1.rels');
  const u16 = (dv,o) => dv.getUint16(o,true);
  const u32 = (dv,o) => dv.getUint32(o,true);

  async function inflateRaw(bytes){
    if (typeof DecompressionStream === 'undefined') throw new Error('NAV_VIEJO');
    const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }

  async function unzip(buffer){
    const dv = new DataView(buffer), bytes = new Uint8Array(buffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--)
      if (u32(dv,i) === 0x06054b50){ eocd = i; break; }
    if (eocd < 0) throw new Error('NO_ZIP');
    const count = u16(dv, eocd + 10), cdOfs = u32(dv, eocd + 16);
    if (cdOfs === 0xFFFFFFFF || count === 0xFFFF) throw new Error('ZIP64');

    const files = {};
    let p = cdOfs;
    for (let n = 0; n < count; n++){
      if (u32(dv,p) !== 0x02014b50) break;
      const method = u16(dv,p+10), compSize = u32(dv,p+20);
      const nameLen = u16(dv,p+28), extraLen = u16(dv,p+30), cmtLen = u16(dv,p+32);
      const localOfs = u32(dv,p+42);
      const name = new TextDecoder('utf-8').decode(bytes.subarray(p+46, p+46+nameLen));
      const dataStart = localOfs + 30 + u16(dv,localOfs+26) + u16(dv,localOfs+28);
      files[name] = { method, raw: bytes.subarray(dataStart, dataStart + compSize) };
      p += 46 + nameLen + extraLen + cmtLen;
    }
    return {
      names: Object.keys(files),
      async text(name){
        const f = files[name]; if (!f) return null;
        const out = f.method === 0 ? f.raw : await inflateRaw(f.raw);
        return new TextDecoder('utf-8').decode(out);
      }
    };
  }

  const xml = s => new DOMParser().parseFromString(s, 'application/xml');

  function colToIdx(ref){
    let n = 0;
    for (let i = 0; i < ref.length; i++){
      const c = ref.charCodeAt(i);
      if (c < 65 || c > 90) break;
      n = n * 26 + (c - 64);
    }
    return n - 1;
  }

  const BUILTIN_DATE = new Set([14,15,16,17,18,19,20,21,22,27,30,36,45,46,47,50,57]);
  /* El número de serie de Excel es un día del calendario, no un instante: el
     45901 es "1 de septiembre", punto. Armar la fecha en UTC y luego leerla con
     getDate() —que es hora local— la corría un día hacia atrás en cualquier huso
     al oeste de Greenwich, México incluido: un desalojo del día 1 salía impreso
     el último día del mes anterior. Se arma en local para que el día que se lee
     sea el día que trae el archivo, en el huso que sea. */
  const serialToDate = v => {
    const u = new Date(Math.round((v - 25569) * 86400000));
    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(),
                    u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
  };

  async function parse(buffer){
    const zip = await unzip(buffer);

    const relsTxt = await zip.text('xl/_rels/workbook.xml.rels');
    const rels = {};
    if (relsTxt) for (const r of xml(relsTxt).getElementsByTagName('Relationship')){
      let t = r.getAttribute('Target') || '';
      if (t.startsWith('/')) t = t.slice(1);
      else if (!t.startsWith('xl/')) t = 'xl/' + t.replace(/^\.\//,'');
      rels[r.getAttribute('Id')] = t;
    }

    const wbTxt = await zip.text('xl/workbook.xml');
    const sheets = [];
    if (wbTxt) for (const s of xml(wbTxt).getElementsByTagName('sheet')){
      const rid = s.getAttribute('r:id') ||
        s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
      sheets.push({ name: s.getAttribute('name'), path: rels[rid] });
    }
    if (!sheets.length) zip.names.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .forEach((n,i) => sheets.push({ name:'Hoja ' + (i+1), path:n }));
    /* Un ZIP que se abre pero no trae hojas no es un .xlsx: es un .ods o un .zip
       con otra cosa adentro, renombrado. Sin esto reventaba más adelante con
       "Cannot read properties of undefined (reading 'path')" —un mensaje de
       programador— en lugar de la guía que la app ya tiene escrita para NO_ZIP. */
    if (!sheets.length) throw new Error('NO_ZIP');

    const ssTxt = await zip.text('xl/sharedStrings.xml');
    const shared = [];
    if (ssTxt) for (const si of xml(ssTxt).getElementsByTagName('si')){
      let s = '';
      for (const t of si.getElementsByTagName('t')) s += t.textContent;
      shared.push(s);
    }

    const stTxt = await zip.text('xl/styles.xml');
    const isDateStyle = [];
    if (stTxt){
      const d = xml(stTxt), custom = {};
      /* Sólo los del bloque <numFmts>, que son los que las celdas usan de veras.
         Barrer todo styles.xml metía también los <numFmt> de <dxfs> —los del
         formato condicional y los estilos de tabla—, que traen su propio
         numFmtId y, al leerse después, pisaban el mapa. Con un dxf que declare
         un formato de fecha bajo un id que ya usan las celdas normales, la
         columna de MONTO ACORDADO se pintaba como fechas y las sumas se iban a
         cero sin un solo aviso. */
      const nfs = d.getElementsByTagName('numFmts')[0];
      if (nfs) for (const nf of nfs.getElementsByTagName('numFmt')){
        const code = nf.getAttribute('formatCode') || '';
        custom[nf.getAttribute('numFmtId')] =
          /[dmyhs]/i.test(code.replace(/\[[^\]]*\]/g,'').replace(/"[^"]*"/g,''));
      }
      const xfs = d.getElementsByTagName('cellXfs')[0];
      if (xfs) for (const xf of xfs.getElementsByTagName('xf')){
        const id = xf.getAttribute('numFmtId');
        isDateStyle.push(custom[id] !== undefined ? custom[id] : BUILTIN_DATE.has(+id));
      }
    }

    /* Los enlaces viven fuera de la celda: <hyperlink ref="H2" r:id="rId3"/>
       apunta al rels de la hoja, que guarda la URL real. Sin esto se pierden
       las ligas de Maps y de Drive que trae el Sheet. */
    async function leerLigas(path){
      const rTxt = await zip.text(HOJA_RELS(path));
      if (!rTxt) return null;
      const url = {};
      for (const r of xml(rTxt).getElementsByTagName('Relationship'))
        url[r.getAttribute('Id')] = r.getAttribute('Target') || '';
      return url;
    }

    const cache = {};
    async function readSheet(idx){
      if (cache[idx]) return cache[idx];
      const txt = await zip.text(sheets[idx].path);
      if (!txt) return [];
      const doc = xml(txt), rows = [], fcols = new Set(), links = [];
      for (const row of doc.getElementsByTagName('row')){
        const r = (+row.getAttribute('r') || rows.length + 1) - 1;
        const arr = rows[r] || (rows[r] = []);
        for (const c of row.getElementsByTagName('c')){
          const ref = c.getAttribute('r') || '';
          const ci = ref ? colToIdx(ref) : arr.length;
          const t = c.getAttribute('t'), s = c.getAttribute('s');
          let val = null;
          if (t === 'inlineStr'){
            let s2 = '';
            for (const n of c.getElementsByTagName('t')) s2 += n.textContent;
            val = s2;
          } else {
            const v = c.getElementsByTagName('v')[0];
            if (v){
              const raw = v.textContent;
              if (t === 's')        val = shared[+raw] ?? '';
              else if (t === 'b')   val = raw === '1' ? 'SÍ' : 'NO';
              else if (t === 'e')   val = '';
              else if (t === 'str') val = raw;
              else {
                const num = parseFloat(raw);
                if (!isNaN(num) && s !== null && isDateStyle[+s] && num > 1) val = serialToDate(num);
                else val = isNaN(num) ? raw : num;
              }
            }
          }
          /* Google Sheets no exporta sus ligas como hipervínculo de Excel: las
             deja dentro de la celda, como =HYPERLINK("url","texto"), y en el
             <hyperlink> de la hoja no queda nada. En la bitácora maestra eso son
             214 carpetas de Drive y 142 mapas que se perdían enteros. La celda
             sólo guarda el texto que se ve ("BNC_HSBC_040"), así que la URL hay
             que sacarla de la fórmula. Las comillas dobles van escapadas dobles
             dentro de la fórmula, como en Excel. */
          const f = c.getElementsByTagName('f')[0];
          if (f){
            const m = /^\s*HYPERLINK\s*\(\s*"((?:[^"]|"")*)"/i.exec(f.textContent || '');
            if (m) (links[r] || (links[r] = []))[ci] = m[1].replace(/""/g, '"');
          }
          if ((val === null || val === '') && c.getElementsByTagName('f').length) fcols.add(ci);
          arr[ci] = val;
        }
      }
      for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];

      const url = await leerLigas(sheets[idx].path);
      if (url) for (const h of doc.getElementsByTagName('hyperlink')){
        const rid = h.getAttribute('r:id') ||
          h.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
        const dest = url[rid];
        if (!dest) continue;
        const ref = (h.getAttribute('ref') || '').split(':')[0];
        const m = /^([A-Z]+)(\d+)$/.exec(ref);
        if (!m) continue;
        const ri = +m[2] - 1;
        (links[ri] || (links[ri] = []))[colToIdx(m[1])] = dest;
      }

      rows.__fcols = fcols;
      rows.__links = links;
      return (cache[idx] = rows);
    }

    return { sheets: sheets.map(s => s.name), readSheet };
  }
  return { parse };
})();

/* Un solo recorrido, con el separador ya decidido. Se saca aparte para poder
   correrlo dos veces —con coma y con punto y coma— y quedarse con el que de
   veras parte el archivo en columnas. */
function recorreCSV(text, sep){
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    if (q){
      if (ch === '"'){
        /* Comilla doble = comilla literal. Una sola cierra el campo, pero si
           lo que sigue no es separador ni fin de renglón, la celda traía la
           comilla a media palabra ("LOTE 12\" NORTE") y hay que seguirla
           acumulando como texto en lugar de partir la fila ahí. */
        if (text[i+1] === '"'){ cell += '"'; i++; }
        else q = false;
      } else cell += ch;
    }
    /* Las comillas sólo abren al principio del campo. Antes, una comilla suelta
       a media celda —una medida, unas pulgadas— abría modo entrecomillado y ya
       no se cerraba nunca: el resto del archivo entero se metía en esa celda y
       las casas de abajo desaparecían sin error ni aviso. */
    else if (ch === '"' && cell === '') q = true;
    else if (ch === sep){ row.push(cell); cell = ''; }
    else if (ch === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length){ row.push(cell); rows.push(row); }
  return rows;
}

function parseCSV(text){
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  /* El separador no se adivina contando en la primera línea: esa línea puede
     ser un título ("Reporte de casas; corte al 30 de junio") o parte de un
     campo de varios renglones, y un solo punto y coma ahí hacía que un archivo
     de comas se leyera con punto y coma — con lo que cada fila entera quedaba
     en una sola columna y el emparejador no encontraba nada.

     Se parte de verdad con los dos y gana el que dé más columnas de forma
     consistente en las primeras filas. */
  const puntaje = sep => {
    const r = recorreCSV(text, sep).slice(0, 6).filter(f => f.length);
    if (!r.length) return 0;
    const anchos = r.map(f => f.length);
    const max = Math.max(...anchos);
    if (max < 2) return 0;
    /* Cuántas de las primeras filas coinciden con el ancho más común: un
       separador correcto parte parejo, uno equivocado deja anchos dispares. */
    const iguales = anchos.filter(n => n === max).length;
    return max * 100 + iguales;
  };
  const sep = puntaje(';') > puntaje(',') ? ';' : ',';
  return recorreCSV(text, sep);
}

window.XLSXReader = XLSXReader;
window.parseCSV = parseCSV;

})();
