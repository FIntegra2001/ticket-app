// ============================================================================
// Despliegue de las fases 0-2 en PRODUCCIÓN. Lo ejecuta una persona a mano:
//
//   node scripts/produccion.mjs esquema    → paso A: añade tablas/campos (no borra)
//   node scripts/produccion.mjs simular    → paso B: informe de migración (no escribe)
//   node scripts/produccion.mjs aplicar    → paso C: aplica la migración
//
// Lee la conexión de .env.produccion (no del .env de pruebas).
// ============================================================================
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import dotenv from "dotenv";

const step = process.argv[2];
const steps = {
  esquema: ["prisma", "db", "push"],
  simular: ["tsx", "scripts/fase1-migracion.ts"],
  aplicar: ["tsx", "scripts/fase1-migracion.ts", "--apply"],
};
if (!steps[step]) {
  console.error("Uso: node scripts/produccion.mjs esquema | simular | aplicar");
  process.exit(1);
}

const { DATABASE_URL } = dotenv.parse(fs.readFileSync(".env.produccion"));
if (!DATABASE_URL) {
  console.error("Falta DATABASE_URL en .env.produccion");
  process.exit(1);
}
const url = new URL(DATABASE_URL);
// prisma db push necesita la conexión directa (sin el pooler de Neon)
if (step === "esquema") {
  url.hostname = url.hostname.replace("-pooler", "");
  url.searchParams.delete("channel_binding");
}

console.log(`>> PRODUCCIÓN (${url.hostname.split(".")[0]}) — paso: ${step}\n`);
const r = spawnSync("npx", steps[step], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: url.toString(), NODE_NO_WARNINGS: "1" },
});
process.exit(r.status ?? 1);
