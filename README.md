# 🚀 Pharos Testnet Auto Transfer Scripts

Repository ini berisi script otomatis untuk melakukan transfer di jaringan **Pharos Testnet (ChainID 688688)**:

- **transfer.js** → Kirim native token (PHRS) secara otomatis ke banyak wallet menggunakan sistem round-robin multi private key (PK).
- **usdt_transfer.js** → Kirim token **USDT (CA: `0xD4071393f8716661958F766DF660033b3d35fD29`)** ke banyak wallet, juga mendukung sistem multi-PK round-robin.

---

## 📦 Persiapan

1. Install dependencies:
   ```bash
   npm install ethers
   ```

2. Siapkan file berikut:
   - **pk.txt** → berisi private key (satu baris satu PK).
   - **wallet.txt** → berisi daftar wallet tujuan (satu baris satu alamat EVM).

---

## ⚡ Cara Pakai

### Transfer Native PHRS
```bash
node transfer.js
```

### Transfer USDT (Pharos)
```bash
node usdt_transfer.js
```

Kamu akan diminta input:
- Jumlah token yang ingin dikirim.
- Berapa banyak transaksi per wallet.
- Konfirmasi sebelum eksekusi.

---

## 🔄 Round-Robin PK → Wallet
- Jika ada **2 PK** di `pk.txt` dan **10 wallet** di `wallet.txt`:
  - PK1 → Wallet1  
  - PK2 → Wallet2  
  - PK1 → Wallet3  
  - PK2 → Wallet4  
  - … dan seterusnya.
- Jika hanya ada **1 PK** dan banyak wallet → PK tersebut yang akan mengirim ke semua wallet.

---

## 🛠️ RPC
Default RPC:  
```
https://testnet.dplabs-internal.com
```

Bisa diganti lewat:
```bash
node transfer.js --rpc <RPC_URL>
```
atau dengan environment variable:
```bash
export PHAROS_RPC=<RPC_URL>
```

---

## 🙌 Donasi
Jika script ini bermanfaat, dukung pengembangan dengan berdonasi ke alamat EVM berikut:

**`0xD295AA6F58b7c9a2ADb6f6c1596EAb6e4c817Ac0`**

---

## 👤 Author
Made with ❤️ by Made with ❤️ by [JaGir9](https://github.com/JaGir9)  
