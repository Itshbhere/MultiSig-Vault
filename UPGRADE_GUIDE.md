# Proxy Upgrade Guide

This guide explains how to upgrade the DCO proxy contract using the multisig vault (Safe) as the owner.

## Overview

The upgrade process involves:
1. Deploying a new implementation contract using Forge
2. Creating a Safe transaction to call `upgradeToAndCall` on the proxy
3. Signing the transaction with your private key
4. Proposing it to the Safe Transaction Service
5. Waiting for other owners to sign
6. Executing the transaction once threshold is reached

## Prerequisites

- Node.js and npm installed
- Hardhat installed (for compiling contracts and getting bytecode)
- Environment variables configured in `.env` file
- Access to a Safe owner private key

### Installing Hardhat

If you don't have Hardhat installed, install it as a dev dependency:

```bash
npm install --save-dev hardhat
```

Or with yarn:
```bash
yarn add -D hardhat
```

### Setting Up Hardhat Config

Create a `hardhat.config.js` file in your project root (or use the template provided):

```javascript
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28", // Match your contract version
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts", // Path to your contracts directory
    artifacts: "./artifacts"
  }
};
```

Make sure your `DCOLock.sol` contract is in the contracts directory specified in the config.

## Environment Variables

Create or update your `.env` file with the following:

```env
# Private key of one of the Safe owners
PRIVATE_KEY=your_private_key_here

# Safe (multisig vault) address
SAFE_ADDRESS=0x023809b6039c7BD5f92350661354b708D37b07ab

# RPC URL for the network
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_api_key

# Chain ID (11155111 for Sepolia)
CHAIN_ID=11155111

# Safe Transaction Service API key
SAFE_API_KEY=your_safe_api_key

# Proxy address to upgrade
PROXY_ADDRESS=0xB8dD4CD897211A6430c2ab3B8386aBeC3Dc08d85

# (Optional) Contract name (defaults to 'DCOLock')
CONTRACT_NAME=DCOLock

# (Optional) Full path to contract file (if not in standard location)
CONTRACT_PATH=

# (Optional) New implementation address (if already deployed, skip compilation)
NEW_IMPLEMENTATION_ADDRESS=

# (Optional) Initialization data for upgradeToAndCall
INIT_DATA=0x
```

## Step-by-Step Process

### Step 1: Prepare Your Contract

Make sure your `DCOLock.sol` contract is in the contracts directory (or the path specified in `hardhat.config.js`).

### Step 2: Deploy New Implementation and Create Safe Transaction

The `UpgradeProxy.js` script will automatically:
1. Compile your contract using Hardhat
2. Extract the bytecode
3. Deploy the new implementation
4. Create a Safe transaction to upgrade the proxy
5. Sign and propose it to the Safe Transaction Service

Run the script:

```bash
# The script will automatically compile and deploy
node src/Scripts/UpgradeProxy.js
```

**Optional:** If you want to use an already deployed implementation:

```bash
# Pass the implementation address as argument
node src/Scripts/UpgradeProxy.js 0x<implementation_address>
```

The script will:
- Compile the contract using Hardhat (if not using existing implementation)
- Deploy the new implementation (if not provided)
- Verify you're a Safe owner
- Encode the `upgradeToAndCall` function call
- Create a Safe transaction
- Sign it with your private key
- Propose it to the Safe Transaction Service
- Confirm your signature

### Step 3: Wait for Other Signatures

After proposing the transaction:
1. Check pending transactions on Safe UI: https://safe-transaction-sepolia.safe.global/#/safes/{SAFE_ADDRESS}/transactions
2. Other owners need to sign the transaction
3. Wait until the threshold is reached

### Step 4: Execute the Transaction

Once enough signatures are collected, execute the transaction:

**Option A: Using the Safe UI**
1. Go to the Safe UI
2. Find the pending transaction
3. Click "Execute"

**Option B: Using the ExecuteTX.js script**
```bash
node src/Helper/ExecuteTX.js
```

### Step 5: Verify the Upgrade

After execution, verify the upgrade was successful:

```javascript
// Check the implementation address
const proxy = await ethers.getContractAt("DCOLock", PROXY_ADDRESS);
const version = await proxy.getVersion();
console.log("New version:", version);
```

## Scripts Available

### UpgradeProxySimple.js
Simple script that creates a Safe transaction for upgrading the proxy. Use this after deploying the new implementation.

**Usage:**
```bash
node src/Scripts/UpgradeProxySimple.js <implementation_address>
```

### UpgradeProxy.js
Full-featured script that can also deploy the implementation (requires bytecode). Use this if you want to deploy and propose in one step.

**Usage:**
```bash
# Deploy and propose
node src/Scripts/UpgradeProxy.js

# Use existing implementation
node src/Scripts/UpgradeProxy.js <implementation_address>
```

## Troubleshooting

### Error: "Signer is not an owner"
- Make sure the `PRIVATE_KEY` in `.env` belongs to one of the Safe owners
- Verify the `SAFE_ADDRESS` is correct

### Error: "Invalid implementation address"
- Check that the implementation address is valid
- Ensure the contract was deployed successfully

### Error: "Transaction proposed but not confirmed"
- The script automatically confirms your signature
- Check the Safe Transaction Service for the transaction status

### Transaction stuck in pending
- Check if other owners have signed
- Verify the threshold is correct
- Check if there are any issues with the transaction data

## Security Considerations

1. **Private Keys**: Never commit private keys to version control
2. **Verification**: Always verify the implementation address before proposing
3. **Testing**: Test the upgrade on a testnet first
4. **Review**: Have other owners review the new implementation before upgrading
5. **Backup**: Keep a backup of the old implementation address

## Example Workflow

```bash
# 1. Make sure Hardhat is installed
npm install --save-dev hardhat

# 2. Ensure your contract is in the contracts directory
# (or update hardhat.config.js to point to the correct path)

# 3. Run the upgrade script (it will compile, deploy, and propose)
node src/Scripts/UpgradeProxy.js
# Output: 
# - Contract compiled
# - New implementation deployed at: 0xABC123...
# - Transaction proposed! Safe Tx Hash: 0xDEF456...

# 4. Check status
# Visit: https://safe-transaction-sepolia.safe.global/#/safes/0x023809b6039c7BD5f92350661354b708D37b07ab/transactions

# 5. After other owners sign, execute via Safe UI or:
node src/Helper/ExecuteTX.js
```

### Alternative: Using Already Deployed Implementation

If you've already deployed the implementation separately:

```bash
# Pass the implementation address
node src/Scripts/UpgradeProxy.js 0xABC123...
```

## Additional Resources

- [Safe SDK Documentation](https://docs.safe.global/safe-core-aa-sdk/protocol-kit)
- [Safe Transaction Service API](https://docs.safe.global/safe-core-aa-sdk/api-kit)
- [Forge Documentation](https://book.getfoundry.sh/)

