// trade.js

// 換算公式：
// BUY: NOVA = SOL * (SOL_USD_PRICE / CURRENT_NOVA_PRICE_USD)
// SELL: SOL = NOVA * (CURRENT_NOVA_PRICE_USD / SOL_USD_PRICE)
const SOL_USD_PRICE = 20; // 固定 SOL 價格 (USD)

// 以下部分與前面一致
// --- 取得 DOM 元素 ---
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatus = document.getElementById('walletStatus');
const solInput = document.getElementById('solInput');
const novaInput = document.getElementById('novaInput');
const swapBtn = document.getElementById('swapBtn');
const tradeStatus = document.getElementById('tradeStatus');

let walletPublicKey = null;
let activeField = null; // "sol" 或 "nova"

// 當 SOL 輸入時更新 NOVA 預估值
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
  // NOVA = SOL * (SOL_USD_PRICE / CURRENT_NOVA_PRICE_USD)
  const novaVal = solValue * (SOL_USD_PRICE / window.CURRENT_NOVA_PRICE_USD);
  novaInput.value = novaVal.toFixed(0);
  activeField = "sol";
}

// 當 NOVA 輸入時更新 SOL 預估值
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
  // SOL = NOVA * (CURRENT_NOVA_PRICE_USD / SOL_USD_PRICE)
  const solVal = novaValue * (window.CURRENT_NOVA_PRICE_USD / SOL_USD_PRICE);
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
// 依據 activeField 判斷，執行買入或賣出模擬交易
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
      transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey,
          toPubkey: fromPubkey,
          lamports: lamports,
        })
      );
      tradeStatus.innerText = `Executing Buy: ${solValue} SOL will convert to ${(solValue * (SOL_USD_PRICE / window.CURRENT_NOVA_PRICE_USD)).toFixed(0)} NOVA (simulated)...\n`;
    } else if (activeField === "nova") {
      const novaValue = parseFloat(novaInput.value);
      if (isNaN(novaValue) || novaValue <= 0) {
        tradeStatus.innerText = "Please enter a valid NOVA amount.";
        return;
      }
      const solEquivalent = novaValue * (window.CURRENT_NOVA_PRICE_USD / SOL_USD_PRICE);
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
