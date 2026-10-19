// Este archivo se encarga de crear la conexion a PostgreSQL con pg
// Se ocupa Drizzle como ORM
// Pool (conexiones) maximo 10
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres'
import {env} from  '../config/env.js'
import * as schema from './schema/index.js';

export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
});

//Objeto Db se ocupara en todo el sistema para las consultas
export const db = drizzle({client:pool, schema, casing: 'snake_case'});