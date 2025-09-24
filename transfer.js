#!/usr/bin/env node
// transfer.js — Pharos Testnet auto-transfer (multi PK, round-robin wallets)
// RPC utama: https://testnet.dplabs-internal.com  (ChainID 688688)

import fs from 'fs';
import readline from 'readline';
import { ethers } from 'ethers';

// ---------- RPC config ----------
const CLI_RPC = process.argv.includes('--rpc')
  ? process.argv[process.argv.indexOf('--rpc') + 1]
  : null;

const RPC_CANDIDATES = [
  CLI_RPC,
  process.env.PHAROS_RPC,
  'https://testnet.dplabs-internal.com',
].filter(Boolean);

// ---------- Utils ----------
function readLines(file) {
  if (!fs.existsSync(file)) throw new Error(`${file} tidak ditemukan`);
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('#'));
}

function readWallets(file = 'wallet.txt') {
  const lines = readLines(file);
  const addrs = lines.filter(l => {
    try { return ethers.isAddress(l); } catch { return false; }
  });
  if (addrs.length === 0) throw new Error(`${file} kosong / tidak ada alamat valid`);
  return addrs;
}

function readPKs(file = 'pk.txt') {
  const lines = readLines(file);
  const pks = lines.filter(l => /^0x[0-9a-fA-F]{64}$/.test(l));
  if (pks.length === 0) throw new Error(`${file} kosong / tidak ada PK valid (0x + 64 hex)`);
  return pks;
}

async function prompt(question, { hidden = false, defaultValue = null } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (!hidden) {
    const q = defaultValue !== null ? `${question} (default ${defaultValue}): ` : `${question}: `;
    return new Promise(resolve => rl.question(q, ans => { rl.close(); resolve(ans.trim() || (defaultValue ?? '').toString()); }));
  }
  // hidden input
  return await new Promise((resolve) => {
    process.stdout.write(question + ': ');
    const stdin = process.stdin;
    stdin.setRawMode(true);
    let value = '';
    const onData = (ch) => {
      ch = String(ch);
      if (ch === '\r' || ch === '\n' || ch === '\u0004') {
        stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(value.trim());
      } else if (ch === '\u0003') {
        stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        rl.close();
        process.exit(1);
      } else if (ch === '\u007f') {
        if (value.length) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
      } else {
        value += ch;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
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

// ---------- Main ----------
(async () => {
  try {
    const recipients = readWallets('wallet.txt');
    const pkList = readPKs('pk.txt');

    console.log(`PK count: ${pkList.length}`);
    console.log(`Wallet recipients: ${recipients.length}\n`);

    const amountStr = await prompt('Berapa Token (PHRS) per transfer', { defaultValue: '0.0001' });
    const txCountStr = await prompt('Berapa Banyak TX (per wallet)', { defaultValue: '1' });

    const amount = Number(amountStr);
    const txCount = parseInt(txCountStr, 10);
    if (isNaN(amount) || amount <= 0) throw new Error('Nilai token harus angka > 0');
    if (!Number.isInteger(txCount) || txCount < 1) throw new Error('Jumlah TX harus integer >= 1');

    console.log('\nMencari RPC yang responsif…');
    const selectedRpc = await pickWorkingRpc(RPC_CANDIDATES);
    console.log(`✔ Menggunakan RPC: ${selectedRpc}\n`);

    // Siapkan provider dan wallet signer untuk setiap PK
    const provider = new ethers.JsonRpcProvider(selectedRpc);
    const signers = pkList.map(pk => new ethers.Wallet(pk, provider));

    // Tampilkan preview mapping round-robin (maks 10)
    console.log('Preview mapping (maks 10 baris):');
    recipients.slice(0, 10).forEach((to, idx) => {
      const signer = signers[idx % signers.length];
      console.log(`${idx + 1}. ${signer.address}  ->  ${to}`);
    });
    if (recipients.length > 10) console.log(`... (+${recipients.length - 10} lainnya)\n`);

    const yes = (await prompt('Ketik YES untuk konfirmasi dan mulai kirim', { defaultValue: '' })).toUpperCase();
    if (yes !== 'YES') { console.log('Dibatalkan.'); process.exit(0); }

    const value = ethers.parseEther(String(amount));

    // Kirim round-robin: i-th recipient diproses oleh signer (i mod pkCount)
    for (let i = 0; i < recipients.length; i++) {
      const to = recipients[i];
      const signer = signers[i % signers.length];

      console.log(`\n[${i + 1}/${recipients.length}] ${signer.address} -> ${to}`);

      for (let k = 0; k < txCount; k++) {
        try {
          // Kirim sekuensial untuk menghindari replay/nonce issues
          const tx = await signer.sendTransaction({ to, value, gasLimit: 21000n });
          console.log(`  TX #${k + 1}: ${tx.hash}`);
          // jeda ringan agar nonce tersinkronisasi
          await new Promise(r => setTimeout(r, 300));
        } catch (err) {
          console.error(`  Gagal TX #${k + 1}:`, err?.message ?? err);
          // lanjut ke TX berikutnya
        }
      }
      // jeda antar wallet opsional
      await new Promise(r => setTimeout(r, 300));
    }

    console.log('\nSelesai.');
  } catch (err) {
    console.error('Error:', err?.message ?? err);
    process.exit(1);
  }
})();
