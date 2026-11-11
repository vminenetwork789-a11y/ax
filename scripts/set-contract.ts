import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

async function main() {
  const args = process.argv.slice(2);
  const newContract = args[0]?.trim();
  const newUsdt = args[1]?.trim();

  if (!newContract || !ethers.isAddress(newContract)) {
    console.error('❌ กรุณาระบุที่อยู่ Smart Contract Address (0x...) ที่ถูกต้อง');
    console.log('📌 วิธีใช้งาน:');
    console.log('   npm run set-contract -- 0xYourNewContractAddress [0xOptionalUsdtAddress]');
    process.exit(1);
  }

  if (newUsdt && !ethers.isAddress(newUsdt)) {
    console.error('❌ รูปแบบ USDT Token Address ไม่ถูกต้อง:', newUsdt);
    process.exit(1);
  }

  console.log(`🔄 กำลังตั้งค่า Smart Contract Address ใหม่เป็น: ${newContract}`);

  // 1. Update prisma/contract-config.json
  const configPath = path.join(ROOT_DIR, 'prisma', 'contract-config.json');
  let configData: any = {
    contractAddress: newContract,
    usdtAddress: newUsdt || '0x05f24E1F598DF1aE8d0B424ce978f8ea33bB752b',
    chainId: 97,
    networkName: 'BNB Smart Chain Testnet',
    rpcUrl: 'https://bsc-testnet-rpc.publicnode.com',
    blockExplorerUrl: 'https://testnet.bscscan.com',
    updatedAt: new Date().toISOString(),
  };

  if (fs.existsSync(configPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      configData = {
        ...existing,
        contractAddress: newContract,
        usdtAddress: newUsdt || existing.usdtAddress || '0x05f24E1F598DF1aE8d0B424ce978f8ea33bB752b',
        updatedAt: new Date().toISOString(),
      };
    } catch {
      // use default structure
    }
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf-8');
  console.log(`✅ 1/3 อัปเดตไฟล์ฐานข้อมูล prisma/contract-config.json สำเร็จ`);

  // 2. Update .env if exists
  const envPath = path.join(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    try {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      const replaceOrAppend = (key: string, val: string) => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${val}`);
        } else {
          envContent += `\n${key}=${val}`;
        }
      };
      replaceOrAppend('CONTRACT_ADDRESS', newContract);
      replaceOrAppend('OVERRIDE_CONTRACT_ADDRESS', newContract);
      replaceOrAppend('VITE_CONTRACT_ADDRESS', newContract);
      if (newUsdt) {
        replaceOrAppend('USDT_ADDRESS', newUsdt);
        replaceOrAppend('VITE_USDT_ADDRESS', newUsdt);
      }
      fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
      console.log(`✅ 2/3 อัปเดตไฟล์ .env สำเร็จ`);
    } catch (e: any) {
      console.warn(`⚠️ ไม่สามารถแก้ไข .env:`, e.message);
    }
  } else {
    console.log(`ℹ️ 2/3 ข้ามไฟล์ .env (ใช้ค่าจาก prisma/contract-config.json เป็นหลัก)`);
  }

  // 3. Notify running server on localhost:3000 so it reloads immediately without restart
  try {
    const res = await fetch('http://localhost:3000/api/config/contract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractAddress: newContract,
        usdtAddress: configData.usdtAddress,
      }),
    });
    if (res.ok) {
      console.log(`✅ 3/3 แจ้งเตือนเซิร์ฟเวอร์ที่รันอยู่สำเร็จ! ระบบสลับไปใช้สัญญาใหม่และซิงก์ผังสายงานทันทีโดยไม่ต้องรีสตาร์ท`);
    } else {
      console.log(`ℹ️ 3/3 บันทึกไฟล์แล้ว (หากใช้ PM2 สามารถรัน: pm2 restart all)`);
    }
  } catch {
    console.log(`ℹ️ 3/3 บันทึกไฟล์แล้ว (เซิร์ฟเวอร์จะใช้สัญญานี้ทันทีเมื่อเริ่มต้นทำงาน)`);
  }
}

main();
