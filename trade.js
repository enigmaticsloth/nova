// trade.js

// Import necessary libraries
// Ensure you include the SPL Token library in your HTML file
// Example:
// <script src="https://unpkg.com/@solana/spl-token@0.2.0/dist/spl-token.min.js"></script>

// Get DOM elements
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatus = document.getElementById('walletStatus');
const solInput = document.getElementById('solInput');
const novaInput = document.getElementById('novaInput');
const swapBtn = document.getElementById('swapBtn');
const tradeStatus = document.getElementById('tradeStatus');

// Global variables
let walletPublicKey = null;
let activeField = null;  // "sol" or "nova"

// Exchange contract address
const exchangeContractAddress = "HEAz4vAABHTYdY23JuYD3VTHKSBRXSdyt7Dq8YVGDUWm"; // 確保這是正確的地址

// Debounce function to limit the rate of function calls
function debounce(func, delay) {
  let debounceTimer;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(context, args), delay);
  };
}

// Function to update NOVA estimate based on SOL input
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

// Function to update SOL estimate based on NOVA input
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

// Debounced versions of the update functions
const debouncedUpdateNovaFromSOL = debounce(updateNovaFromSOL, 300); // 300ms delay
const debouncedUpdateSOLFromNOVA = debounce(updateSOLFromNOVA, 300); // 300ms delay

solInput.addEventListener('input', debouncedUpdateNovaFromSOL);
novaInput.addEventListener('input', debouncedUpdateSOLFromNOVA);

// Function to connect Phantom wallet
async function connectWallet() {
  if (window.solana && window.solana.isPhantom) {
    try {
      const resp = await window.solana.connect();
      walletPublicKey = resp.publicKey.toString();
      walletStatus.innerText = Wallet Connected: ${walletPublicKey};
      console.log("Wallet connected:", walletPublicKey);
    } catch (err) {
      walletStatus.innerText = Connection Failed: ${err.message};
      console.error("Connection failed:", err);
    }
  } else {
    walletStatus.innerText = "Phantom wallet not found. Please install the Phantom extension.";
  }
}

// Function to retry fetching the recent blockhash
async function getRecentBlockhashWithRetry(connection, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(Fetching blockhash, attempt ${i + 1});
      const { blockhash } = await connection.getLatestBlockhash();
      console.log(Fetched blockhash: ${blockhash});
      return blockhash;
    } catch (error) {
      console.warn(Attempt ${i + 1} failed: ${error.message});
      if (i === retries - 1) {
        console.error("All attempts to fetch blockhash failed:", error);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Throttle function to limit the rate of function calls
function throttle(func, limit) {
  let lastFunc;
  let lastRan;
  return function() {
    const context = this;
    const args = arguments;
    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(function() {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

// Swap function
async function swapNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }

  try {
    console.log("Starting swap transaction...");
    const connection = new solanaWeb3.Connection(
      "https://nova-enigmaticsloths-projects.vercel.app/api/rpc-proxy",
      "confirmed"
    );
    const fromPubkey = new solanaWeb3.PublicKey(walletPublicKey);
    let transaction;

    if (activeField === "sol") {
      const solValue = parseFloat(solInput.value);
      if (isNaN(solValue) || solValue <= 0) {
        tradeStatus.innerText = "Please enter a valid SOL amount.";
        return;
      }
      const lamports = Math.round(solValue * 1e9);
      
      // 替換為您的實際 Program ID
      const programId = new solanaWeb3.PublicKey("HEAz4vAABHTYdY23JuYD3VTHKSBRXSdyt7Dq8YVGDUWm"); // <--- 替換此處

      // 指令數據，根據您的智能合約需求調整
      const instruction = new solanaWeb3.TransactionInstruction({
        keys: [
          { pubkey: fromPubkey, isSigner: true, isWritable: true },
          { pubkey: new solanaWeb3.PublicKey(exchangeContractAddress), isSigner: false, isWritable: true },
          // 添加更多需要的帳戶
        ],
        programId: programId, // 使用正確的 Program ID
        data: Buffer.from([0x01]), // 0x01 代表 "swap SOL to NOVA" 指令
      });

      transaction = new solanaWeb3.Transaction().add(instruction);
      tradeStatus.innerText = Executing Buy: ${solValue} SOL → Estimated NOVA...\n;
      console.log("Transaction Instructions:", transaction.instructions);
    }

    // 設置 fee payer
    transaction.feePayer = fromPubkey;
    console.log("Fetching latest blockhash...");
    const blockhash = await getRecentBlockhashWithRetry(connection);
    console.log("Latest blockhash:", blockhash);
    transaction.recentBlockhash = blockhash;

    // 簽名交易
    console.log("Signing transaction...");
    const signedTransaction = await window.solana.signTransaction(transaction);
    const rawTransaction = signedTransaction.serialize();
    console.log("Raw transaction:", rawTransaction);

    // 發送交易
    console.log("Sending transaction...");
    const signature = await connection.sendRawTransaction(rawTransaction);
    tradeStatus.innerText += Transaction sent! Signature: ${signature};
    console.log("Transaction sent! Signature:", signature);

    // 確認交易
    console.log("Confirming transaction...");
    await connection.confirmTransaction(signature, 'confirmed');
    tradeStatus.innerText += "\nTransaction confirmed!";
    console.log("Transaction confirmed!");

  } catch (err) {
    console.error("Swap transaction error:", err);
    tradeStatus.innerText = Swap transaction error: ${err.message};
  }
}

// Throttled version of the swap function to prevent excessive calls
const throttledSwapNOVA = throttle(swapNOVA, 2000); // 2 seconds throttle

// Event listeners
connectWalletBtn.addEventListener('click', connectWallet);
swapBtn.addEventListener('click', throttledSwapNOVA);