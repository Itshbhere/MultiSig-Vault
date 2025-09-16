import React, { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import Safe from '@safe-global/protocol-kit';
import SafeApiKit from '@safe-global/api-kit';
import { OperationType } from '@safe-global/types-kit';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
          <div className="max-w-md p-6 bg-red-900/20 border border-red-700 rounded-lg">
            <h2 className="text-lg font-semibold text-red-300 mb-4">Something went wrong</h2>
            <p className="text-red-200 text-sm mb-4">
              There was an error rendering the application. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all"
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="text-red-300 text-sm cursor-pointer">Error Details (Development)</summary>
                <pre className="text-xs text-red-200 mt-2 overflow-auto">
                  {this.state.error && this.state.error.toString()}
                  <br />
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Import the contract ABIs and addresses
import { Address as USDCAddress, ABI as USDCABI } from "./Contracts/USDC.js";
import { Address as ZUSDAddress, ABI as ZUSDABI } from "./Contracts/ZUSD.js";

function App() {
  const [customData, setCustomData] = useState(false);
  const [selectedToken, setSelectedToken] = useState("USDC");
  const [selectedFunction, setSelectedFunction] = useState("");
  const [functionParams, setFunctionParams] = useState({});
  const [encodedData, setEncodedData] = useState("");
  const [encodedDataHash, setEncodedDataHash] = useState("");
  const [isCreatingTx, setIsCreatingTx] = useState(false);
  const [txStatus, setTxStatus] = useState("");
  const [lastTransaction, setLastTransaction] = useState(null);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [browserExtensionError, setBrowserExtensionError] = useState(null);
  const [signingTransactions, setSigningTransactions] = useState(new Set());

  // Single instances of Safe SDK and API Kit
  const safeSdkRef = useRef(null);
  const apiKitRef = useRef(null);

  // Global error handler for browser extension issues
  useEffect(() => {
    const handleGlobalError = (event) => {
      if (event.error && event.error.message && 
          (event.error.message.includes('translations') || 
           event.error.message.includes('RegisterClientLocalizationsError'))) {
        console.warn('Browser extension localization error caught:', event.error);
        setBrowserExtensionError('Browser extension compatibility issue detected. Please try refreshing the page or using a different browser.');
        event.preventDefault(); // Prevent the error from crashing the app
      }
    };

    const handleUnhandledRejection = (event) => {
      if (event.reason && event.reason.message && 
          (event.reason.message.includes('translations') || 
           event.reason.message.includes('RegisterClientLocalizationsError'))) {
        console.warn('Browser extension localization promise rejection caught:', event.reason);
        setBrowserExtensionError('Browser extension compatibility issue detected. Please try refreshing the page or using a different browser.');
        event.preventDefault(); // Prevent the error from crashing the app
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Initialize Safe SDK and API Kit
  const initializeSafeInstances = async (signerAddress) => {
    debugger;
    const CHAIN_ID = 11155111;
    const SAFE_ADDRESS = '0x023809b6039c7BD5f92350661354b708D37b07ab';
    
    // Add error handling for browser extension issues
    try {
      // Initialize Safe SDK if not already initialized
      if (!safeSdkRef.current) {
        console.log('Initializing Safe SDK...');

        safeSdkRef.current = await Safe.init({
          provider: window.ethereum,
          signer: signerAddress,
          safeAddress: SAFE_ADDRESS,
          contractNetworks: CHAIN_ID
        });
        console.log('Safe SDK initialized successfully');
      }
    } catch (error) {
      // Handle browser extension localization errors
      if (error.message && error.message.includes('translations')) {
        console.warn('Browser extension localization error detected, retrying with fallback...');
        
        // Retry initialization with a small delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          safeSdkRef.current = await Safe.init({
            provider: window.ethereum,
            signer: signerAddress,
            safeAddress: SAFE_ADDRESS,
            contractNetworks: CHAIN_ID
          });
          console.log('Safe SDK initialized successfully on retry');
        } catch (retryError) {
          console.error('Failed to initialize Safe SDK even after retry:', retryError);
          throw new Error(`Safe SDK initialization failed: ${retryError.message}`);
        }
      } else {
        throw error;
      }
    }

    // Initialize Safe API Kit if not already initialized
    if (!apiKitRef.current) {
      console.log('Initializing Safe API Kit...');
      const apiKitConfig = {
        chainId: BigInt(CHAIN_ID)
      };
      
      if (import.meta.env.VITE_SAFE_API_KEY && import.meta.env.VITE_SAFE_API_KEY.trim() !== '') {
        apiKitConfig.apiKey = import.meta.env.VITE_SAFE_API_KEY;
        console.log('Using provided API key');
      } else {
        console.log('No API key provided - using public endpoint');
      }
      
      apiKitRef.current = new SafeApiKit(apiKitConfig);
      console.log('Safe API Kit initialized successfully');
    }

    return { safeSdk: safeSdkRef.current, apiKit: apiKitRef.current };
  };

  // Token configurations
  const tokens = {
    USDC: {
      name: "USDC",
      address: USDCAddress,
      abi: USDCABI,
      get functions() {
        return this.abi
          .filter(item => item.type === "function")
          .map(func => ({
            name: func.name,
            inputs: func.inputs.map(input => `${input.type} ${input.name}`)
          }));
      }
    },
    ZUSD: {
      name: "ZUSD",
      address: ZUSDAddress,
      abi: ZUSDABI,
      get functions() {
        return this.abi
          .filter(item => item.type === "function")
          .map(func => ({
            name: func.name,
            inputs: func.inputs.map(input => `${input.type} ${input.name}`)
          }));
      }
    }
  };

  // Get current token config
  const currentToken = tokens[selectedToken];

  // Handle function selection
  const handleFunctionSelect = (functionName) => {
    setSelectedFunction(functionName);
    setFunctionParams({});
    
    // Initialize parameters with empty values
    const selectedFunc = currentToken.functions.find(f => f.name === functionName);
    if (selectedFunc && selectedFunc.inputs.length > 0) {
      const initialParams = {};
      selectedFunc.inputs.forEach(input => {
        const [type, name] = input.split(" ");
        initialParams[name] = "";
      });
      setFunctionParams(initialParams);
    }
  };

  // Helper function to convert value to 18 decimal places
  const convertTo18Decimals = (value, paramName, paramType) => {
    // Only convert if it's a uint256 parameter and the name suggests it's an amount
    const amountParamNames = ['amount', 'value', 'quantity', 'tokens', 'balance'];
    const isAmountParam = amountParamNames.some(name => 
      paramName.toLowerCase().includes(name)
    );
    
    if (paramType === 'uint256' && isAmountParam && value && value.trim() !== '') {
      try {
        // Check if the value is a valid number
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          return value; // Return original value if not a valid number
        }
        
        // Convert to wei (18 decimals)
        const weiValue = ethers.parseUnits(value.toString(), 18);
        return weiValue.toString();
      } catch (error) {
        console.warn(`Failed to convert ${value} to 18 decimals:`, error);
        return value; // Return original value if conversion fails
      }
    }
    
    return value; // Return original value for non-amount parameters
  };

  // Handle parameter input change
  const handleParamChange = (paramName, value) => {
    // Store the original value that the user typed
    setFunctionParams(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  // Generate encoded data and hash
  const generateEncodedData = () => {
    if (!selectedFunction) return;

    try {
      const iface = new ethers.Interface(currentToken.abi);
      
      // Get function signature
      const functionSignature = `${selectedFunction}(${currentToken.functions.find(f => f.name === selectedFunction).inputs.map(input => input.split(" ")[0]).join(",")})`;
      
      // Get function selector (first 4 bytes)
      const selector = iface.getFunction(selectedFunction).selector;
      
      // Get the selected function details
      const selectedFunc = currentToken.functions.find(f => f.name === selectedFunction);
      
      // Convert parameters to proper format for encoding
      const paramValues = [];
      selectedFunc.inputs.forEach(input => {
        const [type, name] = input.split(" ");
        const originalValue = functionParams[name] || "";
        
        // Convert to 18 decimals if it's an amount parameter
        const convertedValue = convertTo18Decimals(originalValue, name, type);
        paramValues.push(convertedValue);
      });
      
      const encodedParams = iface.encodeFunctionData(selectedFunction, paramValues);
      
      setEncodedData(encodedParams);
      
      // Create hash of the encoded data
      const hash = ethers.keccak256(encodedParams);
      setEncodedDataHash(hash);
      
    } catch (error) {
      console.error("Error encoding data:", error);
      setEncodedData("Error: " + error.message);
      setEncodedDataHash("");
    }
  };

  // Auto-generate encoded data when parameters change
  useEffect(() => {
    if (selectedFunction && Object.keys(functionParams).length > 0) {
      // Only generate if all parameters have values
      const allParamsHaveValues = Object.values(functionParams).every(value => value !== "");
      if (allParamsHaveValues) {
        generateEncodedData();
      }
    }
  }, [selectedFunction, functionParams]);

  // Load last transaction on component mount
  useEffect(() => {
    const savedTransaction = localStorage.getItem('lastSafeTransaction');
    if (savedTransaction) {
      try {
        const parsedTransaction = JSON.parse(savedTransaction);
        // Validate that the parsed transaction is an object and has the expected structure
        if (parsedTransaction && typeof parsedTransaction === 'object') {
          // Ensure all values are strings to prevent rendering issues
          const validatedTransaction = {
            timestamp: String(parsedTransaction.timestamp || ''),
            safeTxHash: String(parsedTransaction.safeTxHash || ''),
            signature: String(parsedTransaction.signature || ''),
            safeAddress: String(parsedTransaction.safeAddress || ''),
            to: String(parsedTransaction.to || ''),
            data: String(parsedTransaction.data || ''),
            function: String(parsedTransaction.function || ''),
            token: String(parsedTransaction.token || ''),
            parameters: parsedTransaction.parameters && typeof parsedTransaction.parameters === 'object' 
              ? Object.fromEntries(
                  Object.entries(parsedTransaction.parameters).map(([key, value]) => [String(key), String(value)])
                )
              : {}
          };
          setLastTransaction(validatedTransaction);
        }
      } catch (error) {
        console.error('Error parsing saved transaction:', error);
        // Clear invalid transaction data
        localStorage.removeItem('lastSafeTransaction');
      }
    }
  }, []);

  // Fetch pending transactions when component mounts
  useEffect(() => {
    fetchPendingTransactions();
  }, []);

  // Check browser compatibility on mount
  useEffect(() => {
    const compatibility = checkBrowserCompatibility();
    if (compatibility.hasKnownIssues) {
      console.warn(`Using ${compatibility.browser} - some extension compatibility issues may occur`);
    }
  }, []);

  // Function to fetch pending transactions
  const fetchPendingTransactions = async () => {
    if (!isMetaMaskAvailable()) return;

    setIsLoadingPending(true);
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const SAFE_ADDRESS = '0x023809b6039c7BD5f92350661354b708D37b07ab';

      // Initialize Safe instances
      const { apiKit } = await initializeSafeInstances(signerAddress);

      // Fetch pending transactions
      const pendingTxs = await apiKit.getPendingTransactions(SAFE_ADDRESS);
      const transactions = pendingTxs.results || [];
      
      // Validate and sanitize transaction data to prevent rendering errors
      const validatedTransactions = transactions.filter(tx => {
        // Ensure tx is an object and not null/undefined
        if (!tx || typeof tx !== 'object') {
          console.warn('Invalid transaction object:', tx);
          return false;
        }
        
        // Ensure all required fields are present and are primitive values
        const requiredFields = ['safeTxHash', 'to', 'value'];
        for (const field of requiredFields) {
          if (tx[field] !== undefined && typeof tx[field] === 'object') {
            console.warn(`Transaction field ${field} is an object, converting to string:`, tx[field]);
            tx[field] = String(tx[field]);
          }
        }
        
        return true;
      });
      
      setPendingTransactions(validatedTransactions);
      
    } catch (error) {
      console.error('Error fetching pending transactions:', error);
      setPendingTransactions([]);
    } finally {
      setIsLoadingPending(false);
    }
  };

  // Function to sign a pending transaction
  const signPendingTransaction = async (pendingTx) => {
    if (!isMetaMaskAvailable()) {
      alert("MetaMask is required to sign transactions");
      return;
    }

    const txHash = pendingTx.safeTxHash || `tx-${Date.now()}`;
    
    // Add transaction to signing set
    setSigningTransactions(prev => new Set([...prev, txHash]));

    try {
      debugger;
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const SAFE_ADDRESS = '0x023809b6039c7BD5f92350661354b708D37b07ab';

      // Initialize Safe instances
      const { safeSdk, apiKit } = await initializeSafeInstances(signerAddress);

      // Sign the transaction
      const signature = await safeSdk.signTransaction(pendingTx);
      const signatureData = signature.signatures.get(signerAddress.toLowerCase()).data;

      // Confirm the transaction
      await apiKit.confirmTransaction(pendingTx.safeTxHash, signatureData);

      console.log('Pending transaction:', pendingTx)

    // Get the number of confirmations
    const confirmationsCount = pendingTx.confirmations ? pendingTx.confirmations.length : 0;
    const requiredConfirmations = pendingTx.confirmationsRequired || 2;

    console.log('Transaction Hash:', pendingTx.safeTxHash);
    console.log('Confirmations count:', confirmationsCount);
    console.log('Required confirmations:', requiredConfirmations);

    const options = {
        from: SAFE_ADDRESS
    }

    if (confirmationsCount >= requiredConfirmations && !pendingTx.isExecuted) {
        console.log('Executing transaction...');
        const Executable = await safeSdk.isValidTransaction(
          pendingTx,
          options
      )
      if (Executable) {
        const txResponse = await safeSdk.executeTransaction(
              pendingTx,
              options
          )
          console.log('Transaction executed:', txResponse)
      }
      else {
        console.log('Transaction is not executable')
      }
    } else if (pendingTx.isExecuted) {
        console.log('Transaction already executed')
    } else {
        console.log(`Transaction needs ${requiredConfirmations - confirmationsCount} more confirmation(s)`)
    }

      alert('Transaction signed and confirmed successfully!');


    } catch (error) {
      console.error('Error signing pending transaction:', error);
      alert(`Error signing transaction: ${error.message}`);
    } finally {
      // Remove transaction from signing set
      setSigningTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(txHash);
        return newSet;
      });
    }
  };

  // Check if MetaMask is available
  const isMetaMaskAvailable = () => {
    return window.ethereum && window.ethereum.isMetaMask === true;
  };

  // Check if Phantom is interfering
  const isPhantomInterfering = () => {
    return window.ethereum && window.ethereum.isPhantom === true;
  };

  // Browser compatibility check
  const checkBrowserCompatibility = () => {
    const userAgent = navigator.userAgent;
    const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(userAgent);
    
    if (isChrome) {
      console.log('Chrome detected - monitoring for extension compatibility issues');
      return { browser: 'Chrome', hasKnownIssues: true };
    } else if (isEdge) {
      console.log('Edge detected - generally more stable with extensions');
      return { browser: 'Edge', hasKnownIssues: false };
    } else {
      console.log('Other browser detected:', navigator.userAgent);
      return { browser: 'Other', hasKnownIssues: false };
    }
  };

  // Clear stored transaction
  const clearStoredTransaction = () => {
    localStorage.removeItem('lastSafeTransaction');
    setLastTransaction(null);
  };

  // Create and sign transaction using Safe SDK
  const createSafeTransaction = async () => {
    const APIKEY = import.meta.env.VITE_SAFE_API_KEY; 
    console.log('Safe API Key:', APIKEY);
    console.log('Environment variables:', import.meta.env);
    
    // Check if API key is available
    if (!import.meta.env.VITE_SAFE_API_KEY) {
      console.warn('VITE_SAFE_API_KEY is not set in environment variables');
      console.log('Available env vars:', Object.keys(import.meta.env));
    }
    
    if (!encodedData || !selectedFunction) {
      alert("Please select a function and ensure encoded data is generated");
      return;
    }

    setIsCreatingTx(true);
    setTxStatus("Connecting to MetaMask...");

    try {
      // Check if MetaMask is available
      if (!isMetaMaskAvailable()) {
        if (isPhantomInterfering()) {
          throw new Error("Phantom wallet detected. Please disable Phantom or switch to MetaMask for Ethereum transactions.");
        }
        throw new Error("MetaMask is not installed. Please install MetaMask extension.");
      }
      
      // Request MetaMask connection specifically
      await window.ethereum.request({ method: "eth_requestAccounts" });

      // Create ethers provider and signer from MetaMask
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      setTxStatus("Connecting to Safe...");

      const SAFE_ADDRESS = '0x023809b6039c7BD5f92350661354b708D37b07ab'; // Your Safe address

      setTxStatus("Initializing Safe SDK...");
      console.log('Signer:', signer);
      console.log('Signer Address:', signerAddress);
      console.log('Provider:', provider);
      console.log('Window Ethereum:', window.ethereum);
      console.log('Safe Address:', SAFE_ADDRESS);

      // Initialize Safe instances
      const { safeSdk, apiKit } = await initializeSafeInstances(signerAddress);
      
      setTxStatus("Creating Safe transaction...");

      // Create a Safe transaction with the encoded data
      const safeTransactionData = {
        to: currentToken.address, // Contract address (ZUSD or USDC)
        value: '0', // No ETH transfer
        data: encodedData, // The encoded function data
        operation: OperationType.Call
      };

      const safeTransaction = await safeSdk.createTransaction({
        transactions: [safeTransactionData],
        options: { onlyCalls: false }
      });

      setTxStatus("Getting transaction hash...");

      // Get the Safe transaction hash
      const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
      console.log('Safe Transaction Hash:', safeTxHash);

      setTxStatus("Signing transaction...");

      // Sign the transaction hash with MetaMask
      const signature = await safeSdk.signTransaction(safeTransaction);
      console.log('Signature:', signature.data);

      setTxStatus("Transaction signed successfully! Proposing to Safe...");

      await apiKit.proposeTransaction({
        safeAddress: SAFE_ADDRESS,
        safeTransactionData: safeTransaction.data,
        safeTxHash,
        senderAddress: await signer.getAddress(),
        senderSignature: signature.signatures.data
      });

      setTxStatus(`Transaction proposed successfully! Hash: ${safeTxHash}, Signature: ${signature.data}`);



      // Store transaction data in localStorage for reference
      const transactionData = {
        timestamp: new Date().toISOString(),
        safeTxHash: String(safeTxHash),
        signature: String(signature.data),
        safeAddress: String(SAFE_ADDRESS),
        to: String(currentToken.address),
        data: String(encodedData),
        function: String(selectedFunction),
        token: String(selectedToken),
        parameters: Object.fromEntries(
          Object.entries(functionParams).map(([key, value]) => [String(key), String(value)])
        )
      };

      localStorage.setItem('lastSafeTransaction', JSON.stringify(transactionData));
      setLastTransaction(transactionData);

      const signatureResponse = await apiKit.confirmTransaction(safeTxHash, signature.signatures.get(signerAddress.toLowerCase()).data)
      console.log('Signature response:', signatureResponse);

    } catch (error) {
      console.error("Error creating Safe transaction:", error);
      setTxStatus(`Error: ${error.message}`);
    } finally {
      setIsCreatingTx(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Browser Extension Error Banner */}
      {browserExtensionError && (
        <div className="bg-yellow-900/20 border-b border-yellow-700 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-yellow-300 text-sm">{browserExtensionError}</span>
            </div>
            <button
              onClick={() => setBrowserExtensionError(null)}
              className="text-yellow-400 hover:text-yellow-300 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold">Safe (WALLET)</h1>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg">Transaction Builder</h2>
              <button className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5z" />
              </svg>
            </button>
            <button className="text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button className="text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h4a1 1 0 011 1v2m-5 0h6m-6 0a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V6a2 2 0 00-2-2" />
              </svg>
            </button>
            <button className="text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
            
            <div className="text-right">
              <div className="text-sm text-gray-300">sep:0x9eCf...77ae</div>
              <div className="text-xs text-gray-400">0.04992 ETH</div>
              <div className="text-xs text-gray-400">Sepolia $0</div>
            </div>
            
            <a href="#" className="text-sm text-green-400 hover:text-green-300">(0) Your transaction library &gt;</a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Panel - Transaction Builder */}
        <div className="flex-1 p-6 border-r border-gray-700 overflow-y-auto">
          {/* Token Selection Section */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Token Selection</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.keys(tokens).map((tokenKey) => (
                <button
                  key={tokenKey}
                  onClick={() => setSelectedToken(tokenKey)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedToken === tokenKey
                      ? "border-green-500 bg-green-500/10"
                      : "border-gray-600 hover:border-gray-500"
                  }`}
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">{tokens[tokenKey].name}</div>
                    <div className="text-sm text-gray-400 mt-1 break-all">
                      {tokens[tokenKey].address}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Function Selection Section */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Function Selection</h3>
            <div className="grid grid-cols-3 gap-3">
              {currentToken.functions.map((func) => (
                <button
                  key={func.name}
                  onClick={() => handleFunctionSelect(func.name)}
                  className={`p-3 rounded-lg border transition-all text-sm ${
                    selectedFunction === func.name
                      ? "border-green-500 bg-green-500/10"
                      : "border-gray-600 hover:border-gray-500"
                  }`}
                >
                  <div className="font-medium">{func.name}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {func.inputs.length > 0 ? `${func.inputs.length} params` : "No params"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Parameter Input Section */}
          {selectedFunction && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Function Parameters</h3>
              <div className="space-y-4">
                {currentToken.functions.find(f => f.name === selectedFunction)?.inputs.map((input, index) => {
                  const [type, name] = input.split(" ");
                  const isAmountParam = ['amount', 'value', 'quantity', 'tokens', 'balance'].some(amountName => 
                    name.toLowerCase().includes(amountName)
                  );
                  const userValue = functionParams[name] || "";
                  const willConvert = type === 'uint256' && isAmountParam && userValue && !isNaN(parseFloat(userValue));
                  const convertedValue = willConvert ? convertTo18Decimals(userValue, name, type) : null;
                  
                  return (
                    <div key={index}>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {name} ({type})
                        {isAmountParam && type === 'uint256' && (
                          <span className="ml-2 text-xs text-blue-400">
                            (Auto-converts to 18 decimals)
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={userValue}
                        onChange={(e) => handleParamChange(name, e.target.value)}
                        className={`w-full px-3 py-2 bg-gray-800 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                          willConvert ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600'
                        }`}
                        placeholder={`Enter ${type} value${isAmountParam && type === 'uint256' ? ' (will be converted to 18 decimals)' : ''}`}
                      />
                      {willConvert && convertedValue && convertedValue !== userValue && (
                        <div className="mt-1 text-xs text-blue-400">
                          ✓ Will encode as: {convertedValue} (18 decimal places)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Encoded Data Section */}
          {encodedData && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Encoded Data</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Encoded Data
                  </label>
                  <div className="p-3 bg-gray-800 border border-gray-600 rounded-md font-mono text-sm break-all">
                    {encodedData}
                  </div>
                </div>
                
                {encodedDataHash && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Data Hash (keccak256)
                    </label>
                    <div className="p-3 bg-gray-800 border border-gray-600 rounded-md font-mono text-sm break-all">
                      {encodedDataHash}
                    </div>
                  </div>
                )}

                {/* Wallet Status Indicator */}
                <div className="pt-4 mb-4">
                  <div className={`p-3 rounded-lg border text-sm ${
                    isMetaMaskAvailable() 
                      ? "bg-green-900/20 border-green-700 text-green-300"
                      : isPhantomInterfering()
                      ? "bg-red-900/20 border-red-700 text-red-300"
                      : "bg-yellow-900/20 border-yellow-700 text-yellow-300"
                  }`}>
                    {isMetaMaskAvailable() 
                      ? "✅ MetaMask detected and ready"
                      : isPhantomInterfering()
                      ? "❌ Phantom detected - Please disable Phantom or switch to MetaMask"
                      : "⚠️ MetaMask not detected - Please install MetaMask extension"
                    }
                    {isPhantomInterfering() && (
                      <div className="mt-2 text-xs">
                        💡 Tip: Right-click Phantom extension → Disable for this site, or switch to MetaMask
                      </div>
                    )}
                  </div>
                </div>

                {/* Generate Encoded Data Button */}
                <div className="pt-4">
                  <button
                    onClick={generateEncodedData}
                    disabled={!selectedFunction || Object.values(functionParams).some(value => value === "")}
                    className={`w-full px-4 py-2 rounded-lg font-medium transition-all mb-3 ${
                      !selectedFunction || Object.values(functionParams).some(value => value === "")
                        ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    Generate Encoded Data
                  </button>

                  {/* Create Transaction Button */}
                  <button
                    onClick={createSafeTransaction}
                    disabled={isCreatingTx || !encodedData || !isMetaMaskAvailable()}
                    className={`w-full px-6 py-3 rounded-lg font-semibold transition-all ${
                      isCreatingTx || !encodedData || !isMetaMaskAvailable()
                        ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  >
                    {isCreatingTx ? "Creating Safe Transaction..." : "Create & Sign Safe Transaction"}
                  </button>
                  
                  {txStatus && (
                    <div className={`mt-3 p-3 rounded-md text-sm ${
                      txStatus.includes("Error") 
                        ? "bg-red-900/20 border border-red-700 text-red-300"
                        : txStatus.includes("successfully") || txStatus.includes("executed")
                        ? "bg-green-900/20 border border-green-700 text-green-300"
                        : "bg-blue-900/20 border border-blue-700 text-blue-300"
                    }`}>
                      {txStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Last Transaction Section */}
          {lastTransaction && typeof lastTransaction === 'object' && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Last Signed Transaction</h3>
                <button
                  onClick={clearStoredTransaction}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Safe Tx Hash:</span>
                    <div className="font-mono text-xs break-all mt-1">{String(lastTransaction.safeTxHash || 'N/A')}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Signature:</span>
                    <div className="font-mono text-xs break-all mt-1">{String(lastTransaction.signature || 'N/A')}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Safe Address:</span>
                    <div className="font-mono text-xs break-all mt-1">{String(lastTransaction.safeAddress || 'N/A')}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Target Contract:</span>
                    <div className="font-mono text-xs break-all mt-1">{String(lastTransaction.to || 'N/A')}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Function:</span>
                    <div className="text-sm mt-1">{String(lastTransaction.function || 'N/A')}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Token:</span>
                    <div className="text-sm mt-1">{String(lastTransaction.token || 'N/A')}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Timestamp:</span>
                    <div className="text-sm mt-1">{lastTransaction.timestamp ? new Date(lastTransaction.timestamp).toLocaleString() : 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Data Length:</span>
                    <div className="text-sm mt-1">{lastTransaction.data ? String(lastTransaction.data).length : 0} chars</div>
                  </div>
                </div>
                {lastTransaction.parameters && Object.keys(lastTransaction.parameters).length > 0 && (
                  <div>
                    <span className="text-gray-400">Parameters:</span>
                    <div className="mt-1">
                      {Object.entries(lastTransaction.parameters).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="text-gray-500">{String(key)}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          


        </div>

        {/* Right Panel - Batch Creation & Pending Transactions */}
        <div className="w-80 p-6 bg-gray-800 overflow-y-auto">
          <div className="text-center mb-6">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto mb-4 relative">
                <div className="absolute inset-0 bg-gray-600 rounded-lg transform rotate-12"></div>
                <div className="absolute inset-0 bg-gray-600 rounded-lg transform -rotate-6 translate-y-1"></div>
                <div className="absolute inset-0 bg-gray-600 rounded-lg transform rotate-3 translate-y-2"></div>
                <div className="absolute top-0 right-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center transform translate-x-1 -translate-y-1">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-200">Start creating a new batch</h3>
            </div>
            
            <div className="text-gray-400 mb-6">or</div>
            
            <div className="border-2 border-dashed border-green-500 rounded-lg p-6 hover:border-green-400 transition-colors cursor-pointer">
              <p className="text-gray-300">
                Drag and drop a JSON file or{" "}
                <span className="text-green-400 font-medium">choose a file</span>
              </p>
            </div>

            {/* Current Selection Summary */}
            {selectedToken && selectedFunction && (
              <div className="mt-6 p-4 bg-gray-700 rounded-lg text-left">
                <h4 className="font-medium text-gray-200 mb-2">Current Selection:</h4>
                <div className="text-sm text-gray-300 space-y-1">
                  <div><span className="text-gray-400">Token:</span> {selectedToken}</div>
                  <div><span className="text-gray-400">Function:</span> {selectedFunction}</div>
                  <div><span className="text-gray-400">Address:</span> {currentToken.address}</div>
                  {encodedData && (
                    <div><span className="text-gray-400">Data Length:</span> {encodedData.length} chars</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pending Transactions Section */}
          <div className="border-t border-gray-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-200">Pending Transactions</h3>
              <button
                onClick={fetchPendingTransactions}
                disabled={isLoadingPending}
                className={`p-2 rounded-lg transition-all ${
                  isLoadingPending
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            
            {isLoadingPending ? (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">Loading...</p>
              </div>
            ) : pendingTransactions.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">No pending transactions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTransactions.map((tx, index) => {
                  // Debug logging to identify problematic objects
                  console.log('Rendering pending transaction:', tx);
                  
                  // Additional validation before rendering
                  if (!tx || typeof tx !== 'object') {
                    console.error('Invalid transaction object at index', index, ':', tx);
                    return null;
                  }
                  
                  // Safely extract and stringify all transaction properties
                  const safeTxHash = tx.safeTxHash ? String(tx.safeTxHash) : 'N/A';
                  const toAddress = tx.to ? String(tx.to) : 'N/A';
                  const value = tx.value ? String(tx.value) : '0';
                  const created = tx.created ? new Date(tx.created).toLocaleString() : 'Unknown';
                  
                  return (
                    <div key={safeTxHash !== 'N/A' ? safeTxHash : `pending-tx-${index}`} className="p-3 bg-gray-700 rounded-lg border border-gray-600">
                      <div className="text-xs text-gray-400 mb-2">Safe Tx Hash:</div>
                      <div className="font-mono text-xs break-all mb-2">{safeTxHash}</div>
                      
                      <div className="text-xs text-gray-400 mb-1">To:</div>
                      <div className="font-mono text-xs break-all mb-2">{toAddress}</div>
                      
                      <div className="text-xs text-gray-400 mb-1">Value:</div>
                      <div className="font-mono text-xs break-all mb-2">{value}</div>
                      
                      <div className="text-xs text-gray-400 mb-1">Created:</div>
                      <div className="text-xs mb-3">{created}</div>
                      
                      <button
                        onClick={() => signPendingTransaction(tx)}
                        disabled={signingTransactions.has(safeTxHash)}
                        className={`w-full px-3 py-1 rounded text-xs font-medium transition-all flex items-center justify-center space-x-2 ${
                          signingTransactions.has(safeTxHash)
                            ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700 text-white"
                        }`}
                      >
                        {signingTransactions.has(safeTxHash) ? (
                          <>
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Processing...</span>
                          </>
                        ) : (
                          <span>Sign & Confirm</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrap App with ErrorBoundary
const AppWithErrorBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

export default AppWithErrorBoundary;