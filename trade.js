// trade.js

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import * as borsh from 'borsh';

// =====================
// DOM 元素取得
// =====================
const connectWalletBtn = document.getElementById("connectWalletBtn");
const walletStatus = document.getElementById("walletStatus");
const solInput = document.getElementById("solInput");
const novaInput = document.getElementById("novaInput");
const swapBtn = document.getElementById("swapBtn");
const tradeStatus = document.getElementById("tradeStatus");
const swapInputsBtn = document.getElementById("swapInputsBtn");

// =====================
// 全域變數與常數設定
// =====================
let walletPublicKey = null;

// 以下地址與帳戶順序需與智能合約端 Buy 指令的 #[derive(Accounts)] 定義一致，請根據您的實際部署調整
const programId = new PublicKey("HEAz4vAABHTYdY23JuYD3VTHKSBRXSdyt7Dq8YVGDUWm");
const globalStatePubkey = new PublicKey("HLSLMK51mUc375t69T93quNqpLqLdySZKvodjyeuNdp");
const mintPubkey = new PublicKey("5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX");
const mintAuthorityPubkey = new PublicKey("AfqG9eh244LzXTEBo4UDepa2pKKTopvZHWmX4sFadch7");
const novaTreasuryPubkey = new PublicKey("4fuD8ELTbhRBcnG61WnSVe9TCdkVAhJLKteYz51yMnKH");
const liquidityPoolPdaPubkey = new PublicKey("C7sSvpgZvRPVqLqfLSeDb3ErHWhMQYM3fvbRgSWBwVkF");
const developerRewardPoolPubkey = new PublicKey("9WHRVWCiWeCC8Lhb4ohk3e2wdoZpALh6xNcnteP6E75o");
const feeRecipientPubkey = new PublicKey("7MaisRjGojZVb9gS6B1UZqBtFqajAArTkwnXhp3Syubk");

// 指令名稱與 program 名稱（必須與合約端定義完全一致）
const PROGRAM_NAME = "nova";
const BUY_METHOD_NAME = "buy";

// 全域變數儲存 discriminator，注意不要使用硬編碼
let BUY_METHOD_DISCM;

// =====================
// 定義 Borsh 序列化所需的結構與 schema
// =====================
class BuyInstruction {
  constructor(fields) {
    this.solAmount = fields.solAmount;
    this.currentNovaPrice = fields.currentNovaPrice;
  }
}

const BuyInstructionSchema = new Map([
  [BuyInstruction, {
    kind: 'struct',
    fields: [
      ['solAmount', 'u64'],
      ['currentNovaPrice', 'u64']
    ]
  }]
]);

// 利用 Borsh 序列化 BuyInstruction 參數
function serializeBuyData(solAmount, currentNovaPrice) {
  const instructionData = new BuyInstruction({ solAmount, currentNovaPrice });
  return borsh.serialize(BuyInstructionSchema, instructionData);
}

