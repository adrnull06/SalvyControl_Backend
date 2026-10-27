# Diagrama de módulos — SalvyControl Backend

Repositorio: https://github.com/adrnull06/SalvyControl_Backend

## Arquitectura general

```mermaid
flowchart TB
    CLIENTE["Frontend / Cliente HTTP"] --> APP["Express 5 · src/app.ts"]
    APP --> MW["Middlewares compartidos\nAutenticación y roles · Manejo de errores"]
    MW --> ROUTES["Rutas de los módulos"]

    subgraph MODULOS["Módulos funcionales · src/modules/"]
      direction TB
      AUTH["auth"]
      CLIENTES["clientes"]
      PAQUETES["paquetes"]
      VIAJES["viajes"]
      PAGOS["pagos"]
      ENTREGAS["entregas"]
      USUARIOS["usuarios"]
      RASTREO["rastreo"]
      DASHBOARD["dashboard"]
      BUSQUEDA["busqueda"]
      REPORTES["reportes"]
      CATALOGOS["catalogos"]
    end

    ROUTES --> AUTH
    ROUTES --> CLIENTES
    ROUTES --> PAQUETES
    ROUTES --> VIAJES
    ROUTES --> PAGOS
    ROUTES --> ENTREGAS
    ROUTES --> USUARIOS
    ROUTES --> RASTREO
    ROUTES --> DASHBOARD
    ROUTES --> BUSQUEDA
    ROUTES --> REPORTES
    ROUTES --> CATALOGOS

    AUTH -. "validación con Zod cuando aplica" .-> SCHEMAS["*.schemas.ts"]
    CLIENTES -.-> SCHEMAS
    PAQUETES -.-> SCHEMAS
    VIAJES -.-> SCHEMAS
    PAGOS -.-> SCHEMAS
    ENTREGAS -.-> SCHEMAS
    USUARIOS -.-> SCHEMAS
    REPORTES -.-> SCHEMAS

    AUTH --> SERVICES["Servicios / lógica de negocio\n*.service.ts y archivos especializados"]
    CLIENTES --> SERVICES
    PAQUETES --> SERVICES
    VIAJES --> SERVICES
    PAGOS --> SERVICES
    ENTREGAS --> SERVICES
    USUARIOS --> SERVICES
    RASTREO --> SERVICES
    DASHBOARD --> SERVICES
    BUSQUEDA --> SERVICES
    REPORTES --> SERVICES
    CATALOGOS --> SERVICES

    SERVICES --> DBCLIENT["Acceso a datos · src/db/client.ts"]
    DBCLIENT --> DBSCHEMA["Esquemas Drizzle · src/db/schema/"]
    DBCLIENT --> DATABASE[("PostgreSQL · salvybox")]

    JOBS["Tareas programadas · src/jobs/"] --> SERVICES
    CONFIG["Configuración · src/config/"] -.-> APP
    UTILS["Utilidades compartidas · src/utils/"] -.-> SERVICES
    MW --> ERR["Formato centralizado de errores\ncodigo · mensaje · detalles"]
```

## Responsabilidad de las capas

- **Rutas (`*.routes.ts`):** reciben las peticiones HTTP, aplican validaciones y delegan el trabajo a la lógica correspondiente.
- **Esquemas (`*.schemas.ts`):** definen las reglas de validación de los datos mediante Zod, en los módulos que los requieren.
- **Servicios y archivos especializados:** contienen la lógica de negocio y las operaciones de acceso a datos.
- **Middlewares:** gestionan autenticación/autorización y centralizan el tratamiento de errores.
- **Capa de datos:** Drizzle ORM conecta la API con PostgreSQL; los esquemas están organizados en `src/db/schema/`.
- **Tareas programadas:** `src/jobs/` ejecuta procesos automáticos, como la tarea relacionada con viajes.
- **Utilidades compartidas:** `src/utils/` contiene funciones reutilizables por distintos módulos.

> **Nota sobre la implementación:** el diagrama resume las responsabilidades arquitectónicas, no implica que todos los módulos tengan exactamente los mismos archivos. En el repositorio, por ejemplo, `catalogos` solo contiene rutas y `busqueda` no tiene un archivo `*.schemas.ts`; `reportes` además separa funciones de datos, exportación y resumen en archivos especializados.
