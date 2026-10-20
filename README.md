# SalvyBox API

API REST para el sistema integral de control y seguimiento de paquetes de **SalvyBox**, una empresa courier que gestiona encomiendas y compras en línea entre **El Salvador y Estados Unidos** y cobra una comisión por envío.

El sistema centraliza la operación (clientes, paquetes, viajes, pagos, entregas y reportes) que antes estaba repartida entre mensajes de WhatsApp, hojas de cálculo y registros manuales. Tiene dos caras:

- **Panel privado** para los administradores (requiere sesión).
- **Rastreo público**: cualquier persona consulta el estado de su paquete con su código, sin ver datos privados.

> Este repositorio contiene **solo el backend**. El frontend (Next.js) tiene su propia guía: [`docs/GUIA_FRONTEND.md`](docs/GUIA_FRONTEND.md).

---

## Características

- Gestión de **clientes, paquetes, viajes, pagos con abonos, entregas y usuarios**.
- **Códigos de rastreo** aleatorios y no adivinables (`SBX-XXXXXXXX`) y códigos de viaje autogenerados (`SS-LA-K7M2PQ`).
- **Historial de estados** de cada paquete (cuándo y quién), que alimenta la línea de tiempo del rastreo público.
- **Pagos con abonos múltiples**: el estado (Pendiente, Parcial, Pagado), el saldo y el total se **calculan**, nunca se guardan.
- **Dashboard** con resúmenes y **búsqueda general** (máximo 3 resultados relevantes).
- **Reportes en PDF y Excel** por rango de fechas (financiero, paquetes y viajes).
- **Roles** `admin` y `superadmin` (máximo 2 superadmin), con desactivación de usuarios efectiva al instante.
- **Tarea programada** que pasa los viajes a "En proceso" al llegar su fecha de salida.
- Búsquedas que ignoran **mayúsculas, tildes y formato de teléfono**.

## Stack

| Necesidad | Tecnología |
|---|---|
| Runtime | Node.js 24 LTS (ESM) |
| Lenguaje | TypeScript (modo estricto) |
| Framework | Express 5 |
| Base de datos | PostgreSQL |
| ORM y migraciones | Drizzle ORM + drizzle-kit (driver `pg`) |
| Validación | Zod |
| Contraseñas | argon2 |
| Sesión | JWT en cookie `httpOnly` |
| Seguridad HTTP | helmet, cors, express-rate-limit |
| Logs | pino + pino-http |
| Códigos aleatorios | nanoid (alfabeto propio, sin caracteres confusos) |
| Reportes | pdfkit + exceljs |
| Tareas programadas | node-cron |
| Pruebas | vitest + supertest (contra PostgreSQL real) |

## Requisitos

- Node.js 24 o superior y npm.
- PostgreSQL 13 o superior (necesario para la extensión `unaccent`).

## Instalación

```bash
# 1. Dependencias
npm install

# 2. Crear las bases de datos (desde psql o pgAdmin)
#    CREATE DATABASE salvybox;
#    CREATE DATABASE salvybox_test;   -- solo para pruebas automáticas

# 3. Variables de entorno: copia .env.example a .env y complétalo (ver tabla abajo)

# 4. Crear tablas, catálogos y el primer superadmin
npm run db:migrate
npm run db:seed
npm run crear-superadmin     # pide usuario y contraseña por consola

# 5. Arrancar en desarrollo (http://localhost:4000)
npm run dev
```

Comprueba que está viva: `GET http://localhost:4000/health` responde `{"estado":"ok"}`.

> El primer superadmin solo puede crearse con `npm run crear-superadmin`: desde la aplicación nadie puede crearlo porque todavía no existe nadie con sesión. Los demás usuarios se crean desde el panel.

## Variables de entorno

Contenido sugerido para `.env.example` (el archivo `.env` real **nunca** se sube a Git):

```bash
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:TU_CLAVE@localhost:5432/salvybox
# Genera una real con: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=reemplaza_esto_por_una_clave_larga_y_aleatoria_de_48_bytes
FRONTEND_URL=http://localhost:3000
# BD SOLO para pruebas: se vacía en cada prueba. El nombre DEBE terminar en _test.
TEST_DATABASE_URL=postgresql://postgres:TU_CLAVE@localhost:5432/salvybox_test
```

| Variable | Obligatoria | Descripción |
|---|---|---|
| `NODE_ENV` | No | `development` (por defecto), `production` o `test`. |
| `PORT` | No | Puerto de la API (4000 por defecto). |
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL. |
| `JWT_SECRET` | Sí | Clave para firmar sesiones. Mínimo 32 caracteres. |
| `FRONTEND_URL` | Sí | Único origen autorizado por CORS (el sitio Next.js). |
| `TEST_DATABASE_URL` | Solo para pruebas | Debe terminar en `_test`. |

La aplicación valida estas variables al arrancar y se detiene con un mensaje claro si falta alguna.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca con recarga automática (`tsx watch`). |
| `npm run build` | Compila a `dist/` (sin las pruebas). |
| `npm start` | Ejecuta la versión compilada (producción). |
| `npm run typecheck` | Revisa tipos sin generar archivos. |
| `npm run db:generate` | Genera una migración SQL a partir de los cambios en el esquema. |
| `npm run db:migrate` | Aplica las migraciones pendientes. |
| `npm run db:seed` | Inserta los catálogos (seguro de repetir). |
| `npm run crear-superadmin` | Crea el primer superadmin (solo si no existe uno). |
| `npm test` | Ejecuta las pruebas automáticas. |
| `npm run test:watch` | Pruebas en modo observación. |

## Estructura del proyecto

```
src/
├── config/        Variables de entorno validadas con Zod
├── db/
│   ├── schema/    Tablas de Drizzle (una por archivo temático)
│   ├── client.ts  Conexión (pool) y objeto `db`
│   ├── sembrar.ts Catálogos iniciales (lo usan el seed y las pruebas)
│   └── seed.ts
├── modules/       Un módulo por sección: schemas (Zod) → service (lógica y BD) → routes (HTTP)
│   ├── auth/  clientes/  viajes/  paquetes/  pagos/  entregas/
│   ├── usuarios/  rastreo/  dashboard/  busqueda/  reportes/  catalogos/
├── middlewares/   auth (sesión y roles) y errorHandler (errores uniformes)
├── jobs/          Tarea programada de viajes
├── scripts/       crearSuperadmin
├── utils/         códigos, errores, fechas, validación, búsqueda, logger
├── tests/         Pruebas automáticas y utilidades
├── app.ts         Arma Express (no abre el puerto; así se puede probar con supertest)
└── server.ts      Arranca el servidor y lo apaga de forma ordenada
drizzle/           Migraciones SQL generadas (se versionan en Git)
```

Las rutas solo reciben y responden; la lógica vive en los servicios. Todo error termina en un único manejador, así que todas las respuestas de error tienen el mismo formato.

## Convenciones de la API

- **Base:** todo cuelga de `/api/...`. Aparte existe `GET /health`.
- **Sesión:** cookie `sbx_token` (`httpOnly`, `sameSite=strict`, `secure` en producción, 8 horas). El navegador debe enviar las peticiones con credenciales.
- **JSON:** las propiedades van en `camelCase`. Los textos con dinero y libras (`"15.00"`) llegan como **texto** para no perder precisión.
- **Fechas:** las fechas simples son `AAAA-MM-DD`; las fechas con hora son ISO 8601 en UTC. La hora de negocio es **America/El_Salvador (UTC-6)**.
- **Paginación:** 10 registros por página en clientes, paquetes, pagos y entregas. Respuesta: `{ "datos": [...], "paginacion": { "pagina", "porPagina", "total", "totalPaginas" } }`.
- **Búsqueda y filtros:** todos los listados aceptan `?q=` y `?filtro=` (o `?orden=` en clientes).
- **Mensajes de éxito:** crear, editar y eliminar devuelven `mensaje`.
- **Formato de error** (siempre el mismo):

```json
{ "error": { "codigo": "DATOS_INVALIDOS", "mensaje": "Hay datos inválidos en la solicitud",
             "detalles": [ { "campo": "correo", "mensaje": "Correo inválido" } ] } }
```

## Resumen de endpoints

El detalle completo (cuerpos, respuestas, reglas y códigos de error) está en [`docs/GUIA_FRONTEND.md`](docs/GUIA_FRONTEND.md). Esa guía es la referencia de la API: no se duplica aquí para que no se desincronice.

| Módulo | Endpoints principales | Acceso |
|---|---|---|
| Rastreo | `GET /api/rastreo/:codigo` | **Público** |
| Auth | `POST /api/auth/login` · `POST /logout` · `GET /me` · `POST /cambiar-contrasena` | Login público; el resto con sesión |
| Dashboard | `GET /api/dashboard` | Sesión |
| Búsqueda general | `GET /api/buscar?q=` | Sesión |
| Clientes | `GET/POST /api/clientes` · `GET/PATCH/DELETE /:id` · `POST /eliminar-multiple` | Sesión |
| Viajes | `GET/POST /api/viajes` · `GET /resumen` `/opciones` `/ciudades` · `GET/PATCH/DELETE /:id` · `POST /:id/finalizar` | Sesión |
| Paquetes | `GET/POST /api/paquetes` · `GET /opciones` · `GET/PATCH/DELETE /:id` · `POST /cambiar-estado` `/eliminar-multiple` | Sesión |
| Pagos y abonos | `GET/POST /api/pagos` · `GET/PATCH/DELETE /:id` · `POST /:id/abonos` · `PATCH/DELETE /:id/abonos/:idAbono` · `POST /eliminar-multiple` | Sesión |
| Entregas | `GET /api/entregas` · `POST /api/entregas/completar` | Sesión |
| Reportes | `GET /api/reportes/resumen` · `GET /api/reportes/:tipo?desde&hasta&formato` | Sesión |
| Catálogos | `GET /api/catalogos` | Sesión |
| Usuarios | `GET/POST /api/usuarios` · `GET/PATCH /:id` | **Solo superadmin** |

## Seguridad

- Contraseñas con **argon2id**; nunca se guarda ni se devuelve la contraseña ni su hash.
- Sesión en cookie `httpOnly` (JavaScript no puede leerla), `sameSite=strict` y `secure` en producción. El token solo lleva el id: el rol y el estado se consultan en la BD en cada petición, así que **desactivar a un usuario corta su acceso de inmediato**.
- **Login:** mismo mensaje y mismo tiempo de respuesta si el usuario no existe o la clave es incorrecta; límite de 10 intentos fallidos por IP cada 15 minutos.
- **Rastreo público:** dos límites por IP (30 por minuto y 20 fallidos cada 15 minutos), respuesta idéntica para códigos inexistentes o mal escritos y lista exacta de campos devueltos (nunca datos del cliente, costos ni observaciones).
- Toda entrada pasa por **Zod** antes de tocar la BD; los campos desconocidos se descartan.
- Consultas con **Drizzle** (parámetros, sin concatenar SQL); comodines de búsqueda escapados.
- `helmet`, CORS limitado a `FRONTEND_URL`, cuerpos JSON de máximo 100 kb, `trust proxy` solo en producción.
- Operaciones críticas (abonos, límite de superadmin, cambios de estado) en **transacciones con bloqueo**, probadas con peticiones simultáneas.
- Los errores desconocidos se registran en el log y al cliente solo se le responde "Error interno" (sin detalles internos).
- Los logs ocultan `cookie` y `authorization`.

## Pruebas

```bash
npm test
```

- Corren contra una **PostgreSQL real** (`salvybox_test`), sin mocks, porque la lógica crítica vive en transacciones, bloqueos y restricciones de la BD.
- **Candado de seguridad:** las pruebas vacían las tablas, así que `vitest` se niega a arrancar si `TEST_DATABASE_URL` no termina en `_test`.
- Cubren: autenticación y sesiones, usuarios y límite de superadmin (con peticiones simultáneas), pagos y abonos (incluidos abonos simultáneos) y rastreo público (sin fugas de datos y con límite de consultas).

## Despliegue

Se contemplan **Railway** o **DigitalOcean**. Puntos a cuidar:

- **Dominio propio:** con `sameSite=strict`, frontend y API deben ser subdominios del mismo dominio (por ejemplo `salvybox.com` y `api.salvybox.com`). Los dominios gratuitos de plataforma cuentan como sitios distintos y la cookie no funcionaría.
- `NODE_ENV=production` activa cookie `secure` y `trust proxy`.
- **Migraciones:** `drizzle-kit` es una dependencia de desarrollo; el paso de migración en producción se definirá en la etapa de despliegue.
- **`unaccent`:** la migración crea la extensión; verificar que el proveedor de PostgreSQL la permita.
- **Respaldos** automáticos de la base de datos.
- **Zona horaria:** el servidor corre en UTC. La API ya calcula el "hoy" y los rangos de reportes en hora de El Salvador.
- Cierre ordenado (`SIGTERM`) ya implementado.

## Licencia

Proyecto privado de SalvyBox. Todos los derechos reservados.
