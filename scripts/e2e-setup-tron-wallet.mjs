// Setup TRON wallets for E2E test users on Nile testnet
// - Generate fresh wallet for student (อาทิตย์)
// - Bind wallet_address into skc_users
// - Fund 5 TRX from deployer for future gas
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const TronWebMod = await import("tronweb");
const TronWeb = TronWebMod.TronWeb || TronWebMod.default || TronWebMod;

const FULL_HOST = process.env.NEXT_PUBLIC_TRON_FULL_HOST || "https://nile.trongrid.io";
const DEPLOYER_KEY = process.env.TRON_DEPLOYER_PRIVATE_KEY;
const tronWeb = new TronWeb({ fullHost: FULL_HOST, privateKey: DEPLOYER_KEY });
const deployerAddr = tronWeb.address.fromPrivateKey(DEPLOYER_KEY);

// Generate fresh student wallet
const studentWallet = await TronWeb.createAccount();
console.log("=== New student wallet (อาทิตย์) ===");
console.log("Address:    ", studentWallet.address.base58);
console.log("Private key:", studentWallet.privateKey);

// Save to DB
const STUDENT_EMAIL = "artid_lu67@live.rmutl.ac.th";
const client = new pg.Client({
  host: "db.vkiofmhddlzffgzstoml.supabase.co",
  port: 5432, database: "postgres", user: "postgres", password: "Prach4843#*",
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows: u } = await client.query(
  `UPDATE skc_users SET wallet_address = $1 WHERE email = $2 RETURNING id, email, wallet_address`,
  [studentWallet.address.base58, STUDENT_EMAIL]
);
console.log("\nDB binding:");
console.log(u[0]);

// Fund 5 TRX from deployer for future gas
console.log("\n=== Funding 5 TRX from deployer → student ===");
const tx = await tronWeb.trx.sendTrx(studentWallet.address.base58, 5_000_000); // 5 TRX in sun
console.log("TRX TX:", tx.txid || tx);

await client.end();

console.log("\n✅ Done. Save private key somewhere safe if you need to manage from outside system.");
console.log("⚠️  In production, encrypt this PK with WALLET_ENCRYPTION_KEY before storing.");
