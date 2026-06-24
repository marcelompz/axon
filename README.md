# Axon Workspace

Axon es un clon *Local-First* inspirado en Notion, diseñado como un editor basado en bloques con sincronización colaborativa en tiempo real y soporte nativo para móviles.

## Arquitectura y Tecnologías
- **Frontend:** React 19 + TypeScript + Vite.
- **Estilos:** CSS Vainilla con variables nativas, soporte Responsive y UX adaptada a móviles (Barra flotante, menú hamburguesa).
- **Base de Datos & Sincronización:** Arquitectura *Offline-First* impulsada por **PouchDB** en el navegador, que sincroniza de forma automática con un nodo de **CouchDB** corriendo bajo Docker.
- **CI/CD:** Pipeline automatizado en GitHub Actions (linting estricto con Oxlint y tests de build en Docker) dividiendo los entornos en ramas `main` y `staging`.

## Funcionalidades Principales
- **Editor de Bloques Jerárquico:** Soporte para Párrafos, Títulos (H1, H2, H3), Viñetas y Listas de Tareas (Checkboxes).
- **Comandos Slash (`/`):** Menú contextual tipo popover para cambiar el formato del bloque de forma rápida.
- **Drag & Drop Nivel Nativo:** Sistema de reorganización de bloques mediante arrastrar y soltar usando las APIs nativas del navegador (`dataTransfer`).
- **Mobile-Ready:** Interfaz adaptable a pantallas táctiles con botones de acción rápida, ideal para edición ágil desde el celular.

## Entorno de Desarrollo Rápido
El proyecto está completamente contenerizado usando Docker Compose para un inicio inmediato sin fricciones y Live Reload activado.

```bash
# Levantar el frontend y la base de datos CouchDB
docker compose up -d
```
Una vez levantado, la aplicación web es accesible en: `http://localhost:5173`. Para acceder desde un móvil, usa la IP local del equipo (ej. `http://192.168.x.x:5173`).

## Historial de Fases
- **Fase 1:** Implementación del Canvas React, sistema de bloques y Drag&Drop usando `localStorage`.
- **Fase 2:** Migración a PouchDB/CouchDB para soporte Multi-Dispositivo, rediseño de UX para móviles y CI/CD en GitHub.
