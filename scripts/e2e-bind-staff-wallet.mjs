// Generate + bind wallet for staff (Ampai) so 3-way split mirrors fully on-chain
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });
const TronWebMod = await import("tronweb");
const TronWeb = TronWebMod.TronWeb || TronWebMod.default || TronWebMod;
const tw = new TronWeb({ fullHost: "https://nile.trongrid.io", privateKey: process.env.TRON_DEPLOYER_PRIVATE_KEY });

const w = await TronWeb.createAccount();
console.log("Staff (Ampai) wallet:", w.address.base58);
console.log("Private key:        ", w.privateKey);

const c = new pg.Client({ host:"db.vkiofmhddlzffgzstoml.supabase.co", port:5432, database:"postgres", user:"postgres", password:"Prach4843#*", ssl:{rejectUnauthorized:false} });
await c.connect();
await c.query(`UPDATE skc_users SET wallet_address = $1 WHERE email = 'ampai.pu@rmutl.ac.th'`, [w.address.base58]);

const tx = await tw.trx.sendTrx(w.address.base58, 5_000_000);
console.log("Funded 5 TRX, TX:", tx.txid || tx);

await c.end();
