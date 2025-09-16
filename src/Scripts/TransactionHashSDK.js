import Safe from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { ethers } from 'ethers'
import { OperationType } from '@safe-global/types-kit'

async function main() {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed')
  }

  await window.ethereum.request({ method: 'eth_requestAccounts' })

  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()

  const SAFE_ADDRESS = '0xYourSafeAddress'
  const CHAIN_ID = await signer.getChainId()

  // ✅ Safe.init with correct parameters (matching Testsdk.js pattern)
  const safeSdk = await Safe.init({
    provider: "https://eth-sepolia.g.alchemy.com/v2/cdbVVL8-cDwSuLc6nQ0Lfg-VPvvHMtV0",
    signer: signer,
    safeAddress: SAFE_ADDRESS
  })

  const safeTransactionData = {
    to: '0xRecipientAddress',
    value: '10000000000000000', // 0.01 ETH
    data: '0x',
    operation: OperationType.Call
  }

  const safeTransaction = await safeSdk.createTransaction({
    transactions: [safeTransactionData],
    options: { onlyCalls: false }
  })

  const safeTxHash = await safeSdk.getTransactionHash(safeTransaction)
  console.log('Safe Transaction Hash:', safeTxHash)

  const signature = await safeSdk.signTransaction(safeTransaction)
  console.log('Signature:', signature.data)

  const apiKit = new SafeApiKit({
    chainId: BigInt(CHAIN_ID),
    apiKey: import.meta.env.VITE_SAFE_API_KEY
  })

  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: await signer.getAddress(),
    senderSignature: signature.signatures.data
  })

  const signatureResponse = await apiKit.confirmTransaction(safeTxHash, signature.signatures.get(await signer.getAddress().toLowerCase()).data)

  console.log('Signature response:', signatureResponse);


  console.log('Transaction proposed successfully!')
}

main().catch(console.error)
