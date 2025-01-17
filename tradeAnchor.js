/***************************************************************************
 * tradeAnchor.js
 *
 * 功能：
 *  1. 連接 Phantom 錢包
 *  2. 動態取得 (或建立) buyer 的 NOVA ATA
 *  3. 使用 Coral/Anchor 呼叫合約的 buy()，完成 (SOL -> NOVA) 交易
 ***************************************************************************/

// 1. 匯入 Anchor, SPL-Token, 以及你的 nova.json (IDL)
import { AnchorProvider, Program, web3, BN } from "@coral-xyz/anchor";
import { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idl from "./nova.json"; // 你的 IDL 檔案 (由 anchor build 產生)

// 2. DOM 元素 (假設在 HTML 中已存在對應的 id)
const connectWalletBtn = document.getElementById("connectWalletBtn");
const walletStatus = document.getElementById("walletStatus");
const solInput = document.getElementById("solInput");
const novaInput = document.getElementById("novaInput");
const swapBtn = document.getElementById("swapBtn");
const tradeStatus = document.getElementById("tradeStatus");

// 3. 全域變數
let walletPublicKey = null;

// 4. 你的 Program ID (確保跟合約的 declare_id! 一致)
//    以及各個 PDA / 帳戶地址 (請自行替換成實際部署的)
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
 *   - 建立 AnchorProvider (連線到你的 RPC 端點, 這裡用 vercel RPC-proxy)
 *   - 第二參數 wallet = window.solana (Phantom)
 ***************************************************************************/
function getProvider() {
  const connection = new web3.Connection(
    "https://nova-enigmaticsloths-projects.vercel.app/api/rpc-proxy",
    "confirmed"
  );
  const provider = new AnchorProvider(connection, window.solana, {
    preflightCommitment: "confirmed",
  });
  return provider;
}

/***************************************************************************
 * connectWallet():
 *   - 連接 Phantom 錢包並取得使用者公鑰
 ***************************************************************************/
async function connectWallet() {
  if (window.solana && window.solana.isPhantom) {
    try {
      // 呼叫 Phantom connect，等使用者同意
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

/***************************************************************************
 * getBuyerNovaAccount():
 *   - 取得或自動建立 buyer 的 Associated Token Account(ATA) for NOVA
 *   - 回傳 ATA 的地址 (Pubkey)
 ***************************************************************************/
async function getBuyerNovaAccount(provider, buyerPubkey) {
  // spl-token 提供的 getOrCreateAssociatedTokenAccount
  // payer: 誰支付建立 ATA 的費用 (通常就是 buyer 自己)
  // mint: 你的 NOVA token mint
  // owner: buyerPubkey
  const ata = await getOrCreateAssociatedTokenAccount(
    provider.connection,   // Connection
    provider.wallet.payer, // Payer (SignTransaction用)
    MINT,                  // 你的 NOVA Mint
    buyerPubkey            // ATA 所屬者 (buyer)
  );
  // ata.address 就是 buyer_nova_account
  return ata.address;
}

/***************************************************************************
 * swapNOVA():
 *   - 執行 (SOL -> NOVA) 買操作
 *   - 1. 讀取使用者輸入的 SOL 數量
 *   - 2. getOrCreate buyerNovaAccount
 *   - 3. 呼叫 anchor program.methods.buy(...)
 ***************************************************************************/
async function swapNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }

  // (1) 讀取使用者輸入多少 SOL
  const solValue = parseFloat(solInput.value);
  if (isNaN(solValue) || solValue <= 0) {
    tradeStatus.innerText = "Please enter a valid SOL amount.";
    return;
  }
  // convert SOL to lamports (1 SOL = 1e9 lamports)
  const lamportsToSend = Math.floor(solValue * 1e9);

  // 這裡隨意給個 currentNovaPrice，
  // 請依你的合約 buy(ctx, sol_amount, current_nova_price) 實際需求來計算
  const currentNovaPrice = 100000;

  tradeStatus.innerText = `Executing Buy: ${solValue} SOL → Estimated NOVA...\n`;

  try {
    // (2) 建立 Anchor Program
    const provider = getProvider();
    const program = new Program(idl, programId, provider);

    // 取得 buyer 的 nova ATA
    const buyerPubkey = new web3.PublicKey(walletPublicKey);
    const buyerNovaAccountPubkey = await getBuyerNovaAccount(provider, buyerPubkey);
    console.log("buyerNovaAccount:", buyerNovaAccountPubkey.toBase58());

    // (3) 呼叫 buy()
    // buy(ctx, sol_amount: u64, current_nova_price: u64)
    // => 需要 2 個參數 (BN包)，需要帶所有對應的 accounts
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
        tokenProgram: TOKEN_PROGRAM_ID,            // SPL Token Program
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

// === 綁定事件 ===
connectWalletBtn.addEventListener("click", connectWallet);
swapBtn.addEventListener("click", swapNOVA);