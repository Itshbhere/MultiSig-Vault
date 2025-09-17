# Safe Multi-Sig Vault Transaction Builder

A comprehensive React-based frontend application for building, signing, and managing transactions on the Safe (formerly Gnosis Safe) multi-signature wallet platform. This application provides an intuitive interface for interacting with ERC-20 tokens (USDC and ZUSD) through Safe multi-sig transactions on the Sepolia testnet.

## 🚀 Features

### Core Functionality
- **Multi-Sig Transaction Builder**: Create and manage Safe multi-signature transactions
- **Token Support**: Built-in support for USDC and ZUSD ERC-20 tokens
- **Function Selection**: Interactive interface for selecting and configuring smart contract functions
- **Parameter Input**: Dynamic form generation for function parameters with automatic decimal conversion
- **Transaction Encoding**: Automatic ABI encoding of function calls with data validation
- **Safe Integration**: Full integration with Safe Protocol Kit and Safe API Kit

### Advanced Features
- **Pending Transaction Management**: View and sign pending multi-sig transactions
- **Transaction History**: Track and display last signed transactions with full details
- **Error Handling**: Comprehensive error boundaries and browser compatibility checks
- **MetaMask Integration**: Seamless wallet connection and transaction signing
- **Real-time Status Updates**: Live transaction status and progress indicators
- **Data Persistence**: Local storage for transaction history and state management

### Security Features
- **Multi-Sig Validation**: Ensures proper multi-signature requirements are met
- **Transaction Verification**: Validates transaction data before execution
- **Browser Compatibility**: Handles various browser extension conflicts
- **Input Validation**: Comprehensive parameter validation and type checking

## 🛠️ Technology Stack

- **Frontend**: React 18 with Vite
- **Styling**: Tailwind CSS
- **Blockchain**: Ethereum (Sepolia Testnet)
- **Wallet Integration**: MetaMask
- **Safe Protocol**: Safe Protocol Kit v6.1.0, Safe API Kit v4.0.0
- **Ethers.js**: v6.15.0 for blockchain interactions
- **Build Tool**: Vite with custom configuration for browser compatibility

## 📋 Prerequisites

Before running this application, ensure you have:

- **Node.js** (v16 or higher)
- **npm** or **yarn** package manager
- **MetaMask** browser extension installed
- **Sepolia ETH** for gas fees (get from [Sepolia Faucet](https://sepoliafaucet.com/))
- **Safe Multi-Sig Wallet** deployed on Sepolia testnet

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd ZKT
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
VITE_SAFE_API_KEY=your_safe_api_key_here
```

**Note**: The Safe API key is optional but recommended for better rate limits and additional features.

### 4. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 5. Build for Production
```bash
npm run build
npm run preview
```

## 🔧 Configuration

### Safe Wallet Setup
The application is configured to work with a specific Safe wallet on Sepolia:
- **Safe Address**: `0x023809b6039c7BD5f92350661354b708D37b07ab`
- **Chain ID**: `11155111` (Sepolia)

### Supported Tokens
- **USDC**: `0x3C07f5834E944c43571961ba6207fC68fE22039A`
- **ZUSD**: `0x37eccA6723287D66F6C1d56c7722A39BA04BcD10`

## 📖 Usage Guide

### Creating a Transaction

1. **Select Token**: Choose between USDC or ZUSD from the token selection panel
2. **Choose Function**: Select the desired smart contract function from the available options
3. **Enter Parameters**: Fill in the required parameters (amounts are automatically converted to 18 decimals)
4. **Generate Encoded Data**: Click "Generate Encoded Data" to create the transaction data
5. **Sign Transaction**: Click "Create & Sign Safe Transaction" to propose the transaction to the Safe

### Managing Pending Transactions

1. **View Pending**: The right panel shows all pending transactions requiring signatures
2. **Sign & Confirm**: Click "Sign & Confirm" to add your signature to pending transactions
3. **Auto-Execution**: Transactions are automatically executed when enough signatures are collected

### Transaction History

- **Last Transaction**: View details of the most recently signed transaction
- **Transaction Data**: Includes hash, signature, parameters, and timestamp
- **Clear History**: Option to clear stored transaction data

## 🏗️ Project Structure

```
src/
├── Components/          # React components (currently empty)
├── Contracts/          # Smart contract ABIs and addresses
│   ├── USDC.js        # USDC token contract configuration
│   └── ZUSD.js        # ZUSD token contract configuration
├── Helper/             # Utility functions and helpers
│   ├── ExecuteTX.js   # Transaction execution utilities
│   ├── Sign.js        # Signing utilities
│   ├── SignPendingTransaction.js
│   ├── Testsdk.js     # SDK testing utilities
│   ├── wallet-example.js
│   └── WalletGeneration.js
├── App.jsx            # Main application component
├── main.jsx           # Application entry point
└── index.css          # Global styles
```

## 🔒 Security Considerations

- **Private Keys**: Never share your MetaMask private keys
- **Network Verification**: Always verify you're on the correct network (Sepolia)
- **Transaction Review**: Carefully review all transaction details before signing
- **Multi-Sig Requirements**: Ensure you understand the multi-signature requirements for your Safe

## 🐛 Troubleshooting

### Common Issues

1. **MetaMask Not Detected**
   - Ensure MetaMask is installed and unlocked
   - Refresh the page and try again

2. **Phantom Wallet Conflicts**
   - Disable Phantom wallet for this site
   - Use MetaMask exclusively for Ethereum transactions

3. **Transaction Failures**
   - Check you have sufficient Sepolia ETH for gas
   - Verify the Safe address and network configuration
   - Ensure you're a signer on the Safe wallet

4. **Browser Extension Errors**
   - Try refreshing the page
   - Clear browser cache and cookies
   - Use a different browser if issues persist

### Debug Mode

The application includes comprehensive error handling and logging. Check the browser console for detailed error messages and debugging information.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Useful Links

- [Safe Protocol Documentation](https://docs.safe.global/)
- [MetaMask Documentation](https://docs.metamask.io/)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [Sepolia Testnet Faucet](https://sepoliafaucet.com/)
- [Vite Documentation](https://vitejs.dev/)

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section above
- Review the Safe Protocol documentation

---

**⚠️ Disclaimer**: This application is for testing and development purposes on the Sepolia testnet. Never use it with mainnet funds or production environments without proper security audits.
