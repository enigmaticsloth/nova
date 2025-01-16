// trade.js
import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { Buffer } from "buffer";  
// 將 Buffer 設定為全域
window.Buffer = window.Buffer || Buffer;

// 取得頁面上各元素
const connectWalletBtn = document.getElementById("connectWalletBtn");
const walletStatus = document.getElementById("walletStatus");
const buyBtn = document.getElementById("buyBtn");
const sellBtn = document.getElementById("sellBtn");
const tradeStatus = document.getElementById("tradeStatus");
const buyAmountInput = document.getElementById("buyAmount");
const sellAmountInput = document.getElementById("sellAmount");

let walletPublicKey = null;

// 連接 Phantom 錢包
export async function connectWallet() {
  if (window.solana && window.solana.isPhantom) {
    try {
      const resp = await window.solana.connect();
      walletPublicKey = resp.publicKey.toString();
      walletStatus.innerText = `Wallet connected: ${walletPublicKey}`;
    } catch (err) {
      walletStatus.innerText = `Connect failed: ${err.message}`;
    }
  } else {
    walletStatus.innerText = "Phantom wallet not found. Please install the Phantom extension.";
  }
}

// Buy 函式：買入以 SOL 為單位的金額
export async function buyNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }
  let solValue = parseFloat(buyAmountInput.value);
  if (isNaN(solValue) || solValue <= 0) {
    tradeStatus.innerText = "Please enter a valid SOL amount.";
    return;
  }
  // 1 SOL = 1e9 lamports
  const lamports = Math.round(solValue * 1e9);
  try {
    const connection = new Connection("https://api.mainnet-beta.solana.com", "processed");
    const fromPubkey = new PublicKey(walletPublicKey);

    // 模擬交易：將 lamports 轉給自己（此處僅作示範）
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey: fromPubkey,
        lamports: lamports,
      })
    );

    const { signature } = await window.solana.signAndSendTransaction({ transaction, connection });
    tradeStatus.innerText = `Buy transaction sent! Signature: ${signature}`;
  } catch (err) {
    tradeStatus.innerText = `Buy transaction error: ${err.message}`;
  }
}

// Sell 函式：賣出以 NOVA 為單位的金額
export async function sellNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }
  let novaValue = parseFloat(sellAmountInput.value);
  if (isNaN(novaValue) || novaValue <= 0) {
    tradeStatus.innerText = "Please enter a valid NOVA amount.";
    return;
  }
  try {
    const connection = new Connection("https://api.mainnet-beta.solana.com", "processed");
    const fromPubkey = new PublicKey(walletPublicKey);

    // 模擬交易示範：同樣轉 10000 lamports 給自己
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey: fromPubkey,
        lamports: 10000,
      })
    );
    const { signature } = await window.solana.signAndSendTransaction({ transaction, connection });
    tradeStatus.innerText = `Sell transaction sent! Signature: ${signature}`;
  } catch (err) {
    tradeStatus.innerText = `Sell transaction error: ${err.message}`;
  }
}

// 綁定按鈕事件
connectWalletBtn.addEventListener("click", connectWallet);
buyBtn.addEventListener("click", buyNOVA);
sellBtn.addEventListener("click", sellNOVA);
