/**
 * Sincronizar.gs — le sirve el maestro al Tablero de Inversionistas THIQA
 * ---------------------------------------------------------------------------
 * Va en un proyecto de Apps Script APARTE, no pegado al Sheet (el porqué está
 * más abajo). Publica una dirección web que devuelve las casas en JSON, y el
 * tablero la consume. Así no hay que bajar el Excel a mano.
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
 * Y sólo salen las casas que le tocan a quien pregunta. Ésa es la otra mitad,
 * y es la importante desde que el repositorio se comparte con los
 * inversionistas: la lista ACCESOS dice quién entra, y de cada acceso, qué
 * carteras se lleva. **La cartera bancaria no sale para un inversionista**, y
 * no porque el tablero la esconda al dibujar —eso se ve en las herramientas del
 * navegador— sino porque no viaja: se queda aquí.
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
 * 3. Da de alta los accesos en la lista ACCESOS de abajo: una clave larga y un
 *    nombre por cada persona que va a entrar al tablero. **Las claves se
 *    escriben aquí y en ningún otro lado** — no en el repositorio, que es
 *    público. Mientras la lista esté vacía el script no contesta nada.
 * 4. Guarda, y corre una vez la función `probar` para autorizarlo: Google va a
 *    pedir permiso para leer tus hojas de cálculo y hay que dárselo. La primera
 *    vez sale una pantalla de "Google no ha verificado esta aplicación" →
 *    *Configuración avanzada* → *Ir a (nombre del proyecto)*. Es tu propio
 *    script; esa pantalla sale siempre con los que uno escribe.
 * 5. **Implementar → Nueva implementación** → tipo *Aplicación web*, con:
 *    (Ésta es la ÚNICA vez que se usa "Nueva implementación". De aquí en
 *    adelante, para cualquier cambio, es "Administrar implementaciones" — ver
 *    abajo.)
 *        Ejecutar como:      Yo (remates@thiqa.mx)
 *        Quién tiene acceso: Cualquier usuario
 *    Copia la dirección que termina en `/exec`.
 * 6. Pega esa dirección en el archivo `config.js` del repositorio, en
 *    `SYNC_URL`. **La clave no va ahí.** La escribe cada persona en la pantalla
 *    de bloqueo del tablero, y se queda guardada en su navegador.
 * 7. Reparte una clave por persona, por un medio donde no quede a la vista de
 *    otros. Cada quien la escribe una vez y ya no vuelve a capturar nada.
 *
 * **Guardar no es publicar, y publicar no es "Nueva implementación".** Cada vez
 * que cambies este archivo —sobre todo al dar de baja un acceso— hay que hacer:
 *
 *     Implementar → **Administrar implementaciones** → el lápiz de la que ya
 *     existe → Versión: **Nueva versión** → Implementar.
 *
 * Si le das a "Nueva implementación" sale una dirección nueva que no le pega a
 * nadie, y la de siempre se queda contestando con la lista vieja: el acceso que
 * acabas de borrar sigue entrando. No avisa de ninguna manera.
 *
 * ---------------------------------------------------------------------------
 * SOBRE "CUALQUIER USUARIO" Y LAS CLAVES
 *
 * "Cualquier usuario" es la única opción que sirve, porque una página estática
 * no puede firmarse con Google. La dirección, entonces, la puede abrir
 * cualquiera — y está bien, porque sin una clave de la lista no contesta un solo
 * dato. Lo que hay que cuidar es esto:
 *
 *   · **Las claves no se escriben en el repositorio.** Ni aquí en la copia que
 *     se sube, ni en `config.js`. Se capturan en el editor de Apps Script, que
 *     vive en tu cuenta. Una clave commiteada queda en el historial de Git para
 *     siempre, aunque después se borre del archivo.
 *   · Una clave por persona. Así se quita el acceso de una sin tocar los demás:
 *     borras su renglón y publicas una nueva versión.
 *   · Del Sheet sale lo mínimo, nunca datos de personas, y nunca casas de una
 *     cartera que no le toque a ese acceso.
 *   · Las carpetas de Drive del expediente deben estar compartidas como **"sólo
 *     personas invitadas"**. Si estuvieran como "cualquiera con el enlace", la
 *     liga que sale de aquí abriría los PDFs a quien la tenga.
 *   · Si una clave se sale de las manos: borra su renglón, publica una nueva
 *     versión y dale una nueva a esa persona. La anterior muere en ese momento.
 */

