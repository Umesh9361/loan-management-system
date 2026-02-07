import * as schema from "@shared/schema";
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import pg from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";

const { Pool: PgPool } = pg;

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is not set");
  console.error("Also checked DATABASE_PUBLIC_URL - not set");
  console.error("Available DB-related env vars:", Object.keys(process.env).filter(key => key.includes('PG') || key.includes('DATABASE') || key.includes('DB')));
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const dbDriver = process.env.DB_DRIVER;
const isExplicitlyNeon = databaseUrl.includes('neon.tech') || databaseUrl.includes('.neon.');
const useNeon = dbDriver === 'neon' || (!dbDriver && isExplicitlyNeon);

try {
  const urlObj = new URL(databaseUrl);
  console.log(`Database driver: ${useNeon ? 'neon (serverless/websocket)' : 'pg (standard)'} | DB_DRIVER=${dbDriver || 'auto-detect'} | Host: ${urlObj.hostname}`);
} catch {
  console.log(`Database driver: ${useNeon ? 'neon' : 'pg'} | DB_DRIVER=${dbDriver || 'auto-detect'}`);
}

if (!dbDriver && !isExplicitlyNeon) {
  console.log("Note: DB_DRIVER not set and URL is not Neon - defaulting to standard pg driver. Set DB_DRIVER=neon to force Neon driver.");
}

let pool: any;
let db: any;

if (useNeon) {
  neonConfig.webSocketConstructor = ws;
  neonConfig.fetchConnectionCache = false;
  neonConfig.fetchFunction = (input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input, {
      ...init,
      signal: init?.signal || AbortSignal.timeout(10000),
    });
  };

  pool = new NeonPool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 5000,
  });

  db = drizzleNeon({ client: pool, schema });
  console.log("Neon database pool initialized successfully");
} else {
  pool = new PgPool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  db = drizzlePg({ client: pool, schema });
  console.log("Standard PostgreSQL pool initialized successfully");
}

pool.on('error', (err: Error) => {
  console.warn('Database pool error (non-fatal):', err.message);
});

let connectionLogged = false;
pool.on('connect', () => {
  if (!connectionLogged) {
    console.log('Database pool connection established');
    connectionLogged = true;
  }
});

export { pool, db };
