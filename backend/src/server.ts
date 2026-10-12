import "dotenv/config";
import app from "./app.js";
import { checkDatabaseConnection } from "./db.js";

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, async () => {
  console.log("==================================================");
  console.log(`🚀 Backend server is running successfully!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log("--------------------------------------------------");

  const dbHealth = await checkDatabaseConnection();

  if (dbHealth.connected) {
    console.log(`✅ PostgreSQL is connected successfully!`);
    console.log(`🗄️  Database: ${dbHealth.database}`);
    console.log(`👤 User:     ${dbHealth.user}`);
    console.log(`📦 Version:  ${dbHealth.version}`);
  } else {
    console.error(`❌ PostgreSQL connection failed!`);
    console.error(`⚠️  Error: ${dbHealth.error}`);
  }
  console.log("==================================================");
});