/* ═════════════════════════════════════════════════════════════════════════
   LOS ACCESOS — quién entra al tablero y qué le toca ver
   ═════════════════════════════════════════════════════════════════════════

   ESTA LISTA ES EL CANDADO. La pantalla de bloqueo del tablero no decide nada:
   nada más pregunta la clave y se la manda aquí. Quien no aparezca en esta
   lista no recibe una sola casa, por más que abra el código de la página o le
   pegue directo a esta dirección.

   LAS CLAVES DE VERDAD NO SE ESCRIBEN EN EL REPOSITORIO. Este archivo es
   público y lo van a poder leer los mismos inversionistas. Las claves se
   capturan **nada más aquí, en el editor de Apps Script**, que vive en tu
   cuenta de Google. Lo que se sube al repositorio se queda con la lista vacía y
   el renglón de ejemplo comentado.

   PARA DAR UN ACCESO: agrega un renglón con una clave larga —de veras larga,
   treinta caracteres o más, y que no se pueda adivinar sabiendo quién es la
   persona— y el nombre de a quién se la diste. Publica (ver abajo) y pásale la
   clave a esa persona.

   PARA QUITARLO: borra su renglón y publica. Ese acceso muere en ese momento, y
   los demás no se enteran.

   PUBLICAR ES ESTE CAMINO Y NO OTRO:
     Implementar → **Administrar implementaciones** → el lápiz de la que ya
     existe → Versión: **Nueva versión** → Implementar.

   NO es "Nueva implementación". Ése crea una dirección NUEVA que no le pega a
   nadie, y deja la de siempre contestando con la lista vieja de accesos: el que
   acabas de dar de baja sigue entrando, y tú creyendo que ya no. Es el error más
   caro de este archivo y no avisa de ninguna manera.

   LO QUE ESTE CANDADO **NO** PUEDE TAPAR, Y HAY QUE SABERLO:

   El folio del maestro es el prefijo de la cartera más un consecutivo que corre
   por TODO el archivo, no por cartera: PIC_TLAJO_001, BNC_HSBC_002,
   PIC_TLAJO_003… Cuando el filtro deja fuera una casa, su número se queda vacío
   en la lista del que sí entró. Contar los huecos es contar las casas que no se
   llevó, y restarle a su folio más alto el número de casas que recibió da lo
   mismo de un jalón.

   O sea: un inversionista no puede ver la cartera bancaria, pero sí puede
   deducir CUÁNTAS casas hay que no está viendo. Ver los datos y saber que
   existen no es lo mismo, y esto es lo segundo. Desde el script no se arregla:
   el folio tiene que viajar tal cual porque es el nombre de la carpeta de Drive
   de la casa y el que va escrito en los papeles; mandarlo cambiado dejaría las
   carpetas sin encontrar. Se arregla en el maestro, el día que el consecutivo
   corra por cartera. Mientras tanto, `probar` lo dice en el registro.

   QUÉ VE CADA QUIEN:
     · Sin `carteras`, el acceso ve todo menos las carteras RESERVADAS de abajo
       —que es lo que le toca a un inversionista—.
     · Con `carteras: ['PIC']`, ve nada más las que traigan eso en su nombre.
     · Con `carteras: 'todas'`, ve el maestro completo, la bancaria incluida.
       Ése es tu propio acceso, no el de nadie más.

   Ejemplo de cómo se ve la lista ya con accesos puestos. Las claves de abajo son
   MARCADORES, no claves: están escritas en este archivo, así que el script las
   rechaza a propósito. Invéntate una larga para cada quien.

     const ACCESOS = [
       { clave: 'AQUÍ-VA-LA-CLAVE-DE-THIQA',   nombre: 'Elías (THIQA)', carteras: 'todas' },
       { clave: 'AQUÍ-VA-LA-CLAVE-DEL-UNO',    nombre: 'Inversionista PIC', carteras: ['PIC'] },
       { clave: 'AQUÍ-VA-LA-CLAVE-DEL-DOS',    nombre: 'Inversionista Infonavit',
         carteras: ['PRV_INFVT', 'CART_SOJI'] },
     ];

   PARA INVENTAR UNA CLAVE, sin pensarle: en el editor, pega esto en la consola
   del navegador y usa lo que salga —
     crypto.randomUUID() + crypto.randomUUID()
   Cualquier cosa que se pueda adivinar sabiendo quién es la persona (su nombre
   con el año, la cartera con el año) no sirve: la dirección es pública y quien
   quiera probar claves puede hacerlo todo el día sin que nadie se entere.
   ───────────────────────────────────────────────────────────────────────── */
