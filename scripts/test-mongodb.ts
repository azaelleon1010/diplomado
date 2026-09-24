import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { resolve } from "node:path";

dotenv.config({
  path: resolve(process.cwd(), ".env"),
});

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI no está configurada");
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
});

async function main() {
  try {
    console.log("Probando conexión con MongoDB Atlas...");

    await client.connect();

    console.log("TCP/MongoDB connection: OK");

    await client.db("erp_platform").command({ ping: 1 });

    console.log("MongoDB ping: OK");
    console.log("MongoDB Atlas: CONNECTED");
  } catch (error) {
    const err = error as Error & {
      code?: string | number;
      cause?: unknown;
    };

    console.error("MongoDB Atlas: FAILED");
    console.error("name:", err.name);
    console.error("message:", err.message);
    console.error("code:", err.code);

    if (err.cause) {
      console.error("cause:", err.cause);
    }

    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

void main();