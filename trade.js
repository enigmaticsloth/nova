// trade.js

// 固定參數：假設 1 NOVA 價格相當於 1,000,000 lamports 以及 10% 額外獎勵
const CURRENT_NOVA_PRICE = 1000000; // 每一個 NOVA 所需的 lamports換算值
const REWARD_PERCENT = 10; // 10% 額外獎勵

// 假設賣出時收取 5% 手續費
const SELL_FEE_PERCENT = 5;

let walletPublicKey = null;

// 取得元素
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatus = document.getElementById('walletStatus');
const solInput = document.getElementById('solInput');
const novaOutput = document.getElementById('novaOutput');
const buyBtn = document.getElementById('buyBtn');
const novaInput = document.getElementById('novaInput');
const solOutput = document.getElementById('solOutput');
const sellBtn = document.getElementById('sellBtn');
const tradeStatus = document.getElementById('tradeStatus');

// 連接 Phantom 錢包（需在 HTTP/HTTPS 下）
async function connectWallet() {
  if (window.solana && window.solana.isPhantom) {
    try {
      const resp = await window.solana.connect();
      walletPublicKey = resp.publicKey.toString();
      walletStatus.innerText = `Wallet connected: ${walletPublicKey}`;
    } catch (err) {
      walletStatus.innerText = `Connect failed: ${err.message}`;
    }
  } else {
    walletStatus.innerText = "Phantom wallet not found. Please install Phantom.";
  }
}

// 依據輸入的 SOL 金額計算預估 NOVA 數量
function recalcBuy() {
  const solValue = parseFloat(solInput.value);
  if (isNaN(solValue) || solValue <= 0) {
    novaOutput.innerText = "0";
    return;
  }
  // 將 SOL 轉換成 lamports (1 SOL = 1e9 lamports)
  const lamports = solValue * 1e9;
  // 計算基礎 NOVA 數量
  const baseNova = lamports / CURRENT_NOVA_PRICE;
  // 加上獎勵百分比：例如 10% 額外獎勵
  const estimatedNova = baseNova * (1 + REWARD_PERCENT / 100);
  novaOutput.innerText = estimatedNova.toFixed(2);
}

// 依據輸入的 NOVA 數量計算預估可換回的 SOL 數量（扣除 5% 手續費）
function recalcSell() {
  const novaValue = parseFloat(novaInput.value);
  if (isNaN(novaValue) || novaValue <= 0) {
    solOutput.innerText = "0";
    return;
  }
  // 計算理論上換算回 SOL 的 lamports：novas * CURRENT_NOVA_PRICE
  const lamportsBase = novaValue * CURRENT_NOVA_PRICE;
  // 換回 SOL：lamports / 1e9
  const solBase = lamportsBase / 1e9;
  // 扣除 5% 手續費
  const solAfterFee = solBase * ((100 - SELL_FEE_PERCENT) / 100);
  solOutput.innerText = solAfterFee.toFixed(4);
}

// 綁定輸入事件，隨時更新結果
solInput.addEventListener('input', recalcBuy);
novaInput.addEventListener('input', recalcSell);

// Buy 函式
async function buyNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }
  const solValue = parseFloat(solInput.value);
  if (isNaN(solValue) || solValue <= 0) {
    tradeStatus.innerText = "Please enter a valid SOL amount.";
    return;
  }
  // 轉換 SOL 至 lamports
  const lamports = Math.round(solValue * 1e9);
  try {
    const connection = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com", "processed");
    const fromPubkey = new solanaWeb3.PublicKey(walletPublicKey);
    
    // 這裡示範一筆交易：將輸入的 lamports 轉帳到自己（僅作範例，實際上會呼叫合約 buy）
    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
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

// Sell 函式
async function sellNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }
  const novaValue = parseFloat(novaInput.value);
  if (isNaN(novaValue) || novaValue <= 0) {
    tradeStatus.innerText = "Please enter a valid NOVA amount.";
    return;
  }
  try {
    const connection = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com", "processed");
    const fromPubkey = new solanaWeb3.PublicKey(walletPublicKey);
    
    // 這裡示範一筆交易：轉帳 0.00001 SOL (僅作範例，實際上會呼叫合約 sell)
    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
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
document.getElementById('connectWalletBtn').addEventListener('click', connectWallet);
document.getElementById('buyBtn').addEventListener('click', buyNOVA);
document.getElementById('sellBtn').addEventListener('click', sellNOVA);
