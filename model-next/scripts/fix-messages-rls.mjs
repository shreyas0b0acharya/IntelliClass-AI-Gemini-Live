import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres.ougxttjcgonjgstksham:wsxtgbqazB5%236914@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log("Connected to Supabase PostgreSQL!");

  // 1. Get existing policies
  const policies = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'messages';
  `);
  console.log("Current policies:", policies.rows);

  // 2. Allow authenticated and anon users to insert into messages
  await client.query(`
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      DROP POLICY IF EXISTS "Allow all users to view messages" ON public.messages;
      DROP POLICY IF EXISTS "Allow all users to insert messages" ON public.messages;
      DROP POLICY IF EXISTS "Allow session participants to insert messages" ON public.messages;
      DROP POLICY IF EXISTS "Allow session participants to read messages" ON public.messages;
      DROP POLICY IF EXISTS "Enable read access for all users" ON public.messages;
      DROP POLICY IF EXISTS "Enable insert for all users" ON public.messages;
    END $$;

    CREATE POLICY "Allow all users to view messages"
    ON public.messages
    FOR SELECT
    TO public
    USING (true);

    CREATE POLICY "Allow all users to insert messages"
    ON public.messages
    FOR INSERT
    TO public
    WITH CHECK (true);
  `);

  console.log("Updated RLS policies on public.messages successfully!");

  // Check policies again
  const updated = await client.query(`
    SELECT policyname, cmd, roles
    FROM pg_policies
    WHERE tablename = 'messages';
  `);
  console.log("Updated policies:", updated.rows);

  await client.end();
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});

