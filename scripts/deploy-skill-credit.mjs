/**
 * Deploy SkillCredit (Soul-Bound Token) to TRON Nile Testnet
 *
 * Usage:
 *   node scripts/deploy-skill-credit.mjs
 *
 * Required env:
 *   TRON_DEPLOYER_PRIVATE_KEY
 *
 * After deployment, this script will:
 *   1. Compile SkillCredit.sol
 *   2. Deploy to Nile
 *   3. Print contract address
 *   4. Append to .env.local as SKILL_CREDIT_CONTRACT=<address>
 */

import { TronWeb } from "tronweb";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Load .env.local
function loadEnv() {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) {
    console.error("❌ ไม่พบ .env.local");
    process.exit(1);
  }
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

loadEnv();

const PRIVATE_KEY = process.env.TRON_DEPLOYER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("❌ ไม่พบ TRON_DEPLOYER_PRIVATE_KEY ใน .env.local");
  process.exit(1);
}

const NILE_HOST = "https://nile.trongrid.io";
const tronWeb = new TronWeb({ fullHost: NILE_HOST, privateKey: PRIVATE_KEY });
const deployerAddress = tronWeb.address.fromPrivateKey(PRIVATE_KEY);

console.log(`\n🔑 Deployer: ${deployerAddress}`);
console.log(`🌐 Network: Nile Testnet\n`);

// ============ Compile ============

function compile(contractName) {
  const contractPath = resolve(ROOT, `contracts/${contractName}.sol`);
  console.log(`📦 Compiling ${contractName}.sol...`);

  try {
    const out = execSync(
      `solc --combined-json abi,bin ${contractPath} --allow-paths ${resolve(ROOT, "contracts")}`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
    const parsed = JSON.parse(out);
    const key = Object.keys(parsed.contracts).find(k => k.includes(`${contractName}.sol:${contractName}`));
    if (!key) throw new Error(`contract ${contractName} not found in compiler output`);
    const { abi, bin } = parsed.contracts[key];
    return { abi: typeof abi === "string" ? JSON.parse(abi) : abi, bytecode: bin };
  } catch (err) {
    console.error("❌ Compilation failed:", err.message);
    console.error("   ติดตั้ง solc: npm install -g solc@0.8.20  (หรือ brew install solidity)");
    process.exit(1);
  }
}

// ============ Deploy ============

async function deployContract(contractName) {
  const { abi, bytecode } = compile(contractName);

  console.log(`🚀 Deploying ${contractName}...`);
  const contract = await tronWeb.contract().new({
    abi,
    bytecode,
    feeLimit: 1_500_000_000, // 1500 TRX max
    callValue: 0,
    userFeePercentage: 100,
    originEnergyLimit: 10_000_000,
    parameters: [],
  });

  const address = contract.address;
  const base58 = tronWeb.address.fromHex(address);

  console.log(`✅ ${contractName} deployed:`);
  console.log(`   Hex:    ${address}`);
  console.log(`   Base58: ${base58}`);

  // Save ABI
  const abiDir = resolve(ROOT, "src/lib/tron/abi");
  if (!existsSync(abiDir)) mkdirSync(abiDir, { recursive: true });
  writeFileSync(resolve(abiDir, `${contractName}.json`), JSON.stringify(abi, null, 2));
  console.log(`   ABI saved → src/lib/tron/abi/${contractName}.json`);

  return { address: base58, hex: address, abi };
}

// ============ Update .env.local ============

function updateEnv(key, value) {
  const envPath = resolve(ROOT, ".env.local");
  let content = readFileSync(envPath, "utf-8");
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}\n`;
  }
  writeFileSync(envPath, content);
  console.log(`   ${key} saved → .env.local`);
}

// ============ Main ============

try {
  const balance = await tronWeb.trx.getBalance(deployerAddress);
  console.log(`💰 Balance: ${balance / 1_000_000} TRX\n`);

  if (balance < 500_000_000) {
    console.error("❌ TRX ไม่พอ (ต้องการอย่างน้อย 500 TRX)");
    console.error("   ขอจาก faucet: https://nileex.io/join/getJoinPage");
    process.exit(1);
  }

  // Deploy SkillCredit
  const skillCredit = await deployContract("SkillCredit");

  updateEnv("SKILL_CREDIT_CONTRACT", skillCredit.address);
  updateEnv("NEXT_PUBLIC_SKILL_CREDIT_CONTRACT", skillCredit.address);

  console.log("\n🎉 Deployment complete!");
  console.log("\n📋 Next steps:");
  console.log(`   1. Verify on TRONScan: https://nile.tronscan.org/#/contract/${skillCredit.address}`);
  console.log(`   2. Add backend address as minter:`);
  console.log(`      await contract.addMinter('<backend-address>').send()`);
  console.log(`   3. Restart dev server to load new env vars`);
} catch (err) {
  console.error("\n❌ Deploy failed:", err.message);
  process.exit(1);
}
