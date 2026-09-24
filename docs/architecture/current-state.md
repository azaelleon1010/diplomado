# Estado actual del repositorio

**Fecha de auditoría:** 2026-09-23  
**Clasificación:** **B. Parcialmente construido**  
**Alcance:** configuración y conectividad de MongoDB para la Foundation existente.

## Resumen

El repositorio no está vacío. Ya existe un monorepo npm con `apps/api`, `apps/worker` y paquetes compartidos. La base técnica sigue siendo Foundation: no hay módulos ERP de negocio implementados y no se modificó la arquitectura para esta auditoría.

La conexión MongoDB usa una única implementación Mongoose en `packages/database`. `apps/api/src/infrastructure/database/mongodb` y `apps/api/src/db/mongo.ts` son fachadas/re-export de compatibilidad; no crean conexiones adicionales.

## Inventario verificado

| Área | Estado observado |
|---|---|
| Package manager | npm workspaces; `package-lock.json` presente; `pnpm-workspace.yaml` de compatibilidad |
| Runtime | Node local 24.15.0; CI y Docker fijan Node 22 |
| Backend | Express 5 + TypeScript strict en `apps/api` |
| Worker | BullMQ + ioredis en `apps/worker` |
| Persistencia | Mongoose 8 en `packages/database`; MongoDB Atlas como SOR |
| Cache/colas | Redis/ioredis; Redis no es fuente de datos |
| Configuración | `dotenv` + Zod en `packages/config`; variables se leen de `process.env` |
| Health | `/health`, `/health/live`, `/health/ready`, `/health/db` y prefijo `/api/v1` |
| Tests | Vitest, Supertest, `mongodb-memory-server`; 8 archivos, 33 pruebas en la ejecución validada |
| Build/typecheck | Scripts npm de workspace y `tsc` compartido |
| Docker | Dockerfiles para API/worker y Compose con MongoDB/Redis |
| CI/CD | GitHub Actions con Node 22, MongoDB y Redis de servicio |
| Frontend | No implementado en esta fase; queda planificado |
| Módulos ERP | No implementados; se mantienen fuera de Foundation |

## Flujo MongoDB

1. `dotenv` carga el `.env` local sin imprimirlo.
2. `@erp/config` valida `MONGODB_URI` y parámetros de pool con Zod.
3. `@erp/database` usa `mongoose.connect` una sola vez y comparte el pool mediante una promesa `connecting`.
4. `pingMongo()` ejecuta `admin().ping()` para health/readiness.
5. `disconnectMongo()` participa en el apagado ordenado.
6. Los errores se clasifican sin devolver URI, usuario, password ni mensaje crudo al health endpoint o al log de conexión.

## Hallazgos y riesgos

- La conexión real con las variables presentes falló con `ECONNREFUSED`, clasificado como `network`. No se observó evidencia para atribuirlo a password, usuario, `authSource`, TLS o IP Access List.
- MongoDB no está disponible en el entorno accesible; por ello `/health/db` y `/health/ready` permanecen en 503.
- La suite usa MongoDB efímero local, no Atlas, para evitar depender de credenciales o red externa en CI.
- Lint queda sin errores, pero mantiene warnings preexistentes de `any` en tests y `console` en un script auxiliar.
- `npm install` reporta 3 vulnerabilidades moderadas del árbol de dependencias; requieren revisión separada antes de producción.
- Docker no se ejecutó durante esta validación; el resultado depende de tener Docker Desktop disponible.

## Seguridad verificada

- `.env` está ignorado por Git; `.env.example` no contiene credenciales reales.
- No se imprime `MONGODB_URI`.
- Los logs de conexión solo incluyen base lógica, pool, categoría y código técnico.
- Los health endpoints devuelven estado y latencia, no URI ni credenciales.
- No hay `MongoClient` adicional ni conexiones por request.

## Contradicciones y decisión

`AGENTS.md` exige MongoDB Atlas, una capa de infraestructura única, health checks y shutdown ordenado. El código existente cumple esos límites. La documentación anterior que describía el repositorio como vacío estaba desactualizada; se reemplazó por este inventario basado en archivos y comandos ejecutados. No se destruyó código ni se introdujo una segunda implementación.
