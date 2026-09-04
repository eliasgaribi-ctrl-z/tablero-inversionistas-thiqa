# Las tipografías

Dos familias, las mismas que usa el [Generador de Fichas THIQA](https://github.com/eliasgaribi-ctrl-z/generador-fichas-thiqa):

| Familia | Para qué | Archivos |
|---|---|---|
| **Outfit** | títulos y cifras | `outfit-latin.woff2`, `outfit-latin-ext.woff2` |
| **Figtree** | texto corrido | `figtree-latin.woff2`, `figtree-latin-ext.woff2` |

Las dos vienen de Google Fonts y se distribuyen bajo la **SIL Open Font License 1.1**, que permite
usarlas, redistribuirlas y empaquetarlas con un proyecto. El texto de la licencia está en
<https://openfontlicense.org> y en la ficha de cada familia en <https://fonts.google.com>.

## Por qué están aquí dentro y no colgadas de Google

Porque el tablero se abre en juntas donde el internet no siempre coopera, y porque las hojas se
imprimen: una hoja que sale con la tipografía equivocada no es la misma hoja. Con los archivos
dentro del repositorio la app funciona igual sin conexión, y además no le avisa a nadie más cada
vez que alguien la abre.

Van en dos pedazos por familia —`latin` y `latin-ext`— con su `unicode-range`, que es como los
sirve Google: el navegador baja nada más el que necesita. Los acentos del español caen en `latin`,
así que casi siempre se baja un solo archivo por familia.

Si un navegador no puede cargarlas, la app se ve con la tipografía del sistema y todo sigue
funcionando: cada `font-family` lleva su respaldo.
