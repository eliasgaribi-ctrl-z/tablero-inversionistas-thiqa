# Dos archivos para probar la app sin datos reales

| Archivo | Qué es |
|---|---|
| `maestro-de-ejemplo.xlsx` | 214 casas, como el maestro de remates |
| `tapeados-de-ejemplo.xlsx` | 15 renglones de tapeo, como el Excel del área de obras |

**Los datos son inventados.** Los nombres, los domicilios, los folios y los montos no corresponden
a ninguna casa; las ligas de Drive apuntan a carpetas que no existen. Lo único de verdad es la
**forma** del archivo, y ahí sí están reproducidas las mañas del maestro real, porque son las que
rompen a los programas que lo leen:

- **Dos casas huérfanas hasta abajo.** 212 casas en renglones seguidos y dos más cientos de
  renglones después. Un programa que se detiene en la primera fila vacía las pierde.
- **El folio es una fórmula** que espeja la columna de al lado, con su valor en caché.
- **Una columna de fórmula que llegó sin calcular** —`TOTAL CALCULADO`—, que es lo que pasa cuando
  el Sheet se exporta sin recalcular. La app lo detecta y lo dice.
- **Las ligas de las dos formas**: la del expediente y la del mapa como fórmula
  `=HYPERLINK("…";"…")` con **punto y coma**, que es como las escribe el Sheet en locale español; y
  las carpetas de tapeo y evidencias como hipervínculo nativo de Excel, que vive fuera de la celda.
- **A 43 de las ligas les cuelga `?usp=drive_link`** —una de cada cinco de las que van por
  fórmula—, para que se vea que el código QR lo recorta y todos salen del mismo tamaño.
- **La dirección llega pegada** (`AVTEMUCO100SANTAFE45653TLAJOMULCO`) y a veces con la cola
  catastral (`NA MZ 17 LT 39 EDIF NA NIV 03`). La dirección legible está en la columna del link.
- **`LOMAS ` con espacio al final**, en la colonia.
- **Dos casas del mismo número que sólo se distinguen por la letra**: `Monte Cabra 178 D` y
  `178 E`. Son dos casas, y el gasto de una no debe salir sumado en la otra.
- **`ADEUDO_PREDIAL` mezcla números con el texto «Cuenta al corriente»**, que rompe cualquier suma
  directa.
- **Los ocho estatus de ruta del catálogo**, repartidos entre las 214 casas: 85 recuperadas,
  29 próximas
  recuperaciones y 100 que no suman.
- **Una pestaña señuelo** (`Catalogo_Carteras`) antes de la buena, para que la app tenga que
  escoger la hoja.

En el de tapeados, lo mismo: la **pestaña de comprobantes de pago va primero** y trae «MATERIAL» y
«Dirección», suficiente para pasar por encabezado. La buena es la segunda, con los encabezados en
el renglón 3 y la primera columna vacía en todos los renglones. Una casa aparece **dos veces**
—tapeo y retapeo—, y las direcciones están escritas como las escribe obras: en mayúsculas, sin
colonia y a veces con la manzana pegada (`AV TEMUCO 100 M-1`).

## Cómo probarlo

> El tablero pide clave al abrir. Estas pruebas son de la carga **a mano**, así que primero hay
> que entrar; o, si estás trabajando en local, deja `SYNC_URL` vacío en `config.js` y la pantalla
> de bloqueo no aparece.

1. Sube `maestro-de-ejemplo.xlsx`. La app abre en el **Resumen**.
2. En el Resumen deben salir las **214 casas del archivo**, repartidas en PIC, Infonavit y
   Bancaria. Un archivo que se sube a mano no pasa por el Apps Script, así que no hay filtro de
   acceso: llega tal cual. El filtro por cartera vive en el script y se prueba desde allá, con la
   función `probar`.
3. Sube `tapeados-de-ejemplo.xlsx` desde *«¿Prefieres subir los archivos a mano?»*. Debe decir
   **14 viviendas con tapeo, de la pestaña Calendario de Obra** —si dice otra pestaña, algo se
   rompió—.
4. En Ajustes, captura un honorario fijo (por ejemplo 6000). La columna *Honorarios + bono* se
   completa y el tablero marca las cifras como **calculadas**.
5. En el Tablero, con la pestaña en **Todas**, deben salir **85 recuperadas** y, aparte, **29
   próximas recuperaciones**. Nunca sumadas juntas: ésas son las cifras del archivo completo.
