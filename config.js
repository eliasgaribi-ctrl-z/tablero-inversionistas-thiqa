/**
 * config.js — lo único que se toca a mano en todo el proyecto
 * ---------------------------------------------------------------------------
 * El tablero está hecho para que el inversionista abra la página y le pique a
 * un botón. Para eso la página necesita saber dos cosas de antemano: a qué
 * dirección le pide las casas y con qué clave. Van aquí, en un solo archivo, en
 * lugar de que cada quien las capture en su navegador.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ HAY QUE HACER, UNA VEZ EN LA VIDA
 *
 * 1. Abre el maestro → Extensiones → Apps Script.
 * 2. Pega ahí el archivo `apps-script/Sincronizar.gs` de este repositorio.
 * 3. Cambia la CLAVE del script por una tuya, larga.
 * 4. Implementar → Nueva implementación → Aplicación web, con
 *       Ejecutar como:      Yo (remates@thiqa.mx)
 *       Quién tiene acceso: Cualquier usuario
 *    Copia la dirección que termina en /exec.
 * 5. Pega esa dirección en SYNC_URL y la clave en SYNC_KEY, aquí abajo.
 * 6. Guarda el archivo y súbelo. Desde ese momento el tablero es un botón.
 *
 * Mientras SYNC_URL esté vacío el tablero sigue funcionando: nada más pide la
 * liga en Ajustes la primera vez, en cada navegador. En cuanto la pongas aquí,
 * deja de preguntar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE HAY QUE SABER ANTES DE PONERLAS
 *
 * Este repositorio es público y el tablero es una página estática. No existe
 * lugar donde esconder una contraseña: lo que se escriba aquí lo puede leer
 * cualquiera que abra el código de la página. En los hechos, poner la dirección
 * y la clave aquí es **publicar** las columnas que manda el script.
 *
 * Es una decisión, no un descuido, y por eso el script manda lo mínimo: folio,
 * cartera, estatus, cuadrilla, ruta, domicilio, fechas, montos y las carpetas.
 * El nombre del acreditado, el número de crédito y el expediente judicial no
 * salen del Sheet ni por accidente.
 *
 * Dos cosas que conviene revisar antes de dejarlo así:
 *   · Que las carpetas de Drive del expediente NO estén compartidas como
 *     "cualquiera con el enlace". Si lo están, quien lea esta página llega a
 *     los PDFs. Con "sólo personas invitadas" la liga pide iniciar sesión y
 *     no sirve de nada a un extraño.
 *   · Si un día se te sale de las manos: cambia la CLAVE en el script, publica
 *     una nueva versión y actualízala aquí. La anterior deja de servir en ese
 *     momento.
 *
 * Si prefieres que no vaya publicado, deja SYNC_URL vacío: el tablero vuelve a
 * pedir la liga una vez por navegador y nada de esto queda en el repositorio.
 * ---------------------------------------------------------------------------
 */
window.THIQA_CONFIG = {

  /* La dirección de la aplicación web del script, la que termina en /exec.
     Vacío = el tablero la pide en Ajustes, como antes. */
  SYNC_URL: '',

  /* La misma clave que pusiste en CLAVE dentro de Sincronizar.gs. */
  SYNC_KEY: '',

  /* El maestro al que apunta todo esto. Sólo se usa para poder abrirlo desde
     el tablero; los datos siempre llegan por el script, nunca de aquí. */
  SHEET_ID: '1J44hMg1grwYKQe13zvyxn5CTzadQ9H86vfR6pre8t3A',
  SHEET_HOJA: 'Base_Carteras_Asignadas',

  /* Carteras que no se muestran en el tablero. Van por su grupo, no por el
     nombre largo del maestro: PIC · INFONAVIT · BANCARIA · OTRAS · SIN.

     BANCARIA (BNC_HSBC-TLAJO) está fuera porque este tablero es de las casas
     que se recuperan para los inversionistas y esa cartera no va en el
     reporte. Sus casas no se cuentan en ninguna cifra ni salen en los
     documentos; el resumen dice cuántas se dejaron fuera, para que el número
     no desaparezca en silencio.

     Para volver a prenderla, deja la lista vacía: [] */
  CARTERAS_OCULTAS: ['BANCARIA'],
};
