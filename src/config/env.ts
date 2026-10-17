// Aqui se validan las variables de entorno en archivo .env antes de arrancar
// Si hay error, se dejan en claro antes
import 'dotenv'
import {z} from 'zod' 

//Con zod. Definimos esquema para comprobar despues que las variables esta correcta
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    //Convertir variables en numeros (para puertos)
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.url(),
    JWT_SECRET: z.string().min(32),
    FRONTEND_URL: z.url(),
});

//Comprobamos con el esquema que los datos sean correctos 
const result = envSchema.safeParse(process.env);

if (!result.success) {
    console.error('Variables de entorno invalidas:\n' + z.prettifyError(result.error));
    process.exit(1);
}