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

  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'sessions'
    ORDER BY ordinal_position;
  `);
  console.log("Columns:", cols.rows.map(r => `${r.column_name} (${r.data_type})`));

  const policies = await client.query(`
    SELECT policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'sessions';
  `);
  console.log("Policies:", policies.rows);

  const sessions = await client.query(`
    SELECT id, topic, current_topic_id, (roadmap IS NOT NULL) as has_roadmap, jsonb_array_length(COALESCE(roadmap->'topics', '[]'::jsonb)) as topic_count, created_at, updated_at
    FROM sessions
    ORDER BY created_at DESC
    LIMIT 10;
  `);
  console.log("Recent sessions summary:", sessions.rows);

  const target = await client.query(`
    SELECT id, topic, roadmap
    FROM sessions
    WHERE id = 'f02516ef-870e-40da-bce5-09b0d4533cc6';
  `);
  console.log("Target session f02516ef:", JSON.stringify(target.rows, null, 2));

  await client.end();
}

main().catch(console.error);