const ACCESOS = [
  // { clave: 'pon-aquí-una-clave-larga', nombre: 'A quién se la diste' },
];

/**
 * Las carteras que un acceso SIN lista propia sí se puede llevar.
 *
 * Ojo con el sentido de esta lista, porque es lo contrario de lo que uno
 * escribiría de primera intención: aquí NO se apunta lo que se esconde, se
 * apunta lo que se deja pasar. Todo lo que no esté escrito aquí se queda en el
 * Sheet.
 *
 * Es a propósito, y por dos casos que van a pasar:
 *
 *   · Una casa capturada con la columna de la cartera todavía en blanco. Con una
 *     lista de lo prohibido, esa casa no empataba con nada prohibido y se iba
 *     con todos. Con ésta, no empata con nada permitido y se queda.
 *   · Una cartera nueva. El día que entre BANCO_SANTANDER-TLAJO —o la que sea—,
 *     nadie va a acordarse de venir a este archivo a taparla. Con esta lista no
 *     hace falta acordarse: no sale hasta que alguien la escriba aquí, que es
 *     justo el momento de preguntarse si de veras le toca a los inversionistas.
 *
 * Van pedazos del nombre, no el nombre completo, para que renombrar la cartera
 * en el Sheet no deje a nadie sin sus casas de un día para otro.
 */
const CARTERAS_DE_INVERSIONISTA = ['pic', 'prv_infvt', 'cart_soji'];

/**
 * Las carteras que NO salen del Sheet ni aunque un acceso las pida por su
 * nombre. Sólo `carteras: 'todas'` las abre. La bancaria va aquí: este tablero
 * es de las casas que se recuperan para los inversionistas, y esa cartera no es
 * de ellos.
 *
 * Van pedazos del nombre a propósito: si un día en el Sheet le cambian
 * `BNC_HSBC-TLAJO` por `BNC_HSBC_TLAJO` o por `HSBC`, el candado tiene que
 * seguir cerrado. Un nombre exacto se abriría solo con el cambio de nombre, y
 * nadie se daría cuenta hasta que un inversionista viera casas que no son suyas.
 */
const RESERVADAS = ['bnc', 'hsbc'];

/**
 * El largo mínimo de una clave. Esta dirección es pública —tiene que serlo,
 * porque una página estática no puede firmarse con Google—, así que una clave
 * corta se adivina a fuerza de intentos. El script se niega a aceptar claves
 * cortas en lugar de dejarte creer que estás protegido.
 */
const LARGO_MINIMO = 16;

/**
 * Las claves que NUNCA dan acceso, pase lo que pase.
 *
 * Aquí van dos cosas. Las de los ejemplos de este archivo, porque el archivo es
 * público y lo van a leer los mismos inversionistas: si alguien copia el bloque
 * de ejemplo y se le olvida cambiar una clave, lo que tiene que pasar es que ese
 * acceso no funcione, no que le abra la puerta al primero que lea el archivo.
 *
 * Y la clave vieja del tablero, la que estuvo escrita en `config.js` hasta
 * septiembre de 2026. Ésa quedó en el historial de Git de un repositorio
 * público, o sea que la puede sacar cualquiera con un comando. Está apuntada
 * aquí para que no pueda volver a servir ni por descuido: si se da de alta como
 * acceso —porque era la que se usaba y funcionaba—, el script la rechaza.
 */
const CLAVES_DE_FABRICA = [
  'pon-aquí-una-clave-larga',
  'AQUÍ-VA-LA-CLAVE-DE-THIQA',
  'AQUÍ-VA-LA-CLAVE-DEL-UNO',
  'AQUÍ-VA-LA-CLAVE-DEL-DOS',
  'cPwYCnOJ6SzJenL1mB9DrJSmCoEryPm4',
];

/** ¿Es una de las claves que vienen escritas en el repositorio? */
function esDeFabrica(clave) {
  const c = String(clave || '');
  return CLAVES_DE_FABRICA.some(function (f) { return f === c; });
}

/**
 * Busca la clave en la lista. Devuelve el acceso, o null.
 *
 * Se compara siempre contra TODOS los renglones, sin cortar en el primero que
 * empate, para que el tiempo que tarda no delate cuántos accesos hay ni cuál
 * empató.
 */
