// trade.js

// --- 設定換算參數（初始預設值，可由 API 更新） ---
let CURRENT_NOVA_PRICE = 1000000;  // 單位：這裡示範值，之後會更新
// 換算公式：
// BUY: NOVA = SOL * (1e9 / CURRENT_NOVA_PRICE)
// SELL: SOL = NOVA * (CURRENT_NOVA_PRICE / 1e9)

// --- 取得 DOM 元素 ---
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatus = document.getElementById('walletStatus');
const solInput = document.getElementById('solInput');
const novaInput = document.getElementById('novaInput');
const swapBtn = document.getElementById('swapBtn');
const tradeStatus = document.getElementById('tradeStatus');
const priceStatus = document.getElementById('priceStatus');

let walletPublicKey = null;
let activeField = null; // "sol" 或 "nova"

// --- 使用 CoinGecko API 根據合約地址查詢最新價格 ---
// 這裡使用 Solana 的 coin 查詢格式，請根據 CoinGecko 文件確認
async function fetchCurrentPrice() {
    try {
      // 用 Geckoterminal 的 API 端點查詢，請依照實際 API 文件替換 URL 與必要參數
      const contractAddress = "5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX"; // 你的 mint PDA
      const url = `https://api.geckoterminal.com/api/v1/markets/solana/${contractAddress}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      console.log("Geckoterminal API response:", data);
      
      if (data && data.data && data.data.price) {
        // 假設回傳的價格單位是 SOL，乘以 1e6 作為我們的換算依據（僅示範用途）
        CURRENT_NOVA_PRICE = data.data.price * 1e6;
        priceStatus.innerText = `Current NOVA Price updated: ${CURRENT_NOVA_PRICE}`;
      } else {
        priceStatus.innerText = "Price data missing in Geckoterminal response; using default value.";
      }
    } catch (err) {
      console.error("Price fetch error:", err);
      priceStatus.innerText = `Price fetch error: ${err.message}`;
    }
  }  
// 頁面載入時先更新價格，並每 5 分鐘更新一次
fetchCurrentPrice();
setInterval(fetchCurrentPrice, 5 * 60 * 1000);

// --- 當 SOL 輸入時自動更新 NOVA 預估值 ---
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
  // 計算公式： NOVA = SOL * (1e9 / CURRENT_NOVA_PRICE)
  const novaVal = solValue * (1e9 / CURRENT_NOVA_PRICE);
  novaInput.value = novaVal.toFixed(0);
  activeField = "sol";
}

// --- 當 NOVA 輸入時自動更新 SOL 預估值 ---
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
  // 計算公式： SOL = NOVA * (CURRENT_NOVA_PRICE / 1e9)
  const solVal = novaValue * (CURRENT_NOVA_PRICE / 1e9);
  solInput.value = solVal.toFixed(4);
  activeField = "nova";
}

// 防止相互觸發
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
// 根據 activeField 決定執行買入（使用 SOL 輸入）或賣出（使用 NOVA 輸入）
// 模擬的交易：使用 SystemProgram.transfer 將 lamports 轉帳給自己（僅示範）
async function swapNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }
  try {
    const connection = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com", "processed");
    const fromPubkey = new solanaWeb3.PublicKey(walletPublicKey);
    let transaction;
    if (activeField === "sol") {
      const solValue = parseFloat(solInput.value);
      if (isNaN(solValue) || solValue <= 0) {
        tradeStatus.innerText = "Please enter a valid SOL amount.";
        return;
      }
      const lamports = Math.round(solValue * 1e9);
      // 模擬買入：以 SOL 輸入對應換算出的 NOVA 數量（僅示範，實際應呼叫合約的 buy 函式）
      transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey,
          toPubkey: fromPubkey,
          lamports: lamports,
        })
      );
      tradeStatus.innerText = `Executing Buy: ${solValue} SOL will convert to ${ (solValue * (1e9 / CURRENT_NOVA_PRICE)).toFixed(0) } NOVA (simulated)...\n`;
    } else if (activeField === "nova") {
      const novaValue = parseFloat(novaInput.value);
      if (isNaN(novaValue) || novaValue <= 0) {
        tradeStatus.innerText = "Please enter a valid NOVA amount.";
        return;
      }
      const solEquivalent = novaValue * (CURRENT_NOVA_PRICE / 1e9);
      const lamports = Math.round(solEquivalent * 1e9);
      // 模擬賣出：以 NOVA 輸入對應換算回的 SOL 數量（僅示範，實際應呼叫合約的 sell 函式）
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
