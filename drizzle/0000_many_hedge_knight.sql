CREATE TABLE "canal_pago" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "canal_pago_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(50) NOT NULL,
	CONSTRAINT "canal_pago_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "estado_paquete" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "estado_paquete_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(50) NOT NULL,
	CONSTRAINT "estado_paquete_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "estado_viaje" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "estado_viaje_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(50) NOT NULL,
	CONSTRAINT "estado_viaje_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "metodo_entrega" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "metodo_entrega_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(50) NOT NULL,
	CONSTRAINT "metodo_entrega_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "metodo_pago" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "metodo_pago_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(50) NOT NULL,
	CONSTRAINT "metodo_pago_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "rol" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rol_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(50) NOT NULL,
	CONSTRAINT "rol_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id_usuario" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "usuario_id_usuario_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"usuario" varchar(100) NOT NULL,
	"contrasena_hash" varchar(255) NOT NULL,
	"id_rol" integer NOT NULL,
	"estado" varchar(15) DEFAULT 'activo' NOT NULL,
	"fecha_creacion" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_usuario_unique" UNIQUE("usuario"),
	CONSTRAINT "usuario_estado_chk" CHECK ("usuario"."estado" in ('activo', 'inactivo'))
);
--> statement-breakpoint
CREATE TABLE "cliente" (
	"id_cliente" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cliente_id_cliente_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(100) NOT NULL,
	"correo" varchar(100) NOT NULL,
	"telefono" varchar(30) NOT NULL,
	"direccion" varchar(150) NOT NULL,
	"observaciones" varchar(255),
	"fecha_registro" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "viaje" (
	"id_viaje" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "viaje_id_viaje_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo_viaje" varchar(30) NOT NULL,
	"lugar_origen" varchar(50) NOT NULL,
	"lugar_destino" varchar(50) NOT NULL,
	"fecha_salida" date,
	"fecha_llegada" date,
	"id_estado_viaje" integer NOT NULL,
	"observaciones" varchar(150),
	CONSTRAINT "viaje_codigoViaje_unique" UNIQUE("codigo_viaje"),
	CONSTRAINT "viaje_fechas_chk" CHECK ("viaje"."fecha_llegada" is null or "viaje"."fecha_salida" is null or "viaje"."fecha_llegada" >= "viaje"."fecha_salida")
);
--> statement-breakpoint
CREATE TABLE "historial_estado" (
	"id_historial" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "historial_estado_id_historial_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_paquete" integer NOT NULL,
	"id_estado" integer NOT NULL,
	"id_usuario" integer NOT NULL,
	"fecha_cambio" timestamp with time zone DEFAULT now() NOT NULL,
	"fecha_cambio_estado" date DEFAULT now() NOT NULL,
	CONSTRAINT "uk_paquete_estado_fecha" UNIQUE("id_paquete","id_estado","fecha_cambio_estado")
);
--> statement-breakpoint
CREATE TABLE "paquete" (
	"id_paquete" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "paquete_id_paquete_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_cliente" integer NOT NULL,
	"id_viaje" integer,
	"codigo_rastreo" varchar(16) NOT NULL,
	"tienda_procedencia" varchar(100),
	"descripcion" varchar(255),
	"observaciones" varchar(255),
	"peso_libras" numeric(8, 2) NOT NULL,
	"id_metodo_entrega" integer NOT NULL,
	"lugar_entrega" varchar(150),
	"fecha_hora_recepcion" timestamp with time zone DEFAULT now() NOT NULL,
	"id_estado_actual" integer NOT NULL,
	CONSTRAINT "paquete_codigoRastreo_unique" UNIQUE("codigo_rastreo"),
	CONSTRAINT "paquete_peso_chk" CHECK ("paquete"."peso_libras" > 0)
);
--> statement-breakpoint
CREATE TABLE "abono" (
	"id_abono" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "abono_id_abono_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_pago" integer NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"fecha_pago" timestamp with time zone DEFAULT now() NOT NULL,
	"id_canal_pago" integer NOT NULL,
	"id_metodo_pago" integer NOT NULL,
	"id_usuario" integer NOT NULL,
	CONSTRAINT "abono_monto_chk" CHECK ("abono"."monto" > 0)
);
--> statement-breakpoint
CREATE TABLE "pago" (
	"id_pago" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pago_id_pago_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_paquete" integer NOT NULL,
	"costo_servicio" numeric(10, 2) NOT NULL,
	"costo_compra" numeric(10, 2) DEFAULT '0' NOT NULL,
	"id_canal_pago" integer NOT NULL,
	"id_metodo_pago" integer NOT NULL,
	"fecha_creacion" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pago_idPaquete_unique" UNIQUE("id_paquete"),
	CONSTRAINT "pago_costos_chk" CHECK ("pago"."costo_servicio" >= 0 and "pago"."costo_compra" >= 0),
	CONSTRAINT "pago_total_chk" CHECK ("pago"."costo_servicio" + "pago"."costo_compra" > 0)
);
--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_id_rol_rol_id_fk" FOREIGN KEY ("id_rol") REFERENCES "public"."rol"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "viaje" ADD CONSTRAINT "viaje_id_estado_viaje_estado_viaje_id_fk" FOREIGN KEY ("id_estado_viaje") REFERENCES "public"."estado_viaje"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "historial_estado" ADD CONSTRAINT "historial_estado_id_paquete_paquete_id_paquete_fk" FOREIGN KEY ("id_paquete") REFERENCES "public"."paquete"("id_paquete") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "historial_estado" ADD CONSTRAINT "historial_estado_id_estado_estado_paquete_id_fk" FOREIGN KEY ("id_estado") REFERENCES "public"."estado_paquete"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "historial_estado" ADD CONSTRAINT "historial_estado_id_usuario_usuario_id_usuario_fk" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "paquete" ADD CONSTRAINT "paquete_id_cliente_cliente_id_cliente_fk" FOREIGN KEY ("id_cliente") REFERENCES "public"."cliente"("id_cliente") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "paquete" ADD CONSTRAINT "paquete_id_viaje_viaje_id_viaje_fk" FOREIGN KEY ("id_viaje") REFERENCES "public"."viaje"("id_viaje") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "paquete" ADD CONSTRAINT "paquete_id_metodo_entrega_metodo_entrega_id_fk" FOREIGN KEY ("id_metodo_entrega") REFERENCES "public"."metodo_entrega"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "paquete" ADD CONSTRAINT "paquete_id_estado_actual_estado_paquete_id_fk" FOREIGN KEY ("id_estado_actual") REFERENCES "public"."estado_paquete"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "abono" ADD CONSTRAINT "abono_id_pago_pago_id_pago_fk" FOREIGN KEY ("id_pago") REFERENCES "public"."pago"("id_pago") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "abono" ADD CONSTRAINT "abono_id_canal_pago_canal_pago_id_fk" FOREIGN KEY ("id_canal_pago") REFERENCES "public"."canal_pago"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "abono" ADD CONSTRAINT "abono_id_metodo_pago_metodo_pago_id_fk" FOREIGN KEY ("id_metodo_pago") REFERENCES "public"."metodo_pago"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "abono" ADD CONSTRAINT "abono_id_usuario_usuario_id_usuario_fk" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_id_paquete_paquete_id_paquete_fk" FOREIGN KEY ("id_paquete") REFERENCES "public"."paquete"("id_paquete") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_id_canal_pago_canal_pago_id_fk" FOREIGN KEY ("id_canal_pago") REFERENCES "public"."canal_pago"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_id_metodo_pago_metodo_pago_id_fk" FOREIGN KEY ("id_metodo_pago") REFERENCES "public"."metodo_pago"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_paquete_viaje" ON "paquete" USING btree ("id_viaje");--> statement-breakpoint
CREATE INDEX "idx_paquete_cliente" ON "paquete" USING btree ("id_cliente");--> statement-breakpoint
CREATE INDEX "idx_abono_pago" ON "abono" USING btree ("id_pago");