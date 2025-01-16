// trade.js

const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatus = document.getElementById('walletStatus');
const solInput = document.getElementById('solInput');
const novaInput = document.getElementById('novaInput');
const swapBtn = document.getElementById('swapBtn');
const tradeStatus = document.getElementById('tradeStatus');

let walletPublicKey = null;
let activeField = null; // "sol" 或 "nova"

// 當 SOL 輸入時更新 NOVA 預估值
// 公式：NOVA = SOL * (SOL_USD_PRICE / CURRENT_NOVA_PRICE_USD)
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
  const novaVal = solValue * (window.SOL_USD_PRICE / window.CURRENT_NOVA_PRICE_USD);
  novaInput.value = novaVal.toFixed(5);
  activeField = "sol";
}

// 當 NOVA 輸入時更新 SOL 預估值
// 公式：SOL = NOVA * (CURRENT_NOVA_PRICE_USD / SOL_USD_PRICE)
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
  const solVal = novaValue * (window.CURRENT_NOVA_PRICE_USD / window.SOL_USD_PRICE);
  solInput.value = solVal.toFixed(5);
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

// 連接 Phantom 錢包
async function connectWallet() {
  if (window.solana && window.solana.isPhantom) {
    try {
      const resp = await window.solana.connect();
      walletPublicKey = resp.publicKey.toString();
      walletStatus.innerText = `Wallet connected: ${walletPublicKey}`;
      console.log("Wallet connected:", walletPublicKey);
    } catch (err) {
      walletStatus.innerText = `Connect failed: ${err.message}`;
      console.error("Connect failed:", err);
    }
  } else {
    walletStatus.innerText = "Phantom wallet not found. Please install the Phantom extension.";
  }
}

// 模擬獎勵計算
// 假設獎勵百分比為 5%（僅示範用途）
function calculateReward(baseNova) {
  const rewardPercent = 0.05;
  return baseNova * rewardPercent;
}

// Swap 函式：根據 activeField 判斷執行買入或賣出
async function swapNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }
  try {
    console.log("Starting swap transaction...");
    const connection = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com", "processed");
    const fromPubkey = new solanaWeb3.PublicKey(walletPublicKey);
    let transaction;
    if (activeField === "sol") {
      const solValue = parseFloat(solInput.value);
      if (isNaN(solValue) || solValue <= 0) {
        tradeStatus.innerText = "Please enter a valid SOL amount.";
        return;
      }
      // 根據公式計算買入的 NOVA 預估量
      const baseNova = solValue * (window.SOL_USD_PRICE / window.CURRENT_NOVA_PRICE_USD);
      const rewardNova = calculateReward(baseNova);
      const totalNova = baseNova + rewardNova;
      const lamports = Math.round(solValue * 1e9);
      transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey,
          toPubkey: fromPubkey, // 模擬交易：資金轉回自己
          lamports: lamports,
        })
      );
      tradeStatus.innerText = `Executing Buy: ${solValue} SOL → ${baseNova.toFixed(5)} NOVA (base) + ${rewardNova.toFixed(5)} NOVA (reward) = ${totalNova.toFixed(5)} NOVA (simulated)...\n`;
      console.log("Buy: SOL", solValue, "-> Base NOVA:", baseNova, "Reward:", rewardNova, "Total NOVA:", totalNova);
    } else if (activeField === "nova") {
      const novaValue = parseFloat(novaInput.value);
      if (isNaN(novaValue) || novaValue <= 0) {
        tradeStatus.innerText = "Please enter a valid NOVA amount.";
        return;
      }
      const solEquivalent = novaValue * (window.CURRENT_NOVA_PRICE_USD / window.SOL_USD_PRICE);
      const lamports = Math.round(solEquivalent * 1e9);
      transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey,
          toPubkey: fromPubkey,
          lamports: lamports,
        })
      );
      tradeStatus.innerText = `Executing Sell: ${novaValue} NOVA (≈${solEquivalent.toFixed(5)} SOL) (simulated)...\n`;
      console.log("Sell: NOVA", novaValue, "-> SOL equivalent:", solEquivalent);
    } else {
      tradeStatus.innerText = "Please enter a value in either SOL or NOVA input.";
      return;
    }
    
    // 設定必要的欄位
    transaction.feePayer = fromPubkey;
    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    
    // 使用 Phantom 錢包簽署交易（先簽署，再序列化後傳送）
    const signed = await window.solana.signTransaction(transaction);
    // ----- 這裡做檢查：如果 signed 物件沒有 serialize 方法，就直接把它當成 Uint8Array 使用
    let rawTransaction;
    if (typeof signed.serialize === "function") {
      rawTransaction = signed.serialize();
    } else if (signed instanceof Uint8Array) {
      rawTransaction = signed;
    } else {
      throw new Error("Signed transaction is not in expected format.");
    }
    
    const signature = await connection.sendRawTransaction(rawTransaction);
    
    tradeStatus.innerText += `\nTransaction sent! Signature: ${signature}`;
    console.log("Transaction sent! Signature:", signature);
  } catch (err) {
    console.error("Swap transaction error:", err);
    tradeStatus.innerText = `Swap transaction error: ${err.message}`;
  }
}

connectWalletBtn.addEventListener('click', connectWallet);
swapBtn.addEventListener('click', swapNOVA);
