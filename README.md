# Pharos Auto Transfer (Native & USDT) — by @JaGir9

Automasi transfer **PHRS (native)** dan **USDT (ERC-20)** di **Pharos Testnet (chainId 688688)**, mendukung **multi-private key** dan **multi-wallet** dengan **round-robin sender → recipient**.

- **PHRS**: `transfer.js` (native coin)  
- **USDT (ERC-20)**: `usdt_transfer.js` — kontrak **USDT**: `0xD4071393f8716661958F766DF660033b3d35fD29`

> **Round-robin**: pk1→w1, pk2→w2, pk1→w3, pk2→w4, … (jika hanya 1 PK, maka PK itu kirim ke semua wallet).

## Fitur
- 🚀 Support multi-PK (`pk.txt`) & multi-wallet (`wallet.txt`).
- 🔄 Round-robin mapping pengirim → penerima.
- ⛽ Estimasi gas & RPC fallback (`--rpc` atau env `PHAROS_RPC`).
- 📜 Logging transaksi dengan hash.
- ✅ Input interaktif jumlah token & jumlah TX.

## Setup
```bash
git clone https://github.com/JaGir9/pharos-transfer.git
cd pharos-transfer
npm install
```

## File Struktur
```
pharos-transfer/
 ├─ transfer.js        # PHRS native auto transfer
 ├─ usdt_transfer.js   # USDT ERC-20 transfer
 ├─ pk.txt             # daftar private keys (0x...)
 ├─ wallet.txt         # daftar wallet tujuan (0x...)
 └─ README.md
```

## Contoh pk.txt
```
0xPrivateKey-1
0xPrivateKey-2
```

## Contoh wallet.txt
```
0xWallet-1
0xWallet-2
0xWallet-3
```

## Jalankan Script
### Native PHRS
```bash
node transfer.js --rpc https://testnet.dplabs-internal.com
```

### USDT ERC-20
```bash
node usdt_transfer.js --rpc https://testnet.dplabs-internal.com
```

Ikuti prompt interaktif (jumlah token, jumlah TX, konfirmasi YES).

## Catatan
- ChainID: **688688** (Pharos Testnet).
- Gunakan hanya di testnet, **jangan pakai PK utama**.
- Gunakan RPC stabil (default: `https://testnet.dplabs-internal.com`).

---
✍️ Dibuat oleh [@JaGir9](https://github.com/JaGir9)
