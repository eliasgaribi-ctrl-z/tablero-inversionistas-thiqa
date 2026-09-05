/**
 * config.js — lo único que se toca a mano en todo el proyecto
 * ---------------------------------------------------------------------------
 * El tablero es una página estática y se comparte con los inversionistas. Aquí
 * va lo único que la página necesita saber de antemano: a qué dirección pedirle
 * las casas. La clave NO va aquí.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE NUNCA SE ESCRIBE EN ESTE ARCHIVO
 *
 * Este repositorio es público y lo van a leer los mismos inversionistas. Lo que
 * se escriba aquí lo puede leer cualquiera que abra el código de la página, y
 * además queda en el historial de Git para siempre, aunque después se borre.
 *
 * Por eso aquí NO van:
 *   · Las claves de acceso. Viven en la lista ACCESOS del Apps Script, que está
 *     en la cuenta de Google de THIQA. Cada persona escribe la suya en la
 *     pantalla de bloqueo del tablero, una vez, y se le queda guardada en su
 *     navegador.
 *   · El ID del Sheet. El maestro se abre desde Drive, no desde el tablero.
 *
 * Que la dirección de abajo sea pública no es un descuido: sin una clave de la
 * lista, esa dirección no contesta un solo dato.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ HAY QUE HACER, UNA VEZ EN LA VIDA
 *
 * 1. Publica `apps-script/Sincronizar.gs` como aplicación web desde
 *    script.google.com, con la cuenta que tiene acceso al maestro. Las
 *    instrucciones completas están escritas en ese archivo.
 * 2. Da de alta los accesos en su lista ACCESOS — una clave larga y un nombre
 *    por persona—, ahí en el editor de Apps Script.
 * 3. Copia la dirección que termina en /exec y pégala abajo, en SYNC_URL.
 * 4. Reparte una clave por persona. Cada quien la escribe en la pantalla de
 *    bloqueo y ya no vuelve a capturar nada.
 *
 * Mientras SYNC_URL esté vacío el tablero no pide clave: se queda en el camino
 * de subir el Excel a mano, que es el que se usa para trabajar en local.
 * ---------------------------------------------------------------------------
 */
window.THIQA_CONFIG = {

  /* La dirección de la aplicación web del script, la que termina en /exec.
     Vacío = el tablero no pide clave y sólo funciona con archivos a mano. */
  SYNC_URL: 'https://script.google.com/macros/s/AKfycbyxQoOff4LZL4aKVMpmC5EUh5KuA9cjHGRp6KTND5Ls2om6nM1mwGng0Gn1V5K9UauBfQ/exec',

  /* Carteras que el tablero no dibuja, por su grupo y no por el nombre largo del
     maestro: PIC · INFONAVIT · BANCARIA · OTRAS · SIN.

     Va vacía a propósito, y es importante entender por qué. Quién ve qué lo
     decide el Apps Script, con la lista ACCESOS: a un inversionista no le manda
     la cartera bancaria, punto. Si además se apagara aquí, habría dos filtros
     decidiendo lo mismo y no siempre lo mismo — y el día que alguien entre con
     el acceso de THIQA para revisar que el filtro sirve, vería el tablero
     vacío de casas bancarias y creería que el script las está mandando bien
     cuando a lo mejor no. Un solo lugar decide.

     Sirve para una cosa nada más: si vas a proyectar en una junta un Excel que
     subiste A MANO —ahí no pasa por el script— y no quieres que salga una
     cartera. Para eso, ponla: ['BANCARIA'] */
  CARTERAS_OCULTAS: [],
};
