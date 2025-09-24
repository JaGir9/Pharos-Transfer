#!/usr/bin/env node
// usdt_transfer.js — Auto transfer USDT (ERC20) di Pharos Testnet (round-robin pk -> wallet)

import fs from 'fs';
import readline from 'readline';
import { ethers } from 'ethers';

// -------- Konfigurasi --------
const USDT_CA = '0xD4071393f8716661958F766DF660033b3d35fD29';
const CLI_RPC = process.argv.includes('--rpc')
  ? process.argv[process.argv.indexOf('--rpc') + 1]
  : null;

const RPC_CANDIDATES = [
  CLI_RPC,
  process.env.PHAROS_RPC,
  'https://testnet.dplabs-internal.com',
].filter(Boolean);

// -------- ABI minimal ERC20 --------
const ERC20_ABI = [
  { name: 'decimals', stateMutability: 'view', type: 'function', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'balanceOf', stateMutability: 'view', type: 'function', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'transfer', stateMutability: 'nonpayable', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'symbol', stateMutability: 'view', type: 'function', inputs: [], outputs: [{ type: 'string' }] },
];

// -------- Utils --------
function readLines(file) {
  if (!fs.existsSync(file)) throw new Error(`${file} tidak ditemukan`);
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('#'));
}

function readPKs(file = 'pk.txt') {
  const lines = readLines(file);
  const pks = lines.filter(l => /^0x[0-9a-fA-F]{64}$/.test(l));
  if (pks.length === 0) throw new Error(`${file} kosong / tidak ada PK valid (0x + 64 hex)`);
  return pks;
}

function readWallets(file = 'wallet.txt') {
  const lines = readLines(file);
  const addrs = lines.filter(l => {
    try { return ethers.isAddress(l); } catch { return false; }
  });
  if (addrs.length === 0) throw new Error(`${file} kosong / tidak ada alamat valid`);
  return addrs;
}

async function prompt(question, { defaultValue = null } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const q = defaultValue !== null ? `${question} (default ${defaultValue}): ` : `${question}: `;
  return new Promise(resolve => rl.question(q, ans => { rl.close(); resolve(ans.trim() || (defaultValue ?? '').toString()); }));
}

async function pickWorkingRpc(candidates, timeoutMs = 5000) {
  for (const url of candidates) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await Promise.race([
        provider.send('eth_blockNumber', []),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
      ]);
      const net = await provider.getNetwork();
      if (net.chainId !== 688688n) {
        console.warn(`RPC ${url} chainId=${net.chainId} (bukan 688688) — lewati`);
        continue;
      }
      return url;
    } catch (e) {
      console.warn(`RPC gagal/timeout: ${url} -> ${e.message}`);
    }
  }
  throw new Error('Tidak ada RPC responsif. Set PHAROS_RPC atau pakai --rpc <url>.');
}

function formatUnitsBigInt(x, decimals) {
  // helper log saldo (ramah dengan BigInt)
  const s = x.toString().padStart(decimals + 1, '0');
  const int = s.slice(0, -decimals) || '0';
  const frac = s.slice(-decimals).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

// -------- Main --------
(async () => {
  try {
    const pkList = readPKs('pk.txt');
    const recipients = readWallets('wallet.txt');

    console.log(`PK count         : ${pkList.length}`);
    console.log(`Wallet recipients: ${recipients.length}`);

    const amountStr = await prompt('Berapa USDT per transfer', { defaultValue: '1' });
    const txCountStr = await prompt('Berapa Banyak TX (per wallet)', { defaultValue: '1' });

    const amount = Number(amountStr);
    const txCount = parseInt(txCountStr, 10);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Jumlah USDT harus > 0');
    if (!Number.isInteger(txCount) || txCount < 1) throw new Error('TX per wallet harus integer >= 1');

    console.log('\nMencari RPC yang responsif…');
    const rpcUrl = await pickWorkingRpc(RPC_CANDIDATES);
    console.log(`✔ RPC: ${rpcUrl}\n`);

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Siapkan signer per PK
    const signers = pkList.map(pk => new ethers.Wallet(pk, provider));

    // Kontrak USDT
    const usdt = new ethers.Contract(USDT_CA, ERC20_ABI, provider);
    const [decimals, symbol] = await Promise.all([
      usdt.decimals(),
      usdt.symbol().catch(() => 'USDT'),
    ]);
    const amountUnits = ethers.parseUnits(String(amount), decimals);

    // Preview mapping (maks 10)
    console.log(`Token: ${symbol} (decimals=${decimals})`);
    console.log(`Amount per TX: ${amount} ${symbol}  |  TX per wallet: ${txCount}\n`);
    console.log('Preview mapping (maks 10 baris):');
    recipients.slice(0, 10).forEach((to, i) => {
      const signer = signers[i % signers.length];
      console.log(`${i + 1}. ${signer.address}  ->  ${to}`);
    });
    if (recipients.length > 10) console.log(`... (+${recipients.length - 10} lainnya)\n`);

    const yes = (await prompt('Ketik YES untuk konfirmasi dan mulai kirim', { defaultValue: '' })).toUpperCase();
    if (yes !== 'YES') { console.log('Dibatalkan.'); process.exit(0); }

    // Kirim round-robin
    for (let i = 0; i < recipients.length; i++) {
      const to = recipients[i];
      const signer = signers[i % signers.length];
      const me = await signer.getAddress();

      console.log(`\n[${i + 1}/${recipients.length}] ${me} -> ${to}`);

      // Cek saldo USDT signer (opsional tapi berguna)
      try {
        const bal = await usdt.connect(provider).balanceOf(me);
        const need = amountUnits * BigInt(txCount);
        console.log(`  Saldo ${symbol}: ${formatUnitsBigInt(bal, decimals)} ${symbol}`);
        if (bal < need) {
          console.warn(`  ⚠️ Saldo ${symbol} kurang untuk ${txCount} TX. Tetap lanjut, TX bisa gagal.`);
        }
      } catch {}

      for (let k = 0; k < txCount; k++) {
        try {
          // build call transfer
          const contractWithSigner = usdt.connect(signer);
          // estimasi gas (dengan fallback)
          let gasLimit;
          try {
            gasLimit = await contractWithSigner.transfer.estimateGas(to, amountUnits);
          } catch {
            gasLimit = 70000n; // fallback kasar utk ERC20 transfer
          }
          const tx = await contractWithSigner.transfer(to, amountUnits, { gasLimit });
          console.log(`  TX #${k + 1}: ${tx.hash}`);
          // jeda ringan agar nonce rapi
          await new Promise(r => setTimeout(r, 300));
        } catch (err) {
          console.error(`  Gagal TX #${k + 1}:`, err?.message ?? err);
        }
      }
      await new Promise(r => setTimeout(r, 300));
    }

    console.log('\nSelesai.');
  } catch (err) {
    console.error('Error:', err?.message ?? err);
    process.exit(1);
  }
})();
