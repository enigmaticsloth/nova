// trade.js

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import * as borsh from 'borsh';

document.addEventListener("DOMContentLoaded", () => {
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

  console.log("DOM fully loaded. Checking elements:");
  console.log("connectWalletBtn:", connectWalletBtn);
  console.log("walletStatus:", walletStatus);

  // =====================
  // 全域變數與常數設定
  // =====================
  let walletPublicKey = null;

  const programId = new PublicKey("HEAz4vAABHTYdY23JuYD3VTHKSBRXSdyt7Dq8YVGDUWm");
  const globalStatePubkey = new PublicKey("HLSLMK51mUc375t69T93quNqpLqLdySZKvodjyeuNdp");
  const mintPubkey = new PublicKey("5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX");
  const mintAuthorityPubkey = new PublicKey("AfqG9eh244LzXTEBo4UDepa2pKKTopvZHWmX4sFadch7");
  const novaTreasuryPubkey = new PublicKey("4fuD8ELTbhRBcnG61WnSVe9TCdkVAhJLKteYz51yMnKH");
  const liquidityPoolPdaPubkey = new PublicKey("C7sSvpgZvRPVqLqfLSeDb3ErHWhMQYM3fvbRgSWBwVkF");
  const developerRewardPoolPubkey = new PublicKey("9WHRVWCiWeCC8Lhb4ohk3e2wdoZpALh6xNcnteP6E75o");
  const feeRecipientPubkey = new PublicKey("7MaisRjGojZVb9gS6B1UZqBtFqajAArTkwnXhp3Syubk");

  const PROGRAM_NAME = "nova";
  const BUY_METHOD_NAME = "buy";

  // 全域變數儲存 discriminator（必須動態計算）
  let BUY_METHOD_DISCM;

  // =====================
  // 定義 Borsh 序列化結構與 schema
  // =====================
  // 注意：我們這裡直接使用 BigInt 表示 u64，而非 BN.js
  class BuyInstruction {
    constructor(fields) {
      this.solAmount = fields.solAmount;         // BigInt
      this.currentNovaPrice = fields.currentNovaPrice; // BigInt
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

  // =====================
  // 利用 Borsh 序列化 BuyInstruction 參數（使用 BigInt 表示 u64）
  // =====================
  function serializeBuyData(solAmount, currentNovaPrice) {
    // 將傳入的數值轉為 BigInt
    const solBigInt = BigInt(solAmount);
    const novaBigInt = BigInt(currentNovaPrice);
    console.log("solBigInt:", solBigInt.toString());
    console.log("novaBigInt:", novaBigInt.toString());
    const instructionData = new BuyInstruction({
      solAmount: solBigInt,
      currentNovaPrice: novaBigInt,
    });
    console.log("Instruction Data:", instructionData);
    return borsh.serialize(BuyInstructionSchema, instructionData);
  }

  // =====================
  // 動態計算 Discriminator（使用 SHA-256 並取前 8 個 byte）
  // =====================
  async function getDiscriminator(programName, instructionName) {
    const message = `${programName}:${instructionName}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const discriminator = hashArray.slice(0, 8);
    return new Uint8Array(discriminator);
  }

  async function initializeDiscriminator() {
    BUY_METHOD_DISCM = await getDiscriminator(PROGRAM_NAME, BUY_METHOD_NAME);
    console.log("Buy Instruction Discriminator:", BUY_METHOD_DISCM);
    // 預期輸出：Uint8Array(8) [28, 43, 80, 163, 53, 73, 88, 8]
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
  // 檢查或建立使用者的 ATA
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
  // SwapNOVA 函式：組裝交易、編碼資料並發送
  // =====================
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
      const approximateNovaPrice = 1_000_000; // 請依實際情況調整 NOVA 價格

      let transaction = new Transaction();

      console.log("Preparing ATA if needed...");
      const buyerAta = await prepareBuyerAtaIfNeeded(connection, fromPubkey, mintPubkey, transaction);
      console.log("Buyer ATA:", buyerAta.toBase58());

      const data = encodeBuyDataWithBorsh(lamports, approximateNovaPrice);
      console.log("Encoded buy data:", data);
      // 注意：前 8 個 byte 應正確為 Uint8Array(8) [28, 43, 80, 163, 53, 73, 88, 8]

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
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
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

      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      console.log("Transaction confirmation result:", confirmation);

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
    await initializeDiscriminator();
    console.log("After initialization, BUY_METHOD_DISCM:", BUY_METHOD_DISCM);
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
});
