import { db } from './src/db/pool.js';

async function check() {
  try {
    console.log("Checking class_student_topic...");
    const { rows: cst } = await db.query("DESCRIBE class_student_topic");
    console.log(cst);

    console.log("\nChecking student_topic...");
    const { rows: st } = await db.query("DESCRIBE student_topic");
    console.log(st);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
