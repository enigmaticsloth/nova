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

// 重試獲取 Blockhash
async function getRecentBlockhashWithRetry(connection, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const { blockhash } = await connection.getLatestBlockhash();
      return blockhash;
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed: ${error.message}`);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
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
    const connection = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com", "confirmed");
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
          toPubkey: fromPubkey,
          lamports: lamports,
        })
      );
      tradeStatus.innerText = `Executing Sell: ${novaValue} NOVA → Estimated SOL...\n`;
    }

    transaction.feePayer = fromPubkey;
    const blockhash = await getRecentBlockhashWithRetry(connection);
    transaction.recentBlockhash = blockhash;

    await window.solana.signTransaction(transaction);
    const rawTransaction = transaction.serialize();

    const signature = await connection.sendRawTransaction(rawTransaction);
    tradeStatus.innerText += `Transaction sent! Signature: ${signature}`;
    console.log("Transaction sent! Signature:", signature);
    await connection.confirmTransaction(signature, 'confirmed');
    tradeStatus.innerText += "\nTransaction confirmed!";

  } catch (err) {
    console.error("Swap transaction error:", err);
    tradeStatus.innerText = `Swap transaction error: ${err.message}`;
  }
}

connectWalletBtn.addEventListener('click', connectWallet);
swapBtn.addEventListener('click', swapNOVA);
