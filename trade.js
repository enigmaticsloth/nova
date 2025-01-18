// trade.js

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction
} from '@solana/web3.js';

import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';

// DOM Elements
const connectWalletBtn = document.getElementById("connectWalletBtn");
const walletStatus = document.getElementById("walletStatus");
const solInput = document.getElementById("solInput");
const novaInput = document.getElementById("novaInput");
const swapBtn = document.getElementById("swapBtn");
const tradeStatus = document.getElementById("tradeStatus");

// Global Variables
let walletPublicKey = null;

// Constants
const programId = new PublicKey("HEAz4vAABHTYdY23JuYD3VTHKSBRXSdyt7Dq8YVGDUWm");
const globalStatePubkey = new PublicKey("HLSLMK51mUc375t69T93quNqpLqLdySZKvodjyeuNdp");
const mintPubkey = new PublicKey("5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX");
const mintAuthorityPubkey = new PublicKey("AfqG9eh244LzXTEBo4UDepa2pKKTopvZHWmX4sFadch7");
const novaTreasuryPubkey = new PublicKey("4fuD8ELTbhRBcnG61WnSVe9TCdkVAhJLKteYz51yMnKH");
const liquidityPoolPdaPubkey = new PublicKey("C7sSvpgZvRPVqLqfLSeDb3ErHWhMQYM3fvbRgSWBwVkF");
const developerRewardPoolPubkey = new PublicKey("9WHRVWCiWeCC8Lhb4ohk3e2wdoZpALh6xNcnteP6E75o");
const feeRecipientPubkey = new PublicKey("7MaisRjGojZVb9gS6B1UZqBtFqajAArTkwnXhp3Syubk");
const BUY_METHOD_NAME = "buy";
const PROGRAM_NAME = "nova";

// Initialize Discriminator
let BUY_METHOD_DISCM;

// Compute Discriminator on Initialization
async function initializeDiscriminator() {
  BUY_METHOD_DISCM = await getDiscriminator(PROGRAM_NAME, BUY_METHOD_NAME);
  console.log('Buy Instruction Discriminator:', BUY_METHOD_DISCM);
}

