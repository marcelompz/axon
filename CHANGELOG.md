# Changelog
Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]
### Added
- **Cámara Mágica:** Integración nativa con `expo-image-picker` para tomar fotografías directamente desde el menú Slash móvil.
- **Sincronización Web de Fotos:** Las fotos tomadas desde el celular se comprimen (`quality: 0.5`) y se convierten a base64 para sincronizarse en tiempo real con la aplicación web en el formato de bloque `image`.
- **Calendario Nativo:** Integración con `expo-calendar` para sincronizar bloques directamente con el calendario del dispositivo.
- **Agendar Tareas:** Nuevo botón `📅 Agendar Hoy` en el menú Slash móvil que solicita permisos y crea eventos reales en el calendario del celular.
- **Sincronización Bidireccional de Calendario:** Al marcar una tarea agendada como completada en la app móvil, el evento en el calendario se actualiza dinámicamente añadiendo el prefijo `✅ `.
- **Menú Móvil "Slash":** Interfaz superpuesta horizontal (scroll nativo) en la app móvil que aparece al teclear `/` para cambiar rápidamente entre tipos de bloque (Títulos, Listas, Tareas).
- **Interacción Nativa:** Las tareas (checkboxes) ahora son interactivas en el entorno móvil, pudiendo marcar/desmarcarse con retroalimentación visual inmediata.
- **Renderizado Móvil:** Navegación bidireccional entre la lista de páginas y la edición nativa de bloques (`TextInput`) en React Native.
- **Compresión WebP:** Lógica de compresión de imágenes al lado del cliente usando Canvas (`image/webp`) ahorrando uso intensivo de la base local y red.
- **Plan Maestro:** Bitácora viva en `docs/plan_maestro.md` documentando las metas del proyecto (como dictado por voz y calendario).

### Changed
- **Identidad Visual:** Refactorización programática de los colores de todos los SVG raíz hacia la nueva paleta Indigo (`#4F46E5`).
- **Organización de Recursos:** Movimiento de todos los vectores y logotipos estáticos hacia `public/branding/`.
- **Estabilidad de SDK:** Downgrade controlado de Expo al SDK 54.0.0 y uso temporal del `memory-adapter` en PouchDB móvil para superar conflictos en los bundlers de Expo Go.

## [0.1.0] - Primer Prototipo (Local-First)
### Added
- Estructura base de Monorepo inspirada en OrderFlow, administrada bajo el manifiesto `packages.json`.
- Configuración de contenedor Docker para CouchDB en `docker-compose.yml`.
- Editor web minimalista construido con `contentEditable` nativo y menú tipo "Slash" (/).
- Integración de sincronización bidireccional continua con PouchDB.

### Removed
- Eliminación absoluta del directorio externo de referencia `Notion/` y exclusión de Git de archivos y prompts generados en `docs/`.
