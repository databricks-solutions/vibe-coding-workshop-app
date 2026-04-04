import pg from "pg";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const endpointName = "projects/b11995cf-f4ba-418d-a9a1-7a8063ec4221/branches/br-solitary-term-d2tzkfuu/endpoints/ep-super-hat-d2q0td7w";
const host = "ep-super-hat-d2q0td7w.database.us-east-1.cloud.databricks.com";
const schema = "vibe_coding_workshop";

const cred = JSON.parse(
  execSync(`databricks postgres generate-database-credential "${endpointName}" --output json`).toString()
);
const email = JSON.parse(
  execSync("databricks current-user me --output json").toString()
).userName;

const pool = new pg.Pool({
  host,
  port: 5432,
  database: "databricks_postgres",
  user: email,
  password: cred.token,
  ssl: { rejectUnauthorized: false },
});

function parseSqlStatements(content) {
  const stmts = [];
  let i = 0;
  const len = content.length;

  while (i < len) {
    if (content[i] === "-" && content[i + 1] === "-") {
      while (i < len && content[i] !== "\n") i++;
      i++;
      continue;
    }
    if (" \t\n\r".includes(content[i])) { i++; continue; }

    const start = i;
    let inString = false;
    let depth = 0;

    while (i < len) {
      const c = content[i];
      if (c === "'" && !inString) { inString = true; i++; continue; }
      if (c === "'" && inString) {
        if (i + 1 < len && content[i + 1] === "'") { i += 2; continue; }
        inString = false; i++; continue;
      }
      if (inString) { i++; continue; }
      if (c === "-" && content[i + 1] === "-") {
        while (i < len && content[i] !== "\n") i++;
        i++; continue;
      }
      if (c === "(") depth++;
      if (c === ")") depth--;
      if (c === ";" && !inString && depth <= 0) {
        const stmt = content.slice(start, i + 1).trim();
        if (stmt && !stmt.startsWith("--")) stmts.push(stmt);
        i++; break;
      }
      i++;
    }
  }
  return stmts;
}

const tables = ["section_input_prompts", "usecase_descriptions", "workshop_parameters"];
for (const t of tables) {
  try {
    await pool.query(`DELETE FROM ${schema}.${t}`);
    console.log(`Cleared ${schema}.${t}`);
  } catch (e) {
    console.warn(`Could not clear ${t}: ${e.message.slice(0, 80)}`);
  }
}

const files = ["01_seed_usecase_descriptions.sql", "02_seed_section_input_prompts.sql", "03_seed_workshop_parameters.sql"];
let totalOk = 0, totalErr = 0;

for (const file of files) {
  let sql;
  try { sql = readFileSync(`db/lakebase/dml_seed/${file}`, "utf-8"); } catch { continue; }

  sql = sql.replace(/\$\{catalog\}\.\$\{schema\}\./g, `${schema}.`);
  sql = sql.replaceAll("${schema}", schema);
  sql = sql.replaceAll("current_timestamp()", "CURRENT_TIMESTAMP");
  sql = sql.replaceAll("current_user()", "CURRENT_USER");

  const stmts = parseSqlStatements(sql);
  let ok = 0, err = 0;
  for (const stmt of stmts) {
    try { await pool.query(stmt); ok++; } catch (e) {
      err++;
      console.error(`ERROR [${file}]: ${e.message.slice(0, 120)}`);
    }
  }
  console.log(`${file}: ${ok} OK, ${err} errors (${stmts.length} statements)`);
  totalOk += ok; totalErr += err;
}

const { rows } = await pool.query(`SELECT COUNT(*) AS cnt FROM ${schema}.section_input_prompts`);
console.log(`\nDone: ${totalOk} OK, ${totalErr} errors. Rows in section_input_prompts: ${rows[0].cnt}`);
await pool.end();