// =====================
// 動態計算 Discriminator：使用 SHA-256 並取前 8 個 byte
// =====================
async function getDiscriminator(programName, instructionName) {
  const message = `${programName}:${instructionName}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  // 使用瀏覽器內建 SubtleCrypto API 計算 SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const discriminator = hashArray.slice(0, 8);
  return new Uint8Array(discriminator);
}

// 初始化時計算 buy 指令的 discriminator
async function initializeDiscriminator() {
  BUY_METHOD_DISCM = await getDiscriminator(PROGRAM_NAME, BUY_METHOD_NAME);
  console.log("Buy Instruction Discriminator:", BUY_METHOD_DISCM);
  // 期望結果：Uint8Array(8) [28, 43, 80, 163, 53, 73, 88, 8]
}

// =====================
// 封裝編碼函式：組合 discriminator 與 Borsh 序列化後的資料
// =====================
function encodeBuyDataWithBorsh(solAmount, currentNovaPrice) {
  if (!BUY_METHOD_DISCM) {
    throw new Error("BUY_METHOD_DISCM is not initialized.");
  }
  console.log("Using BUY_METHOD_DISCM:", BUY_METHOD_DISCM);
  const serializedData = serializeBuyData(solAmount, currentNovaPrice);
  console.log("Serialized buy data (length =", serializedData.length, "):", serializedData);
  const data = new Uint8Array(BUY_METHOD_DISCM.length + serializedData.length);
  data.set(BUY_METHOD_DISCM, 0);
  data.set(serializedData, BUY_METHOD_DISCM.length);
  console.log("Final encoded data (first 8 bytes):", data.slice(0, 8));
  return data;
}

// =====================
// 連接錢包函式
// =====================
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

// =====================
// 檢查或建立使用者的 Associated Token Account (ATA)
// =====================
async function prepareBuyerAtaIfNeeded(connection, userPubkey, mintPk, transaction) {
  try {
    const ataPubkey = await getAssociatedTokenAddress(mintPk, userPubkey, false, TOKEN_PROGRAM_ID);
    console.log("Derived ATA pubkey:", ataPubkey.toBase58());
    const ataInfo = await connection.getAccountInfo(ataPubkey);
    if (!ataInfo) {
      console.log("ATA not found. Creating ATA...");
      const createIx = createAssociatedTokenAccountInstruction(
        userPubkey,
        ataPubkey,
        userPubkey,
        mintPk
      );
      transaction.add(createIx);
      console.log("Added ATA creation instruction.");
    } else {
      console.log("ATA exists.");
    }
    return ataPubkey;
  } catch (error) {
    console.error("Error preparing ATA:", error);
    throw error;
  }
}

// =====================
// 取得最新 blockhash (重試機制)
// =====================
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

// =====================
// SwapNOVA 函式：組裝交易、編碼指令資料並發送
// =====================
async function swapNOVA() {
  console.log("swapNOVA function triggered!");
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }

  try {
    // 使用自訂的 RPC Proxy URL（請依實際環境修改）
    const connection = new Connection("https://nova-enigmaticsloths-projects.vercel.app/api/rpc-proxy", "confirmed");
    const fromPubkey = new PublicKey(walletPublicKey);
    console.log("Connected to Solana via proxy.");

    const solValue = parseFloat(solInput.value);
    if (isNaN(solValue) || solValue <= 0) {
      tradeStatus.innerText = "Please enter a valid SOL amount.";
      return;
    }
    const lamports = Math.round(solValue * 1e9);
    const approximateNovaPrice = 1_000_000; // 這裡請根據實際情況調整 NOVA 價格

    let transaction = new Transaction();

    console.log("Preparing ATA if needed...");
    const buyerAta = await prepareBuyerAtaIfNeeded(connection, fromPubkey, mintPubkey, transaction);
    console.log("Buyer ATA:", buyerAta.toBase58());

    // 編碼買入指令資料：利用動態計算的 discriminator 與 Borsh 序列化參數
    const data = encodeBuyDataWithBorsh(lamports, approximateNovaPrice);
    console.log("Encoded buy data:", data);
    // 注意：前 8 byte 應該正確為 [28, 43, 80, 163, 53, 73, 88, 8]

    // 組裝帳戶列表，順序必須與合約端的 #[derive(Accounts)] 定義一致
    const buyAccounts = [
      { pubkey: fromPubkey, isSigner: true, isWritable: true },             // buyer
      { pubkey: globalStatePubkey, isSigner: false, isWritable: true },         // global_state
      { pubkey: buyerAta, isSigner: false, isWritable: true },                  // buyer_nova_account
      { pubkey: novaTreasuryPubkey, isSigner: false, isWritable: true },          // nova_treasury
      { pubkey: mintAuthorityPubkey, isSigner: false, isWritable: false },        // mint_authority
      { pubkey: mintPubkey, isSigner: false, isWritable: true },                  // mint
      { pubkey: liquidityPoolPdaPubkey, isSigner: false, isWritable: true },      // liquidity_pool_pda
      { pubkey: feeRecipientPubkey, isSigner: false, isWritable: true },          // fee_recipient
      { pubkey: developerRewardPoolPubkey, isSigner: false, isWritable: true },   // developer_reward_pool
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },           // token_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }     // system_program
    ];

    const buyIx = new TransactionInstruction({
      programId,
      keys: buyAccounts,
      data: data,
    });
    transaction.add(buyIx);
    console.log("Added buy instruction to transaction.");

    transaction.feePayer = fromPubkey;
    console.log("Setting fee payer:", fromPubkey.toBase58());

    transaction.recentBlockhash = await getRecentBlockhashWithRetry(connection);
    console.log("Obtained recent blockhash:", transaction.recentBlockhash);

    console.log("Signing transaction...");
    const signedTx = await window.solana.signTransaction(transaction);
    const rawTx = signedTx.serialize();
    console.log("Signed transaction.");

    console.log("Sending raw transaction...");
    const signature = await connection.sendRawTransaction(rawTx);
    tradeStatus.innerText = `Transaction sent! Signature: ${signature}\n`;
    console.log("Transaction sent! Signature:", signature);

    // 等待交易確認
    const confirmation = await connection.confirmTransaction(signature, "confirmed");
    console.log("Transaction confirmation result:", confirmation);

    // 試著取得解析後的交易詳細 log
    const parsedTx = await connection.getParsedTransaction(signature);
    if (parsedTx && parsedTx.meta) {
      console.log("Parsed transaction logs:", parsedTx.meta.logMessages);
    } else {
      console.log("No parsed transaction logs available.");
    }

    tradeStatus.innerText += "Transaction confirmed!";
    console.log("Transaction confirmed!");
  } catch (err) {
    console.error("Swap transaction error:", err);
    if (err.logs) {
      console.error("Transaction logs:", err.logs);
      tradeStatus.innerText = `Swap transaction error: ${err.message}\nLogs:\n${err.logs.join('\n')}`;
    } else {
      tradeStatus.innerText = `Swap transaction error: ${err.message}`;
    }
    // 若錯誤物件包含 signature，嘗試抓取 parsed transaction log
    if (err.signature) {
      try {
        const parsedTx = await connection.getParsedTransaction(err.signature);
        if (parsedTx && parsedTx.meta) {
          console.error("Detailed parsed logs:", parsedTx.meta.logMessages);
        }
      } catch (parseErr) {
        console.error("Error parsing transaction logs:", parseErr);
      }
    }
  }
}

// =====================
// 綁定按鈕事件
// =====================
connectWalletBtn.addEventListener("click", async () => {
  console.log("Connect Wallet button clicked!");
  // 先初始化 discriminator
  await initializeDiscriminator();
  console.log("After initialization, BUY_METHOD_DISCM:", BUY_METHOD_DISCM);
  // 再呼叫連接錢包
  connectWallet();
});

swapBtn.addEventListener("click", () => {
  console.log("Swap button clicked!");
  swapNOVA();
});

swapInputsBtn.addEventListener('click', () => {
  const tmp = solInput.value;
  solInput.value = novaInput.value;
  novaInput.value = tmp;
  console.log("Swapped input values (SOL <-> NOVA)");
});

// =====================
// 自動換算函式（SOL 與 NOVA 互換）
// =====================
function updateNovaFromSOL() {
  const solVal = parseFloat(solInput.value);
  console.log("updateNovaFromSOL triggered. SOL value:", solVal,
    "SOL_USD_PRICE:", window.SOL_USD_PRICE,
    "CURRENT_NOVA_PRICE_USD:", window.CURRENT_NOVA_PRICE_USD);
  if (!solInput.value || isNaN(solVal) || solVal <= 0) {
    novaInput.value = "";
    return;
  }
  const novaVal = solVal * (window.SOL_USD_PRICE / window.CURRENT_NOVA_PRICE_USD);
  novaInput.value = novaVal.toFixed(5);
}

function updateSolFromNova() {
  const novaVal = parseFloat(novaInput.value);
  console.log("updateSolFromNova triggered. NOVA value:", novaVal,
    "SOL_USD_PRICE:", window.SOL_USD_PRICE,
    "CURRENT_NOVA_PRICE_USD:", window.CURRENT_NOVA_PRICE_USD);
  if (!novaInput.value || isNaN(novaVal) || novaVal <= 0) {
    solInput.value = "";
    return;
  }
  const solVal = novaVal * (window.CURRENT_NOVA_PRICE_USD / window.SOL_USD_PRICE);
  solInput.value = solVal.toFixed(5);
}

solInput.addEventListener('input', updateNovaFromSOL);
novaInput.addEventListener('input', updateSolFromNova);
