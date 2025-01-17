/**************************************************************
 * tradeAnchor.js
 * 
 * - 使用 Coral/Anchor 連接 Phantom 錢包、呼叫合約 (buy)
 * - 使用 ES Modules 引入 @coral-xyz/anchor 與 @solana/spl-token
 * - 需在瀏覽器支援 ES Module 的情況下運行
 * - 確保與 `trade_nova.html` 同層，並 import `nova.json` (IDL)
 **************************************************************/

import { AnchorProvider, Program, web3, BN } from "https://esm.sh/@coral-xyz/anchor@1.84.1";
import { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "https://esm.sh/@solana/spl-token@0.2.0";
import idl from "./nova.json" assert { type: "json" };

// DOM Elements
const connectWalletBtn = document.getElementById("connectWalletBtn");
const walletStatus = document.getElementById("walletStatus");
const solInput = document.getElementById("solInput");
const novaInput = document.getElementById("novaInput");
const swapBtn = document.getElementById("swapBtn");
const tradeStatus = document.getElementById("tradeStatus");

// Global Variables
let walletPublicKey = null;

// Program ID and Account Addresses (示範用，請自行替換)
const programId = new web3.PublicKey("HEAz4vAABHTYdY23JuYD3VTHKSBRXSdyt7Dq8YVGDUWm");
const GLOBAL_STATE = new web3.PublicKey("HLSLMK51mUc375t69T93quNqpLqLdySZKvodjyeuNdp");
const NOVA_TREASURY = new web3.PublicKey("4fuD8ELTbhRBcnG61WnSVe9TCdkVAhJLKteYz51yMnKH");
const MINT_AUTHORITY = new web3.PublicKey("AfqG9eh244LzXTEBo4UDepa2pKKTopvZHWmX4sFadch7");
const MINT = new web3.PublicKey("5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX");
const LIQ_POOL_PDA_ACCOUNT = new web3.PublicKey("C7sSvpgZvRPVqLqfLSeDb3ErHWhMQYM3fvbRgSWBwVkF");
const FEE_RECIPIENT = new web3.PublicKey("7MaisRjGojZVb9gS6B1UZqBtFqajAArTkwnXhp3Syubk");
const DEV_REWARD_POOL_ACCOUNT = new web3.PublicKey("9WHRVWCiWeCC8Lhb4ohk3e2wdoZpALh6xNcnteP6E75o");

/***************************************************************************
 * getProvider():
 *   - Create AnchorProvider (connect to your RPC endpoint)
 *   - Use window.solana (Phantom) as the wallet
 ***************************************************************************/
function getProvider() {
  const connection = new web3.Connection(
    // 這裡可改成你自己的 RPC proxy
    "https://nova-enigmaticsloths-projects.vercel.app/api/rpc-proxy",
    "confirmed"
  );
  return new AnchorProvider(connection, window.solana, {
    preflightCommitment: "confirmed",
  });
}

/***************************************************************************
 * getBuyerNovaAccount():
 *   - Get or create buyer's Associated Token Account (ATA) for NOVA
 *   - Returns ATA address (PublicKey)
 ***************************************************************************/
async function getBuyerNovaAccount(provider, buyerPubkey) {
  const ata = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    provider.wallet.payer, // Payer for creation
    MINT,
    buyerPubkey
  );
  return ata.address;
}

/***************************************************************************
 * swapNOVA():
 *   - Execute (SOL -> NOVA) buy operation
 ***************************************************************************/
async function swapNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }

  // (1) Read the amount of SOL from user input
  const solValue = parseFloat(solInput.value);
  if (isNaN(solValue) || solValue <= 0) {
    tradeStatus.innerText = "Please enter a valid SOL amount.";
    return;
  }
  // Convert SOL to lamports (1 SOL = 1e9 lamports)
  const lamportsToSend = Math.floor(solValue * 1e9);

  // 這裡從 pricing.js 讀取 window.CURRENT_NOVA_PRICE_USD
  // 但要注意：合約 buy() 內部怎麼計算？
  // 暫時假設只要帶一個數字即可 (以 1e6 為倍數)
  const currentNovaPrice = Math.floor(window.CURRENT_NOVA_PRICE_USD * 1e6);

  tradeStatus.innerText = `Executing Buy: ${solValue} SOL → ??? NOVA...\n`;

  try {
    // (2) Create Anchor Program
    const provider = getProvider();
    const program = new Program(idl, programId, provider);

    // (3) Get buyer's NOVA ATA
    const buyerPubkey = new web3.PublicKey(walletPublicKey);
    const buyerNovaAccountPubkey = await getBuyerNovaAccount(provider, buyerPubkey);
    console.log("buyerNovaAccount:", buyerNovaAccountPubkey.toBase58());

    // (4) 呼叫合約的 buy() 方法
    const signature = await program.methods
      .buy(new BN(lamportsToSend), new BN(currentNovaPrice))
      .accounts({
        buyer: buyerPubkey,
        globalState: GLOBAL_STATE,
        buyerNovaAccount: buyerNovaAccountPubkey,
        novaTreasury: NOVA_TREASURY,
        mintAuthority: MINT_AUTHORITY,
        mint: MINT,
        liquidityPoolPdaAccount: LIQ_POOL_PDA_ACCOUNT,
        feeRecipient: FEE_RECIPIENT,
        developerRewardPoolAccount: DEV_REWARD_POOL_ACCOUNT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    // 顯示結果
    tradeStatus.innerText += `Transaction sent! Signature: ${signature}\n`;
    tradeStatus.innerText += "Swap completed successfully!";
    console.log("Transaction signature:", signature);

  } catch (err) {
    console.error("Swap transaction error:", err);
    tradeStatus.innerText = `Swap transaction error: ${err.message}`;
  }
}

// 綁定 Swap 按鈕
swapBtn.addEventListener("click", swapNOVA);

/***************************************************************************
 * Connect Wallet
 ***************************************************************************/
connectWalletBtn.addEventListener('click', async () => {
  if (window.solana && window.solana.isPhantom) {
    try {
      const resp = await window.solana.connect();
      walletPublicKey = resp.publicKey.toString();
      walletStatus.innerText = `Wallet Connected: ${walletPublicKey}`;
    } catch (err) {
      walletStatus.innerText = `Connection Failed: ${err.message}`;
      console.error("Connection failed:", err);
    }
  } else {
    walletStatus.innerText = "Phantom wallet not found. Please install the Phantom extension.";
  }
});