# AutoRewarder PC

AutoRewarder PC es la aplicación de Windows que centraliza las búsquedas y tareas de Microsoft Rewards desde una interfaz gráfica. También puede coordinarse con la aplicación móvil para enviar comandos, consultar el estado del teléfono y ejecutar las búsquedas móviles disponibles.

> Versión documentada: **4.4.0**<br>
> Repositorio de esta distribución: [iGlitchOn/AutoRewarder-PC](https://github.com/iGlitchOn/AutoRewarder-PC)

## Qué hace

La aplicación permite:

- Ejecutar búsquedas de Bing para PC y móvil con cantidades configurables.
- Administrar una o varias cuentas de Microsoft Rewards, cada una con su propio perfil de Edge.
- Ejecutar tareas diarias, check-in, noticias y actividades disponibles en Rewards.
- Ejecutar tareas de Visual Search cuando Microsoft las ofrece.
- Consultar puntos actuales, actividad, historial de búsquedas y resultados de cada ejecución.
- Mantener la puntuación actualizada aunque no haya una ejecución activa.
- Vincular un teléfono Android mediante QR o código manual.
- Enviar al teléfono acciones como iniciar búsquedas, detener una ejecución y abrir Bing o Edge.
- Consultar actualizaciones de PC y móvil desde la propia aplicación.
- Ejecutarse de forma visible o con el navegador oculto, según la configuración elegida.
- Programar ejecuciones automáticas y arrancar con Windows si el usuario lo activa.

AutoRewarder no crea puntos ni modifica el saldo directamente. Abre los servicios de Microsoft y registra el resultado que el sitio devuelve. Microsoft puede cambiar límites, tareas, diseños, requisitos regionales o criterios de actividad en cualquier momento.

## Descarga

La versión recomendada se descarga desde la sección de releases:

1. Abre [Releases de AutoRewarder PC](https://github.com/iGlitchOn/AutoRewarder-PC/releases).
2. Entra en la versión que quieras instalar.
3. Descarga `AutoRewarder-Windows-X.Y.Z.zip` para la versión portable o el instalador disponible en esa release.
4. Comprueba que el archivo pertenece al repositorio `iGlitchOn/AutoRewarder-PC`.
5. Si Windows o el antivirus muestran una advertencia, revisa el origen y la suma SHA-256 publicada antes de continuar.

No descargues ejecutables desde enlaces de terceros ni sustituyas archivos dentro de `C:\Program Files\AutoRewarder` sin guardar antes una copia de seguridad.

## Instalación portable

La versión portable no necesita un instalador tradicional. El programa se ejecuta desde la carpeta donde se extrae.

1. Descarga el ZIP de la release.
2. Crea una carpeta propia, por ejemplo `C:\Apps\AutoRewarder`.
3. Extrae todo el contenido del ZIP en esa carpeta.
4. Ejecuta `AutoRewarder.exe`.
5. Si Windows muestra SmartScreen, verifica que descargaste la release oficial antes de elegir **Más información** y continuar.

La configuración no se guarda necesariamente dentro del ZIP. En Windows se guarda normalmente en:

```text
C:\Users\<usuario>\AppData\Local\AutoRewarder
```

Por eso puedes actualizar el programa portable sin borrar las cuentas ni el historial, siempre que no elimines esa carpeta de configuración.

## Instalación con instalador

1. Cierra cualquier instancia abierta de AutoRewarder.
2. Ejecuta el instalador de la release.
3. Acepta la carpeta de destino.
4. Finaliza la instalación.
5. Abre AutoRewarder desde el acceso directo.

La instalación incluye los archivos necesarios para ejecutar la interfaz y el motor de automatización. Microsoft Edge debe estar instalado y la cuenta debe poder iniciar sesión normalmente en Bing y Microsoft Rewards.

## Primer inicio, paso a paso

### 1. Agregar una cuenta

1. Abre **Accounts** o **Cuentas**.
2. Pulsa **Add account**.
3. Escribe una etiqueta para identificar la cuenta.
4. Completa el inicio de sesión de Microsoft en la ventana de Edge.
5. Espera a que termine la configuración inicial.
6. Comprueba que la cuenta aparece seleccionada en la ventana principal.

Cada cuenta usa un perfil de Edge separado. No cierres manualmente esa ventana durante la configuración inicial.

### 2. Elegir cantidades

En la pantalla principal puedes establecer por separado:

- Búsquedas de PC.
- Búsquedas móviles.
- Tareas diarias.
- Visual Search, cuando esté disponible.

Los límites efectivos dependen de la cuenta, el país, el dispositivo y el estado de Microsoft Rewards. Si Rewards ya completó una categoría, AutoRewarder no puede forzar puntos adicionales.

### 3. Hacer una primera prueba

Para la primera ejecución se recomienda:

1. Mantener **Hide browser** desactivado.
2. Usar una cantidad pequeña de búsquedas.
3. Pulsar **Start**.
4. Observar el registro y comprobar que Edge abre la cuenta correcta.
5. Pulsar **Stop** solo si quieres detener esa ejecución.

**Stop** detiene la ejecución actual. No debe cerrar toda la aplicación ni borrar la cuenta.

## Uso diario

### Ejecutar búsquedas

1. Selecciona la cuenta.
2. Revisa las cantidades de PC y móvil.
3. Pulsa **Start**.
4. Deja que termine la sesión o usa **Stop** para detenerla manualmente.

El motor utiliza la lista de consultas incluida en el proyecto, pausas variables, escritura con tiempos variables, desplazamiento y navegación entre resultados cuando corresponde. Esto no garantiza que Microsoft acepte cada búsqueda ni elimina los límites del servicio.

### Ejecutar solo tareas

Usa **Tasks only** cuando quieras procesar Daily Set, More Activities, check-in, noticias o Visual Search sin iniciar una sesión completa de búsquedas.

Las tareas dependen del país y de lo que Microsoft muestre en ese momento. Una tarea ausente, ya completada o no disponible no debe considerarse un fallo de la aplicación.

### Revisar puntos e historial

- **Stats** muestra el saldo y los contadores conocidos.
- **History** registra consultas, fecha, hora y estado.
- La actualización de puntos puede ejecutarse aunque no haya una run activa.

Si Microsoft pide volver a iniciar sesión, completa el proceso en Edge y vuelve a consultar las estadísticas.

## Vincular el teléfono Android

La aplicación PC y la aplicación Android deben usar la misma red local cuando se utiliza el descubrimiento automático.

1. En PC abre **Account > Link phone**.
2. Deja visible el QR.
3. En Android abre AutoRewarder Mobile.
4. Pulsa **Scan QR**.
5. Acepta el permiso de cámara cuando Android lo solicite.
6. Apunta al QR y espera la confirmación.
7. Comprueba en PC que el teléfono aparece como conectado.

Si el descubrimiento no funciona, usa el código manual mostrado por la aplicación. Una VPN, una red de invitados, el aislamiento Wi-Fi o un firewall pueden impedir la conexión local.

Al desvincular el teléfono, la cuenta de PC debe seguir disponible para ejecutar las funciones que no dependen del teléfono. Check-in y noticias pueden quedar limitados si requieren el dispositivo móvil.

## Actualizaciones

AutoRewarder comprueba las releases de los dos repositorios:

- [AutoRewarder-PC](https://github.com/iGlitchOn/AutoRewarder-PC/releases)
- [AutoRewarder-Mobile](https://github.com/iGlitchOn/AutoRewarder-Mobile/releases)

Cuando encuentra una release propia más reciente, muestra la opción de descargarla. Las releases del repositorio original se notifican como referencia y no se integran automáticamente en esta distribución.

Antes de actualizar:

1. Detén cualquier ejecución.
2. Cierra la aplicación.
3. Copia `C:\Users\<usuario>\AppData\Local\AutoRewarder`.
4. Descarga la release desde GitHub.
5. Sustituye solo los archivos del programa, no la carpeta de configuración.

Las versiones usan el formato `4.4.x`. El tag y el nombre de release deben coincidir, por ejemplo `v4.4.0` y `4.4.0`.

## Configuración y datos

```text
C:\Users\<usuario>\AppData\Local\AutoRewarder
├── settings.json       Configuración general
├── accounts.json       Lista de cuentas
├── accounts\<id>\
│   ├── EdgeProfile\    Perfil aislado de Edge
│   ├── history.json    Historial de búsquedas
│   ├── stats.json      Estadísticas y saldo registrado
│   ├── status.json     Estado diario de tareas
│   └── meta.json       Preferencias y programación de la cuenta
└── background_log.txt  Registro de ejecuciones automáticas
```

No compartas estas carpetas públicamente. Pueden contener sesiones, perfiles de navegador o información de actividad.

## Opciones importantes

- **Hide browser**: ejecuta el navegador oculto cuando el flujo lo permite. Para diagnosticar problemas, déjalo desactivado.
- **Auto start**: permite iniciar ejecuciones programadas con Windows.
- **Launch on login**: abre la aplicación al iniciar sesión en Windows.
- **PC searches / Mobile searches**: cantidades por ejecución.
- **Language**: automático o idioma elegido para la interfaz.
- **Account**: cuenta actualmente activa.

Cambiar una opción no debería borrar el historial. Aun así, guarda una copia antes de modificar varias opciones a la vez.

## Solución de problemas

### Edge no abre o abre una cuenta incorrecta

1. Cierra Edge y AutoRewarder.
2. Comprueba que la cuenta seleccionada sea la correcta.
3. Abre Edge manualmente e inicia sesión en Bing y Rewards.
4. Repite la configuración inicial de esa cuenta si es necesario.

### No se obtienen puntos

Comprueba el saldo directamente en Microsoft Rewards. La cuenta puede haber alcanzado su límite, la actividad puede no estar disponible en la región o Microsoft puede haber cambiado el diseño.

### El móvil no aparece

Comprueba que ambos dispositivos estén en la misma red, desactiva temporalmente VPN y red de invitados, permite AutoRewarder en el firewall y prueba el código manual.

### El QR no escanea

Limpia la cámara, aumenta el brillo del monitor, centra el código completo y evita reflejos. Si el teléfono no tiene cámara disponible, usa el código manual.

### Windows o Play Protect muestran una advertencia

Las advertencias de SmartScreen o Play Protect pueden aparecer en programas distribuidos fuera de una tienda oficial. Descarga únicamente desde los repositorios oficiales, verifica la release y no desactives la seguridad del sistema de forma global.

## Desarrollo y compilación

Para trabajar desde el código fuente se necesita Python 3.12 o compatible, Microsoft Edge y las dependencias del proyecto.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python AutoRewarder.py
```

Compilar el ejecutable:

```powershell
python scripts/embed_gui_bundle.py
.\.venv\Scripts\python.exe -m PyInstaller --noconfirm --clean AutoRewarder.spec
```

Crear el instalador requiere Inno Setup 6:

```powershell
& 'C:\Program Files (x86)\Inno Setup 6\iscc.exe' AutoRewarder.iss
```

La aplicación Android sincroniza `gui/phone.html`, `gui/phone.js`, `gui/i18n.js`, `gui/styles.css` y `gui/normalize.css` durante la compilación Gradle.

## Estructura principal

```text
gui/                 Interfaz PC y móvil
src/api.py           API expuesta a la interfaz
src/accounts/        Cuentas y preferencias
src/search/          Búsquedas e historial
src/dailytasks/      Tareas diarias y Visual Search
src/phone_bridge.py  Comunicación PC-móvil
src/tunnel.py        Conexión auxiliar para vinculación
android/             Proyecto Android
assets/              Consultas, iconos y recursos
```

## Aviso

AutoRewarder interactúa con servicios de terceros. El uso de automatización puede estar limitado o prohibido por los términos de Microsoft Rewards. El usuario debe revisar las reglas del servicio y asumir la responsabilidad de su uso, su cuenta y sus resultados.

## Reportar un problema

Incluye:

1. Versión de AutoRewarder.
2. Sistema operativo y región.
3. Cuenta afectada, sin compartir credenciales.
4. Paso exacto que produjo el problema.
5. Mensaje del registro y capturas sin datos privados.

Reporta los problemas en [Issues de AutoRewarder-PC](https://github.com/iGlitchOn/AutoRewarder-PC/issues).
