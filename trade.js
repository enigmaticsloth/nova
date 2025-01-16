// trade.js

const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatus = document.getElementById('walletStatus');
const solInput = document.getElementById('solInput');
const novaInput = document.getElementById('novaInput');
const swapBtn = document.getElementById('swapBtn');
const tradeStatus = document.getElementById('tradeStatus');

let walletPublicKey = null;
let activeField = null;  // "sol" 或 "nova"

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
  const novaVal = solValue * (window.SOL_USD_PRICE / window.CURRENT_NOVA_PRICE_USD);
  novaInput.value = novaVal.toFixed(5);
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

// Swap 函式
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

      const lamports = Math.round(solValue * 1e9);
      transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey,
          toPubkey: fromPubkey,  // 模擬交易
          lamports: lamports,
        })
      );

      tradeStatus.innerText = `Executing Buy: ${solValue} SOL → Estimated NOVA...\n`;
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
          toPubkey: fromPubkey,  // 模擬交易
          lamports: lamports,
        })
      );

      tradeStatus.innerText = `Executing Sell: ${novaValue} NOVA → Estimated SOL...\n`;
    } else {
      tradeStatus.innerText = "Please enter a value in either SOL or NOVA input.";
      return;
    }

    // 設定 feePayer 和 blockhash
    transaction.feePayer = fromPubkey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // Phantom 錢包簽署交易
    await window.solana.signTransaction(transaction);

    // **修正重點：直接使用 transaction 物件的 serialize()**
    if (typeof transaction.serialize !== "function") {
      throw new Error("Transaction object is invalid. Cannot serialize.");
    }

    const rawTransaction = transaction.serialize();

    // 傳送交易
    const signature = await connection.sendRawTransaction(rawTransaction);
    tradeStatus.innerText += `Transaction sent! Signature: ${signature}`;
    console.log("Transaction sent! Signature:", signature);

    // 確認交易
    await connection.confirmTransaction(signature, 'confirmed');
    tradeStatus.innerText += "\nTransaction confirmed!";

  } catch (err) {
    console.error("Swap transaction error:", err);
    tradeStatus.innerText = `Swap transaction error: ${err.message}`;
  }
}

// 綁定按鈕
connectWalletBtn.addEventListener('click', connectWallet);
swapBtn.addEventListener('click', swapNOVA);
