import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Wallet Generation Script
 * 
 * This script provides comprehensive wallet generation functionality including:
 * - Generate new Ethereum wallets with private keys and mnemonics
 * - Export wallets in multiple formats (JSON, encrypted keystore)
 * - Validate wallet addresses and private keys
 * - Generate multiple wallets in batch
 * - Security features and best practices
 */

class WalletGenerator {
    constructor() {
        this.wallets = [];
        this.exportPath = './generated-wallets';
    }

    /**
     * Generate a single new wallet
     * @param {string} password - Optional password for keystore encryption
     * @returns {Object} Wallet object with address, privateKey, mnemonic, etc.
     */
    generateWallet(password = null) {
        try {
            // Generate a new random wallet
            const wallet = ethers.Wallet.createRandom();

            const walletData = {
                address: wallet.address,
                privateKey: wallet.privateKey,
                mnemonic: wallet.mnemonic.phrase,
                publicKey: wallet.publicKey,
                createdAt: new Date().toISOString(),
                network: 'ethereum'
            };

            // Add keystore if password provided
            if (password) {
                walletData.keystore = wallet.encryptSync(password);
            }

            this.wallets.push(walletData);
            return walletData;
        } catch (error) {
            throw new Error(`Failed to generate wallet: ${error.message}`);
        }
    }

    /**
     * Generate multiple wallets in batch
     * @param {number} count - Number of wallets to generate
     * @param {string} password - Optional password for keystore encryption
     * @returns {Array} Array of wallet objects
     */
    generateMultipleWallets(count, password = null) {
        if (count <= 0 || count > 1000) {
            throw new Error('Count must be between 1 and 1000');
        }

        const wallets = [];
        for (let i = 0; i < count; i++) {
            const wallet = this.generateWallet(password);
            wallets.push(wallet);
        }
        return wallets;
    }

    /**
     * Generate wallet from existing mnemonic
     * @param {string} mnemonic - Existing mnemonic phrase
     * @param {string} password - Optional password for keystore encryption
     * @returns {Object} Wallet object
     */
    generateFromMnemonic(mnemonic, password = null) {
        try {
            const wallet = ethers.Wallet.fromPhrase(mnemonic);

            const walletData = {
                address: wallet.address,
                privateKey: wallet.privateKey,
                mnemonic: wallet.mnemonic.phrase,
                publicKey: wallet.publicKey,
                createdAt: new Date().toISOString(),
                network: 'ethereum',
                imported: true
            };

            if (password) {
                walletData.keystore = wallet.encryptSync(password);
            }

            this.wallets.push(walletData);
            return walletData;
        } catch (error) {
            throw new Error(`Failed to generate wallet from mnemonic: ${error.message}`);
        }
    }

    /**
     * Generate wallet from private key
     * @param {string} privateKey - Private key (with or without 0x prefix)
     * @param {string} password - Optional password for keystore encryption
     * @returns {Object} Wallet object
     */
    generateFromPrivateKey(privateKey, password = null) {
        try {
            // Ensure private key has 0x prefix
            const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            const wallet = new ethers.Wallet(formattedPrivateKey);

            const walletData = {
                address: wallet.address,
                privateKey: wallet.privateKey,
                mnemonic: null, // Not available when importing from private key
                publicKey: wallet.publicKey,
                createdAt: new Date().toISOString(),
                network: 'ethereum',
                imported: true
            };

            if (password) {
                walletData.keystore = wallet.encryptSync(password);
            }

            this.wallets.push(walletData);
            return walletData;
        } catch (error) {
            throw new Error(`Failed to generate wallet from private key: ${error.message}`);
        }
    }

