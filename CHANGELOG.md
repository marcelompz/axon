# Changelog
Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]
### Added
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
