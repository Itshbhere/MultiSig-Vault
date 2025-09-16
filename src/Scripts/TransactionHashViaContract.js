import { ethers } from "ethers";

async function sendSafeTx() {
  // Check if MetaMask is available
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed");
  }
  
  // Check if MetaMask is the provider (not Phantom or other wallets)
  if (window.ethereum.isMetaMask !== true) {
    throw new Error("Please use MetaMask wallet. Phantom is not supported for Ethereum transactions.");
  }
  
  await window.ethereum.request({ method: "eth_requestAccounts" });

  // Ethers provider & signer from MetaMask
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  // Safe contract ABI for the functions we need
  const safeABI = [
    "function nonce() view returns (uint256)",
    "function getTransactionHash(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)",
    "function estimateTx(address to, uint256 value, bytes calldata data, uint8 operation) view returns (uint256)"
  ];

  // Create Safe contract instance using ethers
  const safeContract = new ethers.Contract(
    "0x023809b6039c7BD5f92350661354b708D37b07ab", // Your Safe address
    safeABI,
    signer
  );

  // Get current nonce
  const nonce = await safeContract.nonce();

  // Create Safe transaction data
  const safeTransactionData = {
    to: "0xTargetContractAddress",
    value: "0", // ETH in wei
    data: "0x40c10f19000000000000000000000000023809b6039c7bd5f92350661354b708d37b07ab0000000000000000000000000000000000000000000000000de0b6b3a7640000",
    operation: 0, // Call operation
    safeTxGas: "0", // Will be estimated
    baseGas: "0", // Will be estimated
    gasPrice: "0", // Will be estimated
    gasToken: "0x0000000000000000000000000000000000000000", // ETH
    refundReceiver: "0x0000000000000000000000000000000000000000", // No refund
    nonce: nonce // Current nonce
  };

  // Estimate gas for the transaction
  const gasEstimate = await safeContract.estimateTx(
    safeTransactionData.to,
    safeTransactionData.value,
    safeTransactionData.data,
    safeTransactionData.operation
  );

  safeTransactionData.safeTxGas = gasEstimate.toString();
  safeTransactionData.baseGas = "0";
  safeTransactionData.gasPrice = "0";

  // Get the transaction hash
  const txHash = await safeContract.getTransactionHash(
    safeTransactionData.to,
    safeTransactionData.value,
    safeTransactionData.data,
    safeTransactionData.operation,
    safeTransactionData.safeTxGas,
    safeTransactionData.baseGas,
    safeTransactionData.gasPrice,
    safeTransactionData.gasToken,
    safeTransactionData.refundReceiver,
    safeTransactionData.nonce
  );

  // Sign the transaction hash
  const signature = await signer.signMessage(ethers.getBytes(txHash));
  
  console.log("Safe transaction hash:", txHash);
  console.log("Signature:", signature);
  
  // Note: To execute the transaction, you would need to call safeContract.execTransaction
  // This requires the Safe to be set up with the signer as an owner
  console.log("To execute, call execTransaction on the Safe contract");
}

sendSafeTx().catch(console.error);
