import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres.ougxttjcgonjgstksham:wsxtgbqazB5%236914@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log("Connected to Supabase PostgreSQL!");

  const tables = await client.query(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
  console.log("Public tables:", tables.rows);

  const policies = await client.query(`
    SELECT tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);
  console.log("\nAll Policies in public:\n", policies.rows);

  await client.end();
}

main().catch(console.error);
