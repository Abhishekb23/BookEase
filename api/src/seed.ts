import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const passwordHash = await bcrypt.hash("Demo@123", 10);
  const owner = await pool.query(
    `INSERT INTO users (name,email,password_hash,role) VALUES ('Maya Sharma','owner@bookease.demo',$1,'owner')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`, [passwordHash],
  );
  const customer = await pool.query(
    `INSERT INTO users (name,email,password_hash,role) VALUES ('Naman Choudhary','customer@bookease.demo',$1,'customer')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`, [passwordHash],
  );
  const services = [
    ["Strategy consultation", "A focused one-to-one planning session.", 45, 899, "#2f766d"],
    ["Portfolio review", "Practical feedback and an improvement plan.", 60, 1299, "#c56c4d"],
    ["Career mentoring", "Interview preparation and career direction.", 30, 699, "#5574a7"],
  ];
  const serviceIds: string[] = [];
  for (const service of services) {
    const result = await pool.query(
      `INSERT INTO services (name,description,duration_minutes,price,color) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING RETURNING id`, service,
    );
    if (result.rows[0]?.id) serviceIds.push(result.rows[0].id);
  }
  if (serviceIds.length) {
    await pool.query(
      `INSERT INTO bookings (customer_id,service_id,starts_at,ends_at,status,notes)
       SELECT $1,$2,date_trunc('day',NOW()) + interval '14 hours',date_trunc('day',NOW()) + interval '14 hours 45 minutes','confirmed','Discuss portfolio structure'
       WHERE NOT EXISTS (SELECT 1 FROM bookings)`,
      [customer.rows[0].id, serviceIds[0]],
    );
  }
  console.log(`Seed complete for owner ${owner.rows[0].id}`);
}

seed().finally(() => pool.end());
