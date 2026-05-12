// Inspect TRON Nile testnet state for E2E payment testing
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const TronWeb = (await import("tronweb")).default ?? (await import("tronweb"));
const TronWebClass = TronWeb.TronWeb || TronWeb.default || TronWeb;

const FULL_HOST = process.env.NEXT_PUBLIC_TRON_FULL_HOST || "https://nile.trongrid.io";
const TRPB_ADDR = process.env.NEXT_PUBLIC_TRPB_TOKEN_ADDRESS;
const ESCROW_ADDR = process.env.NEXT_PUBLIC_JOB_ESCROW_ADDRESS;
const DEPLOYER_KEY = process.env.TRON_DEPLOYER_PRIVATE_KEY;

const tronWeb = new TronWebClass({
  fullHost: FULL_HOST,
  privateKey: DEPLOYER_KEY,
});

console.log("=== TRON Nile State ===");
console.log("Network:", FULL_HOST);
console.log("TRPB Token:", TRPB_ADDR);
console.log("Job Escrow:", ESCROW_ADDR);

// Deployer wallet
const deployerAddress = tronWeb.address.fromPrivateKey(DEPLOYER_KEY);
console.log("\nDeployer wallet:", deployerAddress);

// TRX balance (gas)
const trxBalance = await tronWeb.trx.getBalance(deployerAddress);
console.log(`  TRX (gas): ${(trxBalance / 1_000_000).toFixed(2)} TRX`);

// TRPB balance via TRC-20 contract
async function getTRPBBalance(addr) {
  try {
    const contract = await tronWeb.contract().at(TRPB_ADDR);
    const result = await contract.balanceOf(addr).call();
    // TRPB has 6 decimals (assume); else default 18
    const decimals = await contract.decimals().call();
    const divisor = 10n ** BigInt(decimals);
    return Number(BigInt(result.toString()) / divisor);
  } catch (e) {
    return `error: ${e.message}`;
  }
}

const deployerTRPB = await getTRPBBalance(deployerAddress);
console.log(`  TRPB:      ${deployerTRPB}`);

// Student + Employer wallets from DB
const client = new pg.Client({
  host: "db.vkiofmhddlzffgzstoml.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "Prach4843#*",
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const targets = ["bizz@rmutl.ac.th", "artid_lu67@live.rmutl.ac.th", "ampai.pu@rmutl.ac.th"];
const { rows } = await client.query(
  `SELECT email, role, wallet_address FROM skc_users WHERE email = ANY($1)`,
  [targets]
);

console.log("\n=== Test users TRON wallets ===");
for (const u of rows) {
  const walletStr = u.wallet_address || "(not bound)";
  let onchain = "n/a";
  if (u.wallet_address) {
    const trx = await tronWeb.trx.getBalance(u.wallet_address);
    const trpb = await getTRPBBalance(u.wallet_address);
    onchain = `TRX=${(trx / 1_000_000).toFixed(2)}, TRPB=${trpb}`;
  }
  console.log(`  [${u.role.padEnd(14)}] ${u.email.padEnd(30)} ${walletStr.slice(0,10)}... ${onchain}`);
}

await client.end();
