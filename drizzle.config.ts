import 'dotenv';
import {defineConfig} from 'drizzle-kit'

//Archivo para configurar drizzle (ORM)
//Se configura ruta para esquema, en que DB conectarse y donde guardar las migraciones


export default defineConfig({
    dialect: 'postgresql',
    schema: './src/db/schema/index.ts',
    out: './drizzle',
    casing: 'snake_case',
    dbCredentials: {url: process.env.DATABASE_URL! },
})