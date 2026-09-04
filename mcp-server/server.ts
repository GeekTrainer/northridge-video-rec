// Northridge Video — read-only schema MCP server.
//
// Exposes the shared SQLite database's structure (tables, views, columns,
// foreign keys) over the Model Context Protocol via Streamable HTTP, so an
// MCP client can ask "what tables exist?" or "where would author info be
// stored?" without needing direct DB access. This server never executes
// arbitrary SQL against the seeded data — it only reads `sqlite_master` and
// `PRAGMA` metadata, plus row counts.
//
// Run with:  npm run start:mcp        (Streamable HTTP, http://localhost:3100/mcp)
//       or:  node mcp-server/server.ts --stdio   (stdio transport — no server to start;
//            the MCP client spawns this process directly, per .mcp.json)

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { openDb, closeAll, registerShutdown, DB_PATH } from '@northridge/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Ensure the shared DB exists before serving schema questions about it ---
async function ensureSeeded(): Promise<void> {
  if (existsSync(DB_PATH)) return;
  console.error('[mcp-server] northridge.db not found — seeding sample data...');
  const seedPath = join(__dirname, '..', 'data', 'seed.js');
  // seed.js logs a summary via console.log; in --stdio mode stdout is the
  // MCP transport, so redirect it to stderr for the duration of the import.
  const isStdio = process.argv.includes('--stdio');
  const originalLog = console.log;
  if (isStdio) console.log = console.error;
  try {
    await import(`file://${seedPath}`);
  } finally {
    console.log = originalLog;
  }
}

await ensureSeeded();

const db = openDb({ readonly: true });

interface SchemaObject {
  type: 'table' | 'view';
  name: string;
  tbl_name: string;
  sql: string | null;
}

interface ColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
}

interface ForeignKeyInfo {
  column: string;
  referencesTable: string;
  referencesColumn: string;
}

interface DescribedObject {
  name: string;
  type: 'table' | 'view';
  definition: string | null;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
  rowCount: number;
}

const objectsStmt = db.prepare(
  `SELECT type, name, tbl_name, sql
     FROM sqlite_master
    WHERE name NOT LIKE 'sqlite_%' AND type IN ('table', 'view')
    ORDER BY type, name`,
);

function listObjects(kind?: 'table' | 'view'): SchemaObject[] {
  const rows = objectsStmt.all() as unknown as SchemaObject[];
  return kind ? rows.filter((r) => r.type === kind) : rows;
}

function columnsFor(name: string): ColumnInfo[] {
  // Table/column names here always come from sqlite_master (never user
  // input), so string-interpolating the identifier into PRAGMA is safe.
  const rows = db.prepare(`PRAGMA table_info("${name}")`).all() as unknown as Array<{
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }>;
  return rows.map((c) => ({
    name: c.name,
    type: c.type,
    notNull: !!c.notnull,
    defaultValue: c.dflt_value,
    primaryKey: !!c.pk,
  }));
}

function foreignKeysFor(name: string): ForeignKeyInfo[] {
  const rows = db.prepare(`PRAGMA foreign_key_list("${name}")`).all() as unknown as Array<{
    from: string;
    table: string;
    to: string;
  }>;
  return rows.map((fk) => ({
    column: fk.from,
    referencesTable: fk.table,
    referencesColumn: fk.to,
  }));
}

function rowCountFor(name: string): number {
  const row = db.prepare(`SELECT count(*) AS n FROM "${name}"`).get() as unknown as { n: number };
  return row.n;
}

function describeObject(name: string): DescribedObject | null {
  const obj = listObjects().find((r) => r.name === name);
  if (!obj) return null;
  return {
    name: obj.name,
    type: obj.type,
    definition: obj.sql,
    columns: columnsFor(name),
    foreignKeys: obj.type === 'table' ? foreignKeysFor(name) : [],
    rowCount: rowCountFor(name),
  };
}

// --- MCP server -------------------------------------------------------------
const server = new McpServer({
  name: 'northridge-video-schema',
  version: '1.0.0',
});

server.registerTool(
  'list_tables',
  {
    title: 'List tables',
    description:
      'Lists every table in the shared Northridge Video database (data/northridge.db), with a short description of which department owns it and its row count.',
    inputSchema: {},
  },
  async () => {
    const tables = listObjects('table').map((t) => ({
      name: t.name,
      rowCount: rowCountFor(t.name),
    }));
    return {
      content: [{ type: 'text', text: JSON.stringify({ tables }, null, 2) }],
    };
  },
);

server.registerTool(
  'list_views',
  {
    title: 'List views',
    description:
      'Lists convenience views (e.g. video_catalog, music_catalog, book_catalog, catalog) that flatten joins for service code.',
    inputSchema: {},
  },
  async () => {
    const views = listObjects('view').map((v) => ({ name: v.name }));
    return {
      content: [{ type: 'text', text: JSON.stringify({ views }, null, 2) }],
    };
  },
);

server.registerTool(
  'describe_table',
  {
    title: 'Describe table or view',
    description:
      'Returns the full schema for one table or view: columns (name, type, nullability, default, primary key), foreign keys, its CREATE statement, and current row count.',
    inputSchema: {
      name: z.string().describe('Exact table or view name, e.g. "videos" or "book_catalog".'),
    },
  },
  async ({ name }) => {
    const described = describeObject(name);
    if (!described) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `No table or view named "${name}". Use list_tables or list_views to see valid names.`,
          },
        ],
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(described, null, 2) }],
    };
  },
);

server.registerTool(
  'get_full_schema',
  {
    title: 'Get full schema',
    description:
      'Returns the complete CREATE TABLE/VIEW SQL for every object in the database, in definition order — equivalent to reading data/schema.sql.',
    inputSchema: {},
  },
  async () => {
    const objects = listObjects();
    const sql = objects
      .filter((o) => o.sql)
      .map((o) => o.sql + ';')
      .join('\n\n');
    return { content: [{ type: 'text', text: sql }] };
  },
);

server.registerTool(
  'find_data',
  {
    title: 'Find where data might be stored',
    description:
      'Searches table/view/column names for a keyword and reports likely locations. Use this to answer "where would X be stored?" questions (e.g. "author", "price", "genre").',
    inputSchema: {
      keyword: z.string().describe('A word or partial word to search for, e.g. "author" or "price".'),
    },
  },
  async ({ keyword }: { keyword: string }) => {
    const needle = keyword.toLowerCase();
    const matches: Array<{
      object: string;
      type: 'table' | 'view';
      matchedOnName: boolean;
      matchedColumns: string[];
    }> = [];
    for (const obj of listObjects()) {
      const nameMatch = obj.name.toLowerCase().includes(needle);
      const matchingColumns = columnsFor(obj.name)
        .map((c) => c.name)
        .filter((colName) => colName.toLowerCase().includes(needle));
      if (nameMatch || matchingColumns.length) {
        matches.push({
          object: obj.name,
          type: obj.type,
          matchedOnName: nameMatch,
          matchedColumns: matchingColumns,
        });
      }
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ keyword, matches }, null, 2),
        },
      ],
    };
  },
);

// --- Transport selection -----------------------------------------------
// stdio: the MCP client (e.g. Copilot CLI via .mcp.json) spawns this file
// directly and speaks MCP over stdin/stdout — no server process to run
// ahead of time. This is the default when invoked with --stdio.
// Streamable HTTP: a standalone long-lived server other clients can attach
// to remotely, unaffected by whichever process launched it.
if (process.argv.includes('--stdio')) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  registerShutdown(() => closeAll());
} else {
  const PORT = Number(process.env.PORT) || 3100;

  const httpServer = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/mcp') {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on('close', () => transport.close());
      await server.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'northridge-video-schema-mcp' }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  httpServer.listen(PORT, () => {
    console.error(`[mcp-server] http://localhost:${PORT}/mcp`);
  });

  registerShutdown(() => {
    closeAll();
    httpServer.close();
  });
}
