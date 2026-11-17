import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres.ougxttjcgonjgstksham:wsxtgbqazB5%236914@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

const defaultRoadmap = {
  topics: [
    {
      id: "topic-1",
      order: 1,
      title: "Introduction to Conversational AI in Education",
      description:
        "An overview of how real-time conversational AI is transforming modern classrooms and enhancing student engagement.",
      estimatedDurationMinutes: 6,
      learningObjectives: [
        "Define conversational AI in the context of education",
        "Identify key benefits of real-time AI tutors",
      ],
      pedagogicalAnalogies: [
        "Like having a personal tutor sitting next to every student in a large lecture hall.",
      ],
    },
    {
      id: "topic-2",
      order: 2,
      title: "Core Architecture of Real-Time Voice Models",
      description:
        "Breaking down the pipeline of speech-to-text, large language model reasoning, and real-time speech synthesis.",
      estimatedDurationMinutes: 8,
      learningObjectives: [
        "Understand full-duplex real-time audio streaming",
        "Examine WebSocket and WebRTC audio transport layers",
      ],
      pedagogicalAnalogies: [
        "A live translation interpreter instantly listening and speaking simultaneously.",
      ],
    },
    {
      id: "topic-3",
      order: 3,
      title: "Pedagogical Strategies and Prompt Engineering",
      description:
        "Designing conversational prompts that promote critical thinking, active recall, and Socratic dialogue.",
      estimatedDurationMinutes: 8,
      learningObjectives: [
        "Formulate Socratic questioning techniques for AI tutors",
        "Structure multi-turn adaptive explanations",
      ],
      pedagogicalAnalogies: [
        "A professor guiding a student to the answer with hints rather than just giving the solution.",
      ],
    },
    {
      id: "topic-4",
      order: 4,
      title: "Ethical Considerations, Limitations, and Future Outlook",
      description:
        "Navigating hallucination risks, academic integrity, accessibility barriers, and emerging multimodal horizons.",
      estimatedDurationMinutes: 8,
      learningObjectives: [
        "Evaluate hallucination mitigation strategies",
        "Discuss ethical deployment in academic curricula",
      ],
      pedagogicalAnalogies: [
        "Treating AI as a research calculator with clear audit trails rather than an infallible oracle.",
      ],
    },
  ],
};

async function main() {
  await client.connect();
  console.log("Connected to Supabase PostgreSQL!");

  // 1. Ensure columns exist on sessions
  console.log("Ensuring sessions table columns...");
  await client.query(`
    ALTER TABLE public.sessions
    ADD COLUMN IF NOT EXISTS roadmap JSONB DEFAULT '{"topics": []}'::jsonb,
    ADD COLUMN IF NOT EXISTS current_topic_id TEXT,
    ADD COLUMN IF NOT EXISTS covered_topic_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS live_resumption_handle TEXT,
    ADD COLUMN IF NOT EXISTS live_session_stats JSONB DEFAULT '{}'::jsonb;
  `);

  // 2. Configure RLS on sessions to permit public & authenticated SELECT, INSERT, UPDATE
  console.log("Configuring RLS policies on public.sessions...");
  await client.query(`
    ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      DROP POLICY IF EXISTS "Allow all users to select sessions" ON public.sessions;
      DROP POLICY IF EXISTS "Allow all users to update sessions" ON public.sessions;
      DROP POLICY IF EXISTS "Allow all users to insert sessions" ON public.sessions;
    END $$;

    CREATE POLICY "Allow all users to select sessions"
    ON public.sessions FOR SELECT
    TO public
    USING (true);

    CREATE POLICY "Allow all users to update sessions"
    ON public.sessions FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Allow all users to insert sessions"
    ON public.sessions FOR INSERT
    TO public
    WITH CHECK (true);
  `);

  // 3. Configure RLS on session_participants
  console.log("Configuring RLS policies on public.session_participants...");
  await client.query(`
    ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      DROP POLICY IF EXISTS "Allow all users to select participants" ON public.session_participants;
      DROP POLICY IF EXISTS "Allow all users to insert participants" ON public.session_participants;
      DROP POLICY IF EXISTS "Allow all users to update participants" ON public.session_participants;
      DROP POLICY IF EXISTS "Allow all users to delete participants" ON public.session_participants;
    END $$;

    CREATE POLICY "Allow all users to select participants"
    ON public.session_participants FOR SELECT
    TO public
    USING (true);

    CREATE POLICY "Allow all users to insert participants"
    ON public.session_participants FOR INSERT
    TO public
    WITH CHECK (true);

    CREATE POLICY "Allow all users to update participants"
    ON public.session_participants FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Allow all users to delete participants"
    ON public.session_participants FOR DELETE
    TO public
    USING (true);
  `);

  // 4. Backfill sessions with empty roadmap
  console.log("Backfilling sessions with default 4-topic roadmap...");
  const targetSessionIds = [
    "f02516ef-870e-40da-bce5-09b0d4533cc6",
    "32aea94a-32ba-474d-bb38-69ae237150e4",
    "c6238f56-80b9-409e-840c-92da7b133dda",
    "1c7138ba-0946-43c3-aec8-66f40d099dfe",
  ];

  for (const id of targetSessionIds) {
    const updateRes = await client.query(
      `
      UPDATE public.sessions
      SET roadmap = $1::jsonb,
          current_topic_id = 'topic-1',
          updated_at = NOW()
      WHERE id = $2;
    `,
      [JSON.stringify(defaultRoadmap), id]
    );
    console.log(`Session ${id} updated: ${updateRes.rowCount} row(s)`);
  }

  // 5. Verify verification
  const verifyRes = await client.query(`
    SELECT id, topic, current_topic_id, jsonb_array_length(roadmap->'topics') as topic_count, updated_at
    FROM public.sessions
    WHERE id = ANY($1::uuid[]);
  `, [targetSessionIds]);
  console.log("Verification results:", verifyRes.rows);

  await client.end();
  console.log("Migration complete!");
}

main().catch(console.error);
