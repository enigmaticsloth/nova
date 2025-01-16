// trade.js

// --- 換算參數（預設值） ---
let CURRENT_NOVA_PRICE = 1000000;  // 預設匯率，如從 API 更新則覆蓋該數值
// 換算公式：
// BUY: NOVA = SOL * (1e9 / CURRENT_NOVA_PRICE)
// SELL: SOL = NOVA * (CURRENT_NOVA_PRICE / 1e9)

// 取得 DOM 元素
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatus = document.getElementById('walletStatus');
const solInput = document.getElementById('solInput');
const novaInput = document.getElementById('novaInput');
const swapBtn = document.getElementById('swapBtn');
const tradeStatus = document.getElementById('tradeStatus');
const priceStatus = document.getElementById('priceStatus');

let walletPublicKey = null;
let activeField = null;  // "sol" 或 "nova"

// --- 自動取得 NOVA 價格（示範用，請根據需求調整 API URL 與回應格式） ---
async function fetchCurrentPrice() {
  try {
    // 使用 CoinGecko API 範例，注意：請確認 nova 的 coin id
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=nova-token&vs_currencies=sol");
    const data = await response.json();
    if (data && data["nova-token"] && data["nova-token"].sol) {
      CURRENT_NOVA_PRICE = data["nova-token"].sol * 1e6; 
      // 假設 API 返回: { "nova-token": { "sol": 0.001 } }
      // 將 0.001 SOL 換算為 1e6 單位 (示範用途)，你可以根據實際需求轉換
      priceStatus.innerText = `Current NOVA Price updated: ${CURRENT_NOVA_PRICE}`;
    } else {
      priceStatus.innerText = "Failed to fetch price, using default value.";
    }
  } catch (err) {
    priceStatus.innerText = `Price fetch error: ${err.message}`;
  }
}

// 每 5 分鐘自動更新匯率
setInterval(fetchCurrentPrice, 5 * 60 * 1000);
// 頁面載入時先更新一次
fetchCurrentPrice();

// --- 更新換算結果 ---
function updateNovaFromSOL() {
  if (!solInput.value) {
    novaInput.value = "";
    return;
  }
  const solValue = parseFloat(solInput.value);
  if (isNaN(solValue)) {
    novaInput.value = "";
    return;
  }
  // 計算 NOVA = SOL * (1e9 / CURRENT_NOVA_PRICE)
  const novaVal = solValue * (1e9 / CURRENT_NOVA_PRICE);
  novaInput.value = novaVal.toFixed(0);
  activeField = "sol";
}

function updateSOLFromNOVA() {
  if (!novaInput.value) {
    solInput.value = "";
    return;
  }
  const novaValue = parseFloat(novaInput.value);
  if (isNaN(novaValue)) {
    solInput.value = "";
    return;
  }
  // 計算 SOL = NOVA * (CURRENT_NOVA_PRICE / 1e9)
  const solVal = novaValue * (CURRENT_NOVA_PRICE / 1e9);
  solInput.value = solVal.toFixed(4);
  activeField = "nova";
}

let isUpdating = false;
solInput.addEventListener('input', () => {
  if (isUpdating) return;
  isUpdating = true;
  updateNovaFromSOL();
  isUpdating = false;
});
novaInput.addEventListener('input', () => {
  if (isUpdating) return;
  isUpdating = true;
  updateSOLFromNOVA();
  isUpdating = false;
});

// --- 連接 Phantom 錢包 ---
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
    walletStatus.innerText = "Phantom wallet not found. Please install the Phantom extension.";
  }
}

// --- Swap 函式 ---
// 根據 activeField 判斷執行買入或賣出（模擬交易）
async function swapNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }
  try {
    const connection = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com", "processed");
    const fromPubkey = new solanaWeb3.PublicKey(walletPublicKey);
    let transaction;
    if (activeField === "sol") { // 以 SOL 為基準進行買入
      const solValue = parseFloat(solInput.value);
      if (isNaN(solValue) || solValue <= 0) {
        tradeStatus.innerText = "Please enter a valid SOL amount.";
        return;
      }
      // 此處換算：用 SOL * (1e9 / CURRENT_NOVA_PRICE) 得到預估 NOVA 數量（僅示範）
      const lamports = Math.round(solValue * 1e9);
      transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey,
          toPubkey: fromPubkey,
          lamports: lamports,
        })
      );
      tradeStatus.innerText = `Executing Buy: ${solValue} SOL will convert to ${solValue * (1e9 / CURRENT_NOVA_PRICE).toFixed(0)} NOVA (simulated)...\n`;
    } else if (activeField === "nova") { // 以 NOVA 為基準進行賣出
      const novaValue = parseFloat(novaInput.value);
      if (isNaN(novaValue) || novaValue <= 0) {
        tradeStatus.innerText = "Please enter a valid NOVA amount.";
        return;
      }
      // 換算回 SOL = NOVA * (CURRENT_NOVA_PRICE / 1e9)
      const solEquivalent = novaValue * (CURRENT_NOVA_PRICE / 1e9);
      const lamports = Math.round(solEquivalent * 1e9);
      transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey,
          toPubkey: fromPubkey,
          lamports: lamports,
        })
      );
      tradeStatus.innerText = `Executing Sell: ${novaValue} NOVA (≈${solEquivalent.toFixed(4)} SOL) (simulated)...\n`;
    } else {
      tradeStatus.innerText = "Please enter a value in either SOL or NOVA input.";
      return;
    }
    const { signature } = await window.solana.signAndSendTransaction({ transaction, connection });
    tradeStatus.innerText += `Transaction sent! Signature: ${signature}`;
  } catch (err) {
    tradeStatus.innerText = `Swap transaction error: ${err.message}`;
  }
}

// --- 綁定事件 ---
connectWalletBtn.addEventListener('click', connectWallet);
swapBtn.addEventListener('click', swapNOVA);
