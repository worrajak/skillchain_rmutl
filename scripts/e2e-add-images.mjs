// Insert dummy image records so the submit button enables
import pg from "pg";
const JOB_ID = "dd92fa23-a9ac-455c-b20f-1aa4b63c6c2b";
const STUDENT_ID = "77209343-e476-4366-ab5f-099a766d9e65";

const client = new pg.Client({
  host: "db.vkiofmhddlzffgzstoml.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "Prach4843#*",
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// columns of skc_job_images
const { rows: cols } = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='skc_job_images' AND table_schema='public' ORDER BY ordinal_position`
);
console.log("skc_job_images columns:", cols.map(c => c.column_name).join(", "));

// Insert 1 progress + 1 completion image (using picsum placeholder URLs)
async function insertImg(image_type, idx) {
  const url = `https://picsum.photos/seed/e2e_${image_type}_${idx}/800/600`;
  // Try insert
  const r = await client.query(
    `INSERT INTO skc_job_images (job_id, image_type, image_url, uploaded_by, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id`,
    [JOB_ID, image_type, url, STUDENT_ID]
  );
  return r.rows[0]?.id;
}

try {
  const id1 = await insertImg("PROGRESS", 1);
  const id2 = await insertImg("PROGRESS", 2);
  const id3 = await insertImg("COMPLETION", 1);
  console.log(`Inserted progress: ${id1}, ${id2}; completion: ${id3}`);
} catch (e) {
  console.error("insert failed:", e.message);
  // Show columns for debugging
  console.log("Trying with image_url alternatives or required columns...");
  // Look at any existing rows
  const { rows: sample } = await client.query(`SELECT * FROM skc_job_images LIMIT 1`);
  console.log("sample row keys:", sample[0] ? Object.keys(sample[0]).join(", ") : "(empty)");
  console.log("sample row:", sample[0]);
}

await client.end();
