// trade.js

// --- 初始換算參數 ---
let CURRENT_NOVA_PRICE_USD = 0.00123;  // 預設值（USD），若 API 回傳會更新
const SOL_USD_PRICE = 20;              // 假設 SOL 固定 20 美元

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

// --- 從 Geckoterminal API 取得價格 ---
// 以 /simple/networks/solana/token_price/{addresses} 查詢
async function fetchCurrentPrice() {
  try {
    // 請確認 Geckoterminal API endpoint 與合約地址是否正確
    const contractAddress = "5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX";
    const url = `https://api.geckoterminal.com/simple/networks/solana/token_price/${contractAddress}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    console.log("Geckoterminal API response:", data);
    // 假設回傳格式：
    // {
    //   "data": {
    //      "5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX": { "usd": 0.00123 }
    //   }
    // }
    if (
      data &&
      data.data &&
      data.data[contractAddress] &&
      data.data[contractAddress].usd
    ) {
      CURRENT_NOVA_PRICE_USD = data.data[contractAddress].usd;
      priceStatus.innerText = `Current NOVA Price: $${CURRENT_NOVA_PRICE_USD.toFixed(6)} USD`;
    } else {
      priceStatus.innerText = "Price data missing in API response; using default value.";
    }
  } catch (err) {
    console.error("Price fetch error:", err);
    priceStatus.innerText = `Failed to fetch price, using default value. Error: ${err.message}`;
  }
}

// 每 5 分鐘更新一次價格，頁面載入時先更新
fetchCurrentPrice();
setInterval(fetchCurrentPrice, 5 * 60 * 1000);

// --- 根據 SOL 輸入更新 NOVA 預估值 ---
// 計算公式：NOV A = SOL × (SOL_USD_PRICE / CURRENT_NOVA_PRICE_USD)
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
  const novaVal = solValue * (SOL_USD_PRICE / CURRENT_NOVA_PRICE_USD);
  novaInput.value = novaVal.toFixed(0);
  activeField = "sol";
}

// --- 根據 NOVA 輸入更新 SOL 預估值 ---
// 計算公式：SOL = NOVA × (CURRENT_NOVA_PRICE_USD / SOL_USD_PRICE)
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
  const solVal = novaValue * (CURRENT_NOVA_PRICE_USD / SOL_USD_PRICE);
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
// 根據 activeField 決定執行買入（以 SOL 為基準）或賣出（以 NOVA 為基準）
// 此處示範交易以 SystemProgram.transfer 轉帳給自己（僅作範例）
async function swapNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }
  try {
    const connection = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com", "processed");
    const fromPubkey = new solanaWeb3.PublicKey(walletPublicKey);
    let transaction;
    if (activeField === "sol") { // 以 SOL 輸入執行買入
      const solValue = parseFloat(solInput.value);
      if (isNaN(solValue) || solValue <= 0) {
        tradeStatus.innerText = "Please enter a valid SOL amount.";
        return;
      }
      // 以 SOL 來買入 NOVA：根據公式 NOVA = SOL * (SOL_USD_PRICE / CURRENT_NOVA_PRICE_USD)
      const lamports = Math.round(solValue * 1e9);
      transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey,
          toPubkey: fromPubkey,  // 這裡模擬交易將資金傳回自己
          lamports: lamports,
        })
      );
      tradeStatus.innerText = `Executing Buy: ${solValue} SOL will convert to ${ (solValue * (SOL_USD_PRICE / CURRENT_NOVA_PRICE_USD)).toFixed(0) } NOVA (simulated)...\n`;
    } else if (activeField === "nova") { // 以 NOVA 輸入執行賣出
      const novaValue = parseFloat(novaInput.value);
      if (isNaN(novaValue) || novaValue <= 0) {
        tradeStatus.innerText = "Please enter a valid NOVA amount.";
        return;
      }
      // 根據公式：SOL = NOVA * (CURRENT_NOVA_PRICE_USD / SOL_USD_PRICE)
      const solEquivalent = novaValue * (CURRENT_NOVA_PRICE_USD / SOL_USD_PRICE);
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
