import { ethers } from 'ethers';

async function signHashWithMetaMask() {
  try {
    // Check if MetaMask is available
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    // Request account access
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    // Hardcoded hash to sign
    const hashToSign = '0x8a19af7a83a756581e8dfe54f198b5224d3f6216711280f02a984f3eeb928b4a';
    
    console.log('🔧 Setting up MetaMask signer...');
    
    // Create provider and signer from MetaMask
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    console.log('👤 Signer address:', await signer.getAddress());
    console.log('📝 Hash to sign:', hashToSign);
    
    // Sign the hash
    console.log('✍️ Signing hash...');
    const signature = await signer.signMessage(ethers.getBytes(hashToSign));
    
    console.log('✅ Hash signed successfully!');
    console.log('📜 Signature:', signature);
    
    return signature;
    
  } catch (error) {
    console.error('❌ Error signing hash:', error);
    throw error;
  }
}

// Export for use in other modules
export { signHashWithMetaMask };

// Run if called directly
if (typeof window !== 'undefined') {
  // Only run in browser environment
  signHashWithMetaMask();
}
