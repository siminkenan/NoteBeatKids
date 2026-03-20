"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
var node_postgres_1 = require("drizzle-orm/node-postgres");
var pg_1 = require("pg");
var schema = require("@shared/schema");
var pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
exports.db = (0, node_postgres_1.drizzle)(pool, { schema: schema });