function buscaAcceso(clave) {
  const c = String(clave || '');
  if (c.length < LARGO_MINIMO) return null;
  if (esDeFabrica(c)) return null;
  let hallado = null, empates = 0;
  for (let i = 0; i < ACCESOS.length; i++) {
    const a = ACCESOS[i];
    const k = String((a && a.clave) || '');
    if (k.length >= LARGO_MINIMO && !esDeFabrica(k) && k === c) { hallado = a; empates++; }
  }
  /* Si la misma clave está en dos renglones no se elige uno: no se abre. Pasa al
     dar de alta a alguien copiando el renglón propio y olvidando cambiar la
     clave — y entonces el que gana es el último escrito, que puede ser el de
     `carteras: 'todas'`. Un empate es un error de captura, y ante un error de
     captura lo seguro es no contestar. `probar` dice cuál renglón repetir. */
  if (empates > 1) return null;
  return hallado;
}

/** ¿Este acceso puede ver una casa de esta cartera? */
function puedeVer(acceso, fuente) {
  const f = norm(fuente);
  if (acceso.carteras === 'todas') return true;
  /* Una casa sin cartera capturada no se va con nadie. Antes pasaba: no empataba
     con nada prohibido, así que se iba con todos los accesos. */
  if (!f) return false;
  /* Lo reservado NO se abre con una lista de carteras: sólo con 'todas', dicho
     con todas sus letras. Es a propósito. Alguien que escriba
     `carteras: ['TLAJO']` pensando en "las de Tlajomulco" se llevaría el maestro
     entero, porque las cuatro carteras traen TLAJO en el nombre — la bancaria
     incluida— y ni siquiera se daría cuenta. Una lista se escribe para acotar,
     nunca para abrir. */
  if (RESERVADAS.some(function (r) { return f.indexOf(norm(r)) >= 0; })) return false;
  const lista = listaDeCarteras(acceso);
  if (lista) return lista.some(function (c) { return f.indexOf(norm(c)) >= 0; });
  /* Sin lista propia, lo que le toca a un inversionista: nada más las carteras
     escritas arriba. Lo que el script no reconoce, no sale. */
  return CARTERAS_DE_INVERSIONISTA.some(function (c) { return f.indexOf(norm(c)) >= 0; });
}

/**
 * La lista de carteras de un acceso, o null si no tiene.
 *
 * Un texto suelto —`carteras: 'PIC'`— vale como lista de una. Escrito así no
 * acotaba nada y el acceso se llevaba de más, que es lo contrario de lo que
 * quiso quien lo escribió; y se parece demasiado a `carteras: 'todas'` como para
 * confiar en que nadie lo va a escribir.
 */
function listaDeCarteras(acceso) {
  const c = acceso && acceso.carteras;
  if (Object.prototype.toString.call(c) === '[object Array]') return c.length ? c : null;
  if (typeof c === 'string' && c && c !== 'todas') return [c];
  return null;
}

/**
 * El número con el que termina un folio: `PIC_TLAJO_007` → 7. Si no termina en
 * número, 0.
 */
function numeroDeFolio(folio) {
  const m = /(\d+)\s*$/.exec(String(folio == null ? '' : folio));
  return m ? Number(m[1]) : 0;
}

/** La pestaña de trabajo del maestro. */
const HOJA = 'Base_Carteras_Asignadas';

/**
 * El maestro, por su ID. Este script va en un proyecto SUELTO —nunca pegado al
 * Sheet, porque el maestro ya tiene su propio Apps Script con su propio doGet y
 * dos no conviven—, así que esto es lo único que le dice a qué libro entrar.
 * Sin esto fallaría con un "no puedo leer la propiedad de null" que no explica
 * nada.
 */
const SHEET_ID = '1J44hMg1grwYKQe13zvyxn5CTzadQ9H86vfR6pre8t3A';

/** El libro: el que contiene al script y, si no hay ninguno, el de arriba. */
function libroMaestro() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SHEET_ID);
}

/**
 * Las únicas columnas que salen del Sheet.
 * Agregar aquí = agregar al tablero. Quitar de aquí = que no salga nunca.
 *
 * Cada renglón trae el nombre con el que sale hacia el tablero y, después, los
 * nombres con los que se busca en el Sheet. Van varios a propósito: el maestro
 * ha renombrado columnas más de una vez —lo que antes era FUENTE hoy es CARTERA,
 * y F. DESALOJO ACORDADA hoy es FECHA DESALOJO— y con una sola lista rígida
 * cualquier cambio de nombre deja el tablero mudo. Con los alias sirve con el
 * maestro de hoy y con el de antes, sin tener que acordarse de cuál es cuál.
 *
 * LO QUE NO ESTÁ AQUÍ NO SALE DEL SHEET, Y ES DELIBERADO: el nombre del
 * acreditado, el número de crédito, la cuenta predial, el juzgado, el número de
 * expediente, el acreedor y las notas no tienen renglón en esta lista, así que
 * no pueden salir del maestro ni por accidente.
 */
const COLUMNAS = [
  { nombre: 'FOLIO THIQA',        busca: ['FOLIO THIQA'] },
  { nombre: 'CARTERA',            busca: ['CARTERA', 'FUENTE'] },
  { nombre: 'ESTATUS RUTA',       busca: ['ESTATUS RUTA'] },
  { nombre: 'CUADRILLA',          busca: ['CUADRILLA'] },
  { nombre: 'NO. RUTA',           busca: ['NO. RUTA'] },
  { nombre: 'DIRECCION',          busca: ['DIRECCION'] },
  { nombre: 'LINK',               busca: ['LINK'] },
  { nombre: 'COLONIA',            busca: ['COLONIA'] },
  { nombre: 'CP',                 busca: ['CP'] },
  { nombre: 'MUNICIPIO',          busca: ['MUNICIPIO'] },
  /* ENTIDAD ya no existe en el maestro y no se pide: dejarla en la lista hacía
     que cada sincronización avisara de una columna faltante, y un aviso que
     sale siempre es un aviso que nadie lee. Todas las casas son de Jalisco. */
  { nombre: 'FECHA DESALOJO',     busca: ['FECHA DESALOJO', 'F. DESALOJO ACORDADA'] },
  { nombre: 'FECHA CONVENIO',     busca: ['FECHA CONVENIO', 'F. CONVENIO FIRMADO'] },
  { nombre: 'MONTO ACORDADO',     busca: ['MONTO ACORDADO'] },
  { nombre: 'CARTA PODER',        busca: ['CARTA PODER'] },
  { nombre: 'MONTO MAXIMO POR CASA', busca: ['MONTO MAXIMO POR CASA'] },
  { nombre: 'MONTO HONORARIOS',   busca: ['MONTO HONORARIOS'] },
  { nombre: 'BONO',               busca: ['BONO'] },

  /* El bloque de obra. Estas seis son la corrección de fondo: el maestro SÍ
     trae lo que se gastó en cada tapeo —material y mano de obra—, y el tablero
     lo estaba ignorando. La mano de obra no se estaba contando en ninguna
     inversión. */
  { nombre: 'NÚMERO DE TAPEO',    busca: ['NÚMERO DE TAPEO', 'NUMERO DE TAPEO'] },
  { nombre: 'FECHA DE TAPEO',     busca: ['FECHA DE TAPEO'] },
  { nombre: 'ELEMENTOS TAPEADOS', busca: ['ELEMENTOS TAPEADOS'] },
  { nombre: 'MATERIAL UTILIZADO', busca: ['MATERIAL UTILIZADO', 'MATERIALES UTILIZADOS'] },
  { nombre: 'GASTO MATERIAL',     busca: ['GASTO MATERIAL', 'GASTO DE MATERIAL', 'COSTO DE MATERIALES'] },
  { nombre: 'GASTO MANO DE OBRA', busca: ['GASTO MANO DE OBRA', 'GASTO DE MANO DE OBRA'] },

  /* Las carpetas del expediente. En el maestro de hoy los materiales de tapeo
     se llaman COMPROBANTES y las evidencias, EVIDENCIA en singular. */
  { nombre: 'EXP. DIGITAL',       busca: ['EXP. DIGITAL'] },
  { nombre: 'CARPETA MATERIALES DE TAPEO', busca: ['COMPROBANTES', 'CARPETA MATERIALES DE TAPEO'] },
  { nombre: 'CARPETA DE EVIDENCIAS',       busca: ['EVIDENCIA', 'EVIDENCIAS', 'CARPETA DE EVIDENCIAS'] },
];

/**
 * Las columnas de las que hay que sacar la URL de la liga, no sólo el texto.
 *
 * Las tres carpetas tienen que estar aquí, y no basta con que estén en COLUMNAS.
 * Son dos listas distintas: COLUMNAS decide QUÉ SALE del Sheet, y ésta decide DE
 * CUÁLES se sigue la liga. Una columna que esté nada más en COLUMNAS manda el
 * texto de la celda —que en COMPROBANTES y EVIDENCIA es una palabra, no una
 * dirección— y la carpeta de Drive se queda en el Sheet. En el tablero eso se ve
 * como el botón punteado de "no hay carpeta", aunque en el maestro sí la haya:
 * la liga nunca salió de aquí.
 */
const CON_LIGA = ['LINK', 'EXP. DIGITAL',
                  'CARPETA MATERIALES DE TAPEO', 'CARPETA DE EVIDENCIAS'];

/* ========================================================================= */

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (!ACCESOS.length) {
      return responde({ ok: false, error: 'sin_accesos',
        mensaje: 'Este script todavía no tiene ningún acceso dado de alta. Agrega un renglón a ' +
                 'la lista ACCESOS y publica una nueva versión.' });
    }
    const acceso = buscaAcceso(p.k);
    /* Una sola respuesta para clave equivocada, clave corta y clave de fábrica.
       Decir cuál de las tres fue le iría diciendo a quien prueba claves qué tan
       cerca va. */
    if (!acceso) {
      return responde({ ok: false, error: 'clave',
        mensaje: 'Esa clave no da acceso al tablero.' });
    }
    const r = leerMaestro(acceso);
    /* Cuántas casas dejó fuera el acceso NO viaja al navegador: ese número le
       diría al inversionista cuántas casas hay que no está viendo. Se calcula
       para que la función `probar` lo revise en el editor, y se quita aquí. */
    delete r.fueraDeAcceso;
    return responde(r);
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

function leerMaestro(acceso) {
  /* Sin acceso no se lee nada. Es el cinturón por si algún día alguien llama a
     esta función desde otro lado del script y se le olvida pasarlo: mejor que
     truene aquí a que devuelva el maestro completo. */
  if (!acceso) return { ok: false, error: 'clave', mensaje: 'Falta el acceso.' };
  const libro = libroMaestro();
  const hoja = libro.getSheetByName(HOJA);
  if (!hoja) {
    /* Los nombres de las demás pestañas NO se mandan en la respuesta: eso le
       enumeraría el maestro a cualquiera con una clave. Quedan en el registro,
       que sólo ve quien abre el editor. */
    Logger.log('No encontré la pestaña "' + HOJA + '". Las que hay: ' +
               libro.getSheets().map(function (h) { return h.getName(); }).join(', '));
    return { ok: false, error: 'hoja',
             mensaje: 'No encontré la pestaña "' + HOJA + '" en el maestro. Corre la función ' +
                      'probar en el editor: ahí sale la lista de pestañas que sí existen.' };
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
  let hr = -1, mejor = -1, mejorN = 0;
  for (let i = 0; i < Math.min(valores.length, 12); i++) {
    const h = valores[i].map(norm);
    /* CARTERA es como se llama hoy; FUENTE es como se llamaba. Se aceptan las
       dos, porque de esta fila depende que se lea el archivo entero. */
    if (h.indexOf('folio thiqa') >= 0 &&
        (h.indexOf('cartera') >= 0 || h.indexOf('fuente') >= 0)) { hr = i; break; }
    let n = 0;
    for (let k = 0; k < COLUMNAS.length; k++)
      if (COLUMNAS[k].busca.some(function (b) { return h.indexOf(norm(b)) >= 0; })) n++;
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
  COLUMNAS.forEach(function (c) {
    /* Se prueban los alias en orden: gana el nombre de hoy, y si no está, el
       de antes. Así el mismo script sirve para el maestro actual y para una
       descarga vieja sin cambiarle una línea. */
    let i = -1;
    for (let k = 0; k < c.busca.length && i < 0; k++) i = cabeza.indexOf(norm(c.busca[k]));
    if (i < 0) faltan.push(c.nombre); else cols.push({ nombre: c.nombre, i: i });
  });
  if (!cols.length) {
    return { ok: false, error: 'columnas',
             mensaje: 'Ninguna de las columnas que busco está en la fila ' + (hr + 1) + '.' };
  }

  /* La columna de la cartera es la que decide qué casa le toca ver a cada
     acceso. Si no aparece —porque la renombraron en el Sheet a algo que no
     está en los alias— no se manda NADA. Es la decisión importante de todo
     este archivo: sin poder separar, lo seguro es no contestar, no contestar
     de más. Un error visible se arregla en diez minutos; un maestro completo
     mandado por error no se puede recoger. */
  const cCartera = cols.filter(function (x) { return x.nombre === 'CARTERA'; })[0];
  if (!cCartera) {
    return { ok: false, error: 'sin_cartera',
             mensaje: 'No encontré la columna de la cartera en la fila ' + (hr + 1) + '. ' +
                      'Sin ella no puedo separar lo que le toca ver a cada acceso, así que no ' +
                      'mando ninguna casa. Revisa cómo se llama esa columna en el Sheet y ' +
                      'agrégale el nombre a los alias de CARTERA en la lista COLUMNAS.' };
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
  let saltadas = 0, fuera = 0;

  for (let n = 0; n < alto; n++) {
    const cruda = valores[hr + 1 + n];
    const fila = cols.map(function (c) { return limpia(cruda[c.i], tz); });
    /* Se barre hasta el final del rango, no hasta el primer hueco: en el maestro
       hay 212 casas seguidas y dos más cientos de renglones abajo. Pero un
       renglón enteramente vacío no se manda. */
    if (fila.every(function (v) { return v === '' || v === null; })) { saltadas++; continue; }

    /* El filtro por acceso, antes de que la casa entre a la respuesta. Va aquí y
       no en el navegador a propósito: escondida en la página, la casa igual
       viajó y se ve en las herramientas del navegador. Lo que no sale de aquí
       no existe para quien está del otro lado. */
    if (!puedeVer(acceso, cruda[cCartera.i])) { fuera++; continue; }

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

  /* `fueraDeAcceso` sale de aquí pero NO llega al navegador: doGet lo borra
     antes de contestar. Existe para que `probar` lo revise en el editor. */
  return {
    ok: true,
    hoja: HOJA,
    acceso: String((acceso && acceso.nombre) || ''),
    fueraDeAcceso: fuera,
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
 * Para probar sin salir del editor: córrela y mira el registro.
 *
 * Corre CADA acceso de la lista y dice cuántas casas le tocan a cada uno. Ése
 * es el número que hay que mirar antes de pasarle una clave a alguien: si un
 * acceso de inversionista trae las 214 en lugar de las 174, la bancaria se está
 * yendo con él.
 */
function probar() {
  if (!ACCESOS.length) {
    Logger.log('No hay accesos dados de alta. Agrega un renglón a ACCESOS.');
    return;
  }
  Logger.log('accesos dados de alta: ' + ACCESOS.length);

  /* Las carteras que hay en el maestro y que este archivo no conoce. Es el aviso
     que evita la sorpresa: el día que entre una cartera nueva, aquí sale, y con
     eso se decide si le toca o no a los inversionistas ANTES de que se vaya con
     ellos. Mientras no esté escrita en CARTERAS_DE_INVERSIONISTA, no sale. */
  const todo = leerMaestro({ nombre: '(revisión)', carteras: 'todas' });
  if (todo.ok) {
    const cCart = todo.encabezados.indexOf('CARTERA');
    if (cCart >= 0) {
      const vistas = {};
      for (let n = 0; n < todo.filas.length; n++)
        vistas[String(todo.filas[n][cCart] || '(sin cartera)')] = true;
      const desconocidas = Object.keys(vistas).filter(function (c) {
        const f = norm(c);
        if (!f) return true;
        if (RESERVADAS.some(function (r) { return f.indexOf(norm(r)) >= 0; })) return false;
        return !CARTERAS_DE_INVERSIONISTA.some(function (k) { return f.indexOf(norm(k)) >= 0; });
      });
      if (desconocidas.length)
        Logger.log('OJO: el maestro trae carteras que este script no conoce, y por eso NO se le ' +
                   'mandan a nadie: ' + desconocidas.join(' · ') + '. Si a los inversionistas les ' +
                   'toca verlas, agrégalas a CARTERAS_DE_INVERSIONISTA; si no, déjalas así.');
    }
  }

  for (let i = 0; i < ACCESOS.length; i++) {
    const a = ACCESOS[i];
    const nombre = String((a && a.nombre) || '(sin nombre)');
    const clave = String((a && a.clave) || '');
    Logger.log('');
    Logger.log('───── ' + nombre);

    /* Las mismas puertas que cierra doGet, dichas aquí para que se vea por qué
       una clave no va a servir ANTES de repartirla. */
    if (clave.length < LARGO_MINIMO) {
      Logger.log('  ¡OJO! Su clave tiene ' + clave.length + ' caracteres y el mínimo son ' +
                 LARGO_MINIMO + '. Este acceso NO va a funcionar.');
      continue;
    }
    if (esDeFabrica(clave)) {
      Logger.log('  ¡OJO! Su clave es una de las que vienen escritas en el repositorio, así que ' +
                 'la sabe cualquiera que abra el archivo. Este acceso NO va a funcionar. ' +
                 'Invéntale una larga.');
      continue;
    }
    let repetida = 0;
    for (let k = 0; k < ACCESOS.length; k++)
      if (String((ACCESOS[k] && ACCESOS[k].clave) || '') === clave) repetida++;
    if (repetida > 1) {
      Logger.log('  ¡OJO! Esta misma clave está en ' + repetida + ' renglones, así que NO abre: ' +
                 'con un empate el script no elige, se niega. Ponle una clave distinta a cada uno.');
      continue;
    }
    if (typeof a.carteras === 'string' && a.carteras !== 'todas')
      Logger.log('  Nota: su `carteras` está escrito como texto suelto. Se entiende como una lista ' +
                 'de una, pero se lee mejor con corchetes: carteras: [\'' + a.carteras + '\']');

    const r = leerMaestro(a);
    if (!r.ok) { Logger.log('  FALLÓ: ' + r.error + ' — ' + r.mensaje); continue; }
    Logger.log('  casas que se lleva: ' + r.filas.length);
    Logger.log('  casas que NO se lleva, por su acceso: ' + r.fueraDeAcceso);

    /* De qué carteras son. Es lo único que de veras delata a la bancaria: dos
       números de tres dígitos se ven razonables aunque uno traiga lo que no
       debe, y la palabra HSBC en este renglón no se puede confundir. */
    const cCart = r.encabezados.indexOf('CARTERA');
    if (cCart >= 0) {
      const cuenta = {};
      for (let n = 0; n < r.filas.length; n++) {
        const c = String(r.filas[n][cCart] || '(sin cartera)');
        cuenta[c] = (cuenta[c] || 0) + 1;
      }
      const nombres = Object.keys(cuenta).sort();
      Logger.log('  de estas carteras: ' +
                 (nombres.length ? nombres.map(function (c) { return c + ' (' + cuenta[c] + ')'; }).join(' · ')
                                 : 'ninguna'));
      const coladas = nombres.filter(function (c) {
        const f = norm(c);
        return RESERVADAS.some(function (rr) { return f.indexOf(norm(rr)) >= 0; });
      });
      if (coladas.length && a.carteras !== 'todas')
        Logger.log('  ¡ALTO! Se le está yendo una cartera reservada: ' + coladas.join(' · ') +
                   '. NO repartas esta clave hasta arreglarlo.');
    }

    /* Lo que el candado no tapa: los huecos del folio. Se dice aquí, antes de
       repartir la clave, porque es lo único que un inversionista podría deducir
       —cuántas casas no está viendo— y más vale saberlo que enterarse después. */
    const cFolio = r.encabezados.indexOf('FOLIO THIQA');
    if (cFolio >= 0 && r.filas.length) {
      let alto = 0;
      const vistos = {};
      for (let n = 0; n < r.filas.length; n++) {
        const num = numeroDeFolio(r.filas[n][cFolio]);
        if (num > 0) { vistos[num] = true; if (num > alto) alto = num; }
      }
      let huecos = 0;
      for (let n = 1; n <= alto; n++) if (!vistos[n]) huecos++;
      if (huecos > 0)
        Logger.log('  OJO: sus folios llegan con ' + huecos + ' huecos, y el más alto es el ' +
                   alto + '. De ahí se puede deducir cuántas casas no está viendo. ' +
                   'Es el consecutivo del maestro, que corre por archivo y no por cartera; ' +
                   'no se arregla desde aquí.');
    }
    Logger.log('  renglones con al menos una liga: ' + Object.keys(r.ligas).length);
    if (r.faltan.length) Logger.log('  NO ENCONTRÉ estas columnas: ' + r.faltan.join(' · '));
    if (i === 0) {
      Logger.log('  encabezados en la fila ' + r.filaEncabezados);
      Logger.log('  columnas que salen: ' + r.encabezados.join(' · '));
      Logger.log('  renglones vacíos saltados: ' + r.renglonesVacios);
    }
    if (r.filas.length) Logger.log('  primera casa: ' + JSON.stringify(r.filas[0]));
  }
}