    /**
     * Validate an Ethereum address
     * @param {string} address - Address to validate
     * @returns {boolean} True if valid
     */
    validateAddress(address) {
        try {
            return ethers.isAddress(address);
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate a private key
     * @param {string} privateKey - Private key to validate
     * @returns {boolean} True if valid
     */
    validatePrivateKey(privateKey) {
        try {
            const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            new ethers.Wallet(formattedPrivateKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate a mnemonic phrase
     * @param {string} mnemonic - Mnemonic phrase to validate
     * @returns {boolean} True if valid
     */
    validateMnemonic(mnemonic) {
        try {
            ethers.Wallet.fromPhrase(mnemonic);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Export wallets to JSON file
     * @param {string} filename - Output filename
     * @param {boolean} includePrivateKeys - Whether to include private keys in export
     * @returns {string} Path to exported file
     */
    exportToJSON(filename = 'wallets.json', includePrivateKeys = true) {
        try {
            this.ensureExportDirectory();

            const exportData = this.wallets.map(wallet => {
                const data = {
                    address: wallet.address,
                    publicKey: wallet.publicKey,
                    createdAt: wallet.createdAt,
                    network: wallet.network,
                    imported: wallet.imported || false
                };

                if (includePrivateKeys) {
                    data.privateKey = wallet.privateKey;
                    data.mnemonic = wallet.mnemonic;
                }

                return data;
            });

            const filePath = path.join(this.exportPath, filename);
            fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));

            console.log(`✅ Wallets exported to: ${filePath}`);
            return filePath;
        } catch (error) {
            throw new Error(`Failed to export wallets: ${error.message}`);
        }
    }

    /**
     * Export wallets to CSV file
     * @param {string} filename - Output filename
     * @param {boolean} includePrivateKeys - Whether to include private keys in export
     * @returns {string} Path to exported file
     */
    exportToCSV(filename = 'wallets.csv', includePrivateKeys = true) {
        try {
            this.ensureExportDirectory();

            const headers = ['Address', 'PublicKey', 'CreatedAt', 'Network', 'Imported'];
            if (includePrivateKeys) {
                headers.push('PrivateKey', 'Mnemonic');
            }

            const csvContent = [
                headers.join(','),
                ...this.wallets.map(wallet => {
                    const row = [
                        wallet.address,
                        wallet.publicKey,
                        wallet.createdAt,
                        wallet.network,
                        wallet.imported || false
                    ];

                    if (includePrivateKeys) {
                        row.push(wallet.privateKey, wallet.mnemonic || '');
                    }

                    return row.map(field => `"${field}"`).join(',');
                })
            ].join('\n');

            const filePath = path.join(this.exportPath, filename);
            fs.writeFileSync(filePath, csvContent);

            console.log(`✅ Wallets exported to: ${filePath}`);
            return filePath;
        } catch (error) {
            throw new Error(`Failed to export wallets to CSV: ${error.message}`);
        }
    }

    /**
     * Export individual keystore files
     * @param {string} password - Password for keystore encryption
     * @returns {Array} Array of exported file paths
     */
    exportKeystoreFiles(password) {
        if (!password) {
            throw new Error('Password is required for keystore export');
        }

        try {
            this.ensureExportDirectory();
            const keystorePath = path.join(this.exportPath, 'keystores');

            if (!fs.existsSync(keystorePath)) {
                fs.mkdirSync(keystorePath, { recursive: true });
            }

            const exportedFiles = [];

            this.wallets.forEach((wallet, index) => {
                if (wallet.keystore) {
                    const filename = `keystore-${wallet.address.slice(2, 10)}-${index}.json`;
                    const filePath = path.join(keystorePath, filename);
                    fs.writeFileSync(filePath, wallet.keystore);
                    exportedFiles.push(filePath);
                }
            });

            console.log(`✅ Keystore files exported to: ${keystorePath}`);
            return exportedFiles;
        } catch (error) {
            throw new Error(`Failed to export keystore files: ${error.message}`);
        }
    }

    /**
     * Get wallet balance (requires provider)
     * @param {string} address - Wallet address
     * @param {string} rpcUrl - RPC URL for the network
     * @returns {Object} Balance information
     */
    async getWalletBalance(address, rpcUrl = 'https://eth.llamarpc.com') {
        try {
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const balance = await provider.getBalance(address);

            return {
                address,
                balance: balance.toString(),
                balanceEth: ethers.formatEther(balance),
                network: 'ethereum'
            };
        } catch (error) {
            throw new Error(`Failed to get wallet balance: ${error.message}`);
        }
    }

    /**
     * Generate secure random password
     * @param {number} length - Password length (default: 32)
     * @returns {string} Secure random password
     */
    generateSecurePassword(length = 32) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';

        for (let i = 0; i < length; i++) {
            const randomIndex = crypto.randomInt(0, charset.length);
            password += charset[randomIndex];
        }

        return password;
    }

    /**
     * Clear all generated wallets from memory
     */
    clearWallets() {
        this.wallets = [];
        console.log('✅ Wallets cleared from memory');
    }

    /**
     * Get summary of generated wallets
     * @returns {Object} Summary information
     */
    getSummary() {
        return {
            totalWallets: this.wallets.length,
            importedWallets: this.wallets.filter(w => w.imported).length,
            generatedWallets: this.wallets.filter(w => !w.imported).length,
            addresses: this.wallets.map(w => w.address)
        };
    }

    /**
     * Ensure export directory exists
     * @private
     */
    ensureExportDirectory() {
        if (!fs.existsSync(this.exportPath)) {
            fs.mkdirSync(this.exportPath, { recursive: true });
        }
    }
}

// CLI Interface
async function main() {
    const generator = new WalletGenerator();

    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    try {
        switch (command) {
            case 'generate':
                const count = parseInt(args[1]) || 1;
                const password = args[2] || generator.generateSecurePassword();

                console.log(`🔐 Generating ${count} wallet(s)...`);
                const wallets = generator.generateMultipleWallets(count, password);

                console.log('\n📋 Generated Wallets:');
                wallets.forEach((wallet, index) => {
                    console.log(`\n--- Wallet ${index + 1} ---`);
                    console.log(`Address: ${wallet.address}`);
                    console.log(`Private Key: ${wallet.privateKey}`);
                    console.log(`Mnemonic: ${wallet.mnemonic}`);
                    console.log(`Created: ${wallet.createdAt}`);
                });

                // Export options
                generator.exportToJSON(`wallets-${Date.now()}.json`);
                generator.exportToCSV(`wallets-${Date.now()}.csv`);
                generator.exportKeystoreFiles(password);

                console.log(`\n🔑 Keystore Password: ${password}`);
                console.log('⚠️  IMPORTANT: Save this password securely!');
                break;

            case 'import-mnemonic':
                const mnemonic = args[1];
                if (!mnemonic) {
                    throw new Error('Mnemonic phrase is required');
                }

                const importPassword = args[2] || generator.generateSecurePassword();
                const importedWallet = generator.generateFromMnemonic(mnemonic, importPassword);

                console.log('📥 Imported Wallet:');
                console.log(`Address: ${importedWallet.address}`);
                console.log(`Private Key: ${importedWallet.privateKey}`);
                console.log(`Mnemonic: ${importedWallet.mnemonic}`);

                generator.exportToJSON(`imported-wallet-${Date.now()}.json`);
                generator.exportKeystoreFiles(importPassword);

                console.log(`\n🔑 Keystore Password: ${importPassword}`);
                break;

            case 'import-private-key':
                const privateKey = args[1];
                if (!privateKey) {
                    throw new Error('Private key is required');
                }

                const pkPassword = args[2] || generator.generateSecurePassword();
                const pkWallet = generator.generateFromPrivateKey(privateKey, pkPassword);

                console.log('📥 Imported Wallet:');
                console.log(`Address: ${pkWallet.address}`);
                console.log(`Private Key: ${pkWallet.privateKey}`);

                generator.exportToJSON(`imported-wallet-${Date.now()}.json`);
                generator.exportKeystoreFiles(pkPassword);

                console.log(`\n🔑 Keystore Password: ${pkPassword}`);
                break;

            case 'validate':
                const address = args[1];
                if (!address) {
                    throw new Error('Address is required for validation');
                }

                const isValid = generator.validateAddress(address);
                console.log(`Address ${address} is ${isValid ? 'valid' : 'invalid'}`);
                break;

            case 'balance':
                const balanceAddress = args[1];
                const rpcUrl = args[2] || 'https://eth.llamarpc.com';

                if (!balanceAddress) {
                    throw new Error('Address is required for balance check');
                }

                const balance = await generator.getWalletBalance(balanceAddress, rpcUrl);
                console.log(`\n💰 Balance for ${balance.address}:`);
                console.log(`ETH: ${balance.balanceEth}`);
                console.log(`Wei: ${balance.balance}`);
                break;

            default:
                console.log(`
🔐 Ethereum Wallet Generator

Usage:
  node WalletGeneration.js <command> [options]

Commands:
  generate [count] [password]     Generate new wallet(s) (default: 1)
  import-mnemonic <phrase> [pwd]  Import wallet from mnemonic
  import-private-key <key> [pwd]  Import wallet from private key
  validate <address>              Validate Ethereum address
  balance <address> [rpc]         Check wallet balance

Examples:
  node WalletGeneration.js generate 5
  node WalletGeneration.js import-mnemonic "your twelve word mnemonic phrase here"
  node WalletGeneration.js validate 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6
  node WalletGeneration.js balance 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6

Security Notes:
  - Always use strong passwords for keystore files
  - Never share private keys or mnemonics
  - Store backups in secure locations
  - Test with small amounts first
        `);
        }
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Export for use as module
export { WalletGenerator };

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
