import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

async function checkData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
  });

  try {
    console.log("--- CLASS TOPIC DATA ---");
    const [ctRows] = await connection.execute('SELECT * FROM class_topic LIMIT 10');
    console.log(JSON.stringify(ctRows, null, 2));

    console.log("\n--- SECTION TOPIC DATA ---");
    const [stRows] = await connection.execute('SELECT * FROM section_topic LIMIT 10');
    console.log(JSON.stringify(stRows, null, 2));

    console.log("\n--- ACTIVE CLASS DATA ---");
    const [activeRows] = await connection.execute('SELECT id_class, score_average, status FROM class WHERE status = "running"');
    console.log(JSON.stringify(activeRows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkData();