// Helper Function to Compute Discriminator
async function getDiscriminator(programName, instructionName) {
  const message = `${programName}:${instructionName}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const discriminator = hashArray.slice(0, 8);
  return new Uint8Array(discriminator);
}

// Encode Buy Instruction Data
function encodeBuyData(solAmountU64, currentNovaPriceU64) {
  const buffer = new Uint8Array(16); // 2 * 8 bytes for u64
  const dv = new DataView(buffer.buffer);
  dv.setBigUint64(0, BigInt(solAmountU64), true); // sol_amount
  dv.setBigUint64(8, BigInt(currentNovaPriceU64), true); // current_nova_price

  const finalData = new Uint8Array(8 + 16); // 8 bytes for discriminator + 16 bytes for data
  finalData.set(BUY_METHOD_DISCM, 0);
  finalData.set(buffer, 8);
  return finalData;
}

// Connect Wallet Function
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
    walletStatus.innerText = "Phantom wallet not found. Please install Phantom extension.";
  }
}

// Prepare Associated Token Account (ATA) if Needed
async function prepareBuyerAtaIfNeeded(connection, userPubkey, mintPk, transaction) {
  try {
    const ataPubkey = await getAssociatedTokenAddress(mintPk, userPubkey, false, TOKEN_PROGRAM_ID);
    console.log(">>> Derived ATA pubkey:", ataPubkey.toBase58());

    const ataInfo = await connection.getAccountInfo(ataPubkey);
    if (!ataInfo) {
      console.log("User ATA does not exist. Creating ATA...");
      const createIx = createAssociatedTokenAccountInstruction(
        userPubkey,
        ataPubkey,
        userPubkey,
        mintPk
      );
      transaction.add(createIx);
      console.log("Added ATA creation instruction.");
    } else {
      console.log("User ATA exists.");
    }
    return ataPubkey;
  } catch (error) {
    console.error("Error in prepareBuyerAtaIfNeeded:", error);
    throw error;
  }
}

// Get Recent Blockhash with Retry
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

// SwapNOVA Function
async function swapNOVA() {
  console.log("swapNOVA function triggered!");
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }

  try {
    const connection = new Connection("https://nova-enigmaticsloths-projects.vercel.app/api/rpc-proxy", "confirmed");
    const fromPubkey = new PublicKey(walletPublicKey);
    console.log("Connected to Solana via proxy.");

    const solValue = parseFloat(solInput.value);
    if (isNaN(solValue) || solValue <= 0) {
      tradeStatus.innerText = "Please enter a valid SOL amount.";
      return;
    }
    const lamports = Math.round(solValue * 1e9);
    const approximateNovaPrice = 1_000_000;

    let transaction = new Transaction();

    console.log("Preparing ATA if needed...");
    const buyerAta = await prepareBuyerAtaIfNeeded(connection, fromPubkey, mintPubkey, transaction);
    console.log("Buyer ATA:", buyerAta.toBase58());

    const data = encodeBuyData(lamports, approximateNovaPrice);
    console.log("Encoded buy data:", data);

    const buyAccounts = [
      { pubkey: fromPubkey, isSigner: true, isWritable: true },
      { pubkey: globalStatePubkey, isSigner: false, isWritable: true },
      { pubkey: buyerAta, isSigner: false, isWritable: true },
      { pubkey: novaTreasuryPubkey, isSigner: false, isWritable: true },
      { pubkey: mintAuthorityPubkey, isSigner: false, isWritable: false },
      { pubkey: mintPubkey, isSigner: false, isWritable: true },
      { pubkey: liquidityPoolPdaPubkey, isSigner: false, isWritable: true },
      { pubkey: feeRecipientPubkey, isSigner: false, isWritable: true },
      { pubkey: developerRewardPoolPubkey, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const buyIx = new TransactionInstruction({
      programId,
      keys: buyAccounts,
      data,
    });
    transaction.add(buyIx);
    console.log("Added buy instruction to transaction.");

    transaction.feePayer = fromPubkey;
    console.log("Setting fee payer:", fromPubkey.toBase58());

    transaction.recentBlockhash = await getRecentBlockhashWithRetry(connection);
    console.log("Obtained recent blockhash:", transaction.recentBlockhash);

    // Sign the transaction
    console.log("Signing transaction...");
    const signedTx = await window.solana.signTransaction(transaction);
    const rawTx = signedTx.serialize();
    console.log("Signed transaction.");

    // Send the transaction
    console.log("Sending raw transaction...");
    const signature = await connection.sendRawTransaction(rawTx);
    tradeStatus.innerText = `Transaction sent! Signature: ${signature}\n`;
    console.log("Transaction sent! Signature:", signature);

    // Confirm the transaction
    await connection.confirmTransaction(signature, "confirmed");
    tradeStatus.innerText += "Transaction confirmed!";
    console.log("Transaction confirmed!");
  } catch (err) {
    console.error("Swap transaction error:", err);
    if (err.logs) {
      console.error("Transaction logs:", err.logs);
      tradeStatus.innerText = `Swap transaction error: ${err.message}\nLogs: ${err.logs.join('\n')}`;
    } else {
      tradeStatus.innerText = `Swap transaction error: ${err.message}`;
    }
  }
}

// Bind Buttons
connectWalletBtn.addEventListener("click", async () => {
  console.log("Connect Wallet button clicked!");
  await initializeDiscriminator(); // Ensure discriminator is initialized
  connectWallet();
});

swapBtn.addEventListener("click", () => {
  console.log("Swap button clicked!");
  swapNOVA();
});

// Swap Inputs Button
const swapInputsBtn = document.getElementById("swapInputsBtn");
swapInputsBtn.addEventListener('click', () => {
  const tmp = solInput.value;
  solInput.value = novaInput.value;
  novaInput.value = tmp;
  console.log("Swapped input values (SOL<->NOVA)");
});

// Auto Update NOVA
function updateNovaFromSOL() {
  const solVal = parseFloat(solInput.value);
  console.log("updateNovaFromSOL() triggered. solVal=", solVal,
    "SOL_USD_PRICE=", window.SOL_USD_PRICE,
    "CURRENT_NOVA_PRICE_USD=", window.CURRENT_NOVA_PRICE_USD);

  if (!solInput.value || isNaN(solVal) || solVal <= 0) {
    novaInput.value = "";
    return;
  }
  const novaVal = solVal * (window.SOL_USD_PRICE / window.CURRENT_NOVA_PRICE_USD);
  novaInput.value = novaVal.toFixed(5);
}

// Auto Update SOL
function updateSolFromNova() {
  const novaVal = parseFloat(novaInput.value);
  console.log("updateSolFromNova() triggered. novaVal=", novaVal,
    "SOL_USD_PRICE=", window.SOL_USD_PRICE,
    "CURRENT_NOVA_PRICE_USD=", window.CURRENT_NOVA_PRICE_USD);

  if (!novaInput.value || isNaN(novaVal) || novaVal <= 0) {
    solInput.value = "";
    return;
  }
  const solVal = novaVal * (window.CURRENT_NOVA_PRICE_USD / window.SOL_USD_PRICE);
  solInput.value = solVal.toFixed(5);
}

solInput.addEventListener('input', updateNovaFromSOL);
novaInput.addEventListener('input', updateSolFromNova);
