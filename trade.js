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
const exchangeContractAddress = "HEAz4vAABHTYdY23JuYD3VTHKSBRXSdyt7Dq8YVGDUWm"; // Replace with your exchange contract address

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
      walletStatus.innerText = `Wallet Connected: ${walletPublicKey}`;
      console.log("Wallet connected:", walletPublicKey);
    } catch (err) {
      walletStatus.innerText = `Connection Failed: ${err.message}`;
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
      const { blockhash } = await connection.getLatestBlockhash();
      return blockhash;
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed: ${error.message}`);
      if (i === retries - 1) throw error;
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
    // Use vercel
    const connection = new solanaWeb3.Connection(
      "https://nova-enigmaticsloths-projects.vercel.app/api/rpc-proxyy",
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
      transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey,
          toPubkey: new solanaWeb3.PublicKey(exchangeContractAddress),  // Exchange contract address
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

      // Assuming NOVA is an SPL Token, use @solana/spl-token to transfer NOVA
      // Ensure you have included the SPL Token library in your HTML
      const { Token, TOKEN_PROGRAM_ID } = splToken; // Assuming @solana/spl-token is loaded as splToken
      const novaMintAddress = "5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX"; // Replace with your NOVA Token Mint Address

      // Create Token instance
      const novaToken = new Token(
        connection,
        new solanaWeb3.PublicKey(novaMintAddress),
        TOKEN_PROGRAM_ID,
        fromPubkey
      );

      // Get user's NOVA Token Account
      const userTokenAccount = await novaToken.getOrCreateAssociatedAccountInfo(fromPubkey);

      // Transfer NOVA to exchange contract address
      transaction = new solanaWeb3.Transaction().add(
        Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          userTokenAccount.address,
          new solanaWeb3.PublicKey(exchangeContractAddress),  // Exchange contract address
          fromPubkey,
          [],
          novaValue * 1e9 // Assuming NOVA has 9 decimal places
        )
      );
      tradeStatus.innerText = `Executing Sell: ${novaValue} NOVA → Estimated SOL...\n`;
    }

    // Set fee payer
    transaction.feePayer = fromPubkey;
    // Get the latest blockhash
    const blockhash = await getRecentBlockhashWithRetry(connection);
    transaction.recentBlockhash = blockhash;

    // Sign the transaction
    const signedTransaction = await window.solana.signTransaction(transaction);
    // Serialize the transaction
    const rawTransaction = signedTransaction.serialize();

    // Send the transaction
    const signature = await connection.sendRawTransaction(rawTransaction);
    tradeStatus.innerText += `Transaction sent! Signature: ${signature}`;
    console.log("Transaction sent! Signature:", signature);
    // Confirm the transaction
    await connection.confirmTransaction(signature, 'confirmed');
    tradeStatus.innerText += "\nTransaction confirmed!";

  } catch (err) {
    console.error("Swap transaction error:", err);
    tradeStatus.innerText = `Swap transaction error: ${err.message}`;
  }
}

// Throttled version of the swap function to prevent excessive calls
const throttledSwapNOVA = throttle(swapNOVA, 2000); // 2 seconds throttle

// Event listeners
connectWalletBtn.addEventListener('click', connectWallet);
swapBtn.addEventListener('click', throttledSwapNOVA);
