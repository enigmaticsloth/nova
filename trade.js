// trade.js

// 設定換算參數
const CURRENT_NOVA_PRICE = 1000000;  
// 換算公式：
// BUY: NOVA = SOL * (1e9 / CURRENT_NOVA_PRICE) = SOL * (1e9 / 1e6) = SOL * 1000
// SELL: SOL = NOVA * (CURRENT_NOVA_PRICE / 1e9) = NOVA * (1e6 / 1e9) = NOVA * 0.001

// 取得 DOM 元素
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatus = document.getElementById('walletStatus');
const solInput = document.getElementById('solInput');
const novaInput = document.getElementById('novaInput');
const swapBtn = document.getElementById('swapBtn');
const tradeStatus = document.getElementById('tradeStatus');

let walletPublicKey = null;
let activeField = null; // "sol" 或 "nova"

// 連接 Phantom 錢包（必須使用 HTTP/HTTPS 執行）
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
  // 計算 NOVA = SOL * 1000
  const novaVal = solValue * 1000;
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
  // 計算 SOL = NOVA * 0.001
  const solVal = novaValue * 0.001;
  solInput.value = solVal.toFixed(4);
  activeField = "nova";
}

// 控制即時更新防止循環觸發的 flag
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

// Swap 函式：依據 activeField 判斷是買入還是賣出
// 這裡以模擬交易示範，實際上你應呼叫你的合約交易
async function swapNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }
  try {
    const connection = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com", "processed");
    const fromPubkey = new solanaWeb3.PublicKey(walletPublicKey);
    let transaction;
    if (activeField === "sol") { // 使用 SOL 輸入作為買入交易
      const solValue = parseFloat(solInput.value);
      if (isNaN(solValue) || solValue <= 0) {
        tradeStatus.innerText = "Please enter a valid SOL amount.";
        return;
      }
      const lamports = Math.round(solValue * 1e9);
      // 模擬一筆買入交易 (這裡僅示範轉帳給自己)
      transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey,
          toPubkey: fromPubkey,
          lamports: lamports
        })
      );
      tradeStatus.innerText = `Executing Buy: ${solValue} SOL will convert to ${solValue*1000} NOVA (simulated)...`;
    } else if (activeField === "nova") { // 使用 NOVA 輸入作為賣出交易
      const novaValue = parseFloat(novaInput.value);
      if (isNaN(novaValue) || novaValue <= 0) {
        tradeStatus.innerText = "Please enter a valid NOVA amount.";
        return;
      }
      // 將 NOVA 換算成 SOL：SOL = NOVA * 0.001
      const solEquivalent = novaValue * 0.001;
      const lamports = Math.round(solEquivalent * 1e9);
      // 模擬一筆賣出交易 (同樣僅示範轉帳給自己)
      transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey,
          toPubkey: fromPubkey,
          lamports: lamports
        })
      );
      tradeStatus.innerText = `Executing Sell: ${novaValue} NOVA (≈${solEquivalent} SOL) (simulated)...`;
    } else {
      tradeStatus.innerText = "Please enter a value in either SOL or NOVA input.";
      return;
    }
    // 進行簽名與發送交易
    const { signature } = await window.solana.signAndSendTransaction({ transaction, connection });
    tradeStatus.innerText += `\nTransaction sent! Signature: ${signature}`;
  } catch (err) {
    tradeStatus.innerText = `Swap transaction error: ${err.message}`;
  }
}

// 綁定按鈕事件
connectWalletBtn.addEventListener('click', connectWallet);
swapBtn.addEventListener('click', swapNOVA);
