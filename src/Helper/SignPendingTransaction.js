import Safe from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { ethers } from 'ethers'
import dotenv from 'dotenv'

dotenv.config()

async function signPendingTransaction() {
  
  const provider = process.env.RPC_URL
  const signer = process.env.SECOND_OWNER_PRIVATE_KEY
  const signerWallet = new ethers.Wallet(signer, provider)
  const signerAddress = await signerWallet.getAddress()

  const SAFE_ADDRESS = process.env.SAFE_ADDRESS
  const CHAIN_ID = 11155111

  // ✅ Initialize Safe SDK
  const safeSdk = await Safe.init({
    provider: provider,
    signer: signer,
    safeAddress: SAFE_ADDRESS
  })

  // ✅ Initialize Safe API Kit
  const apiKit = new SafeApiKit({
    chainId: BigInt(CHAIN_ID),
    apiKey: process.env.SAFE_API_KEY
  })

  // ✅ Fetch pending transactions
  const pendingTxs = await apiKit.getPendingTransactions(SAFE_ADDRESS)

  if (!pendingTxs.results.length) {
    console.log('No pending transactions')
    return
  }

  // ✅ Pick the first pending transaction
  const pendingTx = pendingTxs.results[0]


  // ✅ Sign the transaction
  const signature = await safeSdk.signTransaction(pendingTx)
//   console.log('Signature:', signature)
  console.log('Signature Data:', signature.signatures.get(signerAddress.toLowerCase()).data)

  // ✅ Confirm the transaction on Safe Transaction Service
  await apiKit.confirmTransaction(pendingTx.safeTxHash, signature.signatures.get(signerAddress.toLowerCase()).data)

  console.log('Transaction signed and confirmed!')
}

signPendingTransaction().catch(console.error)
