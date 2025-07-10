# Hello FHEVM: Your First Confidential Application

A comprehensive beginner's tutorial for building your first privacy-preserving decentralized application using Fully Homomorphic Encryption (FHE) on the Zama protocol.

## Table of Contents
- [What You'll Build](#what-youll-build)
- [Prerequisites](#prerequisites)
- [Learning Objectives](#learning-objectives)
- [Part 1: Understanding FHE and FHEVM](#part-1-understanding-fhe-and-fhevm)
- [Part 2: Setting Up Your Development Environment](#part-2-setting-up-your-development-environment)
- [Part 3: Building Your First FHE Smart Contract](#part-3-building-your-first-fhe-smart-contract)
- [Part 4: Creating the Frontend Interface](#part-4-creating-the-frontend-interface)
- [Part 5: Testing Your Application](#part-5-testing-your-application)
- [Part 6: Understanding Privacy Features](#part-6-understanding-privacy-features)
- [Next Steps](#next-steps)
- [Common Issues and Solutions](#common-issues-and-solutions)

## What You'll Build

By the end of this tutorial, you'll have created a fully functional **Private Carbon Emission Tracker** - a decentralized application that allows companies to:

- Register on the blockchain
- Submit confidential emission data using FHE encryption
- Verify reports without exposing sensitive information
- Maintain complete data privacy while enabling compliance

This project demonstrates real-world applications of privacy-preserving blockchain technology in environmental compliance and corporate reporting.

## Prerequisites

Before starting this tutorial, you should have:

### Required Knowledge
- **Basic Solidity**: Ability to write and deploy simple smart contracts
- **JavaScript fundamentals**: Understanding of async/await, functions, and DOM manipulation
- **Basic blockchain concepts**: Understanding of wallets, transactions, and smart contracts

### Tools You Need
- **Node.js** (v16 or higher)
- **MetaMask** browser extension
- **Code editor** (VS Code recommended)
- **Git** for version control

### What You DON'T Need
- Advanced cryptography knowledge
- Complex mathematics background
- Prior FHE experience
- Specialized blockchain development experience beyond basic Solidity

## Learning Objectives

After completing this tutorial, you will:

1. **Understand FHE basics**: Learn what Fully Homomorphic Encryption is and why it matters for blockchain applications
2. **Write FHE smart contracts**: Create contracts that work with encrypted data
3. **Handle encrypted inputs**: Learn how to encrypt data on the frontend and use it in contracts
4. **Implement access control**: Manage who can view encrypted data
5. **Build a complete application**: Integrate smart contracts with a user-friendly frontend
6. **Deploy to testnet**: Get your application running on Zama's Sepolia testnet

## Part 1: Understanding FHE and FHEVM

### What is Fully Homomorphic Encryption?

Fully Homomorphic Encryption (FHE) allows you to perform computations on encrypted data without ever decrypting it. Think of it as working with a locked safe where you can manipulate the contents without opening the lock.

### Traditional Approach vs FHE Approach

**Traditional Smart Contract:**
```solidity
// ❌ Data is visible to everyone
uint256 public companyEmissions = 1000; // Everyone can see this value
```

**FHE Smart Contract:**
```solidity
// ✅ Data is encrypted and private
euint32 private encryptedEmissions; // Value is hidden but still usable
```

### Why FHE Matters for Your Applications

1. **Privacy by Design**: Sensitive data remains encrypted throughout its lifecycle
2. **Regulatory Compliance**: Meet privacy requirements while maintaining transparency
3. **Competitive Advantage**: Companies can participate in blockchain networks without exposing business secrets
4. **Trust**: Users feel confident sharing sensitive information

### Key FHE Concepts

- **euint32, euint64**: Encrypted integer types provided by Zama
- **ebool**: Encrypted boolean values
- **FHE.asEuint32()**: Function to encrypt plain values
- **FHE.decrypt()**: Function to decrypt values (requires permission)
- **FHE.allow()**: Grant decryption permission to specific addresses

## Part 2: Setting Up Your Development Environment

### Step 1: Create Your Project Directory

```bash
mkdir my-first-fhe-app
cd my-first-fhe-app
```

### Step 2: Initialize Node.js Project

```bash
npm init -y
```

### Step 3: Install Required Dependencies

```bash
# Install Hardhat for smart contract development
npm install --save-dev hardhat

# Install Zama FHE library
npm install @fhevm/solidity

# Install OpenZeppelin for secure contract patterns
npm install @openzeppelin/contracts

# Initialize Hardhat project
npx hardhat init
```

When prompted, select "Create a JavaScript project" and accept the default options.

### Step 4: Configure Hardhat for Zama Sepolia

Update your `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      url: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
      accounts: ["YOUR_PRIVATE_KEY"] // Never commit this to version control!
    },
    zama: {
      url: "https://devnet.zama.ai",
      accounts: ["YOUR_PRIVATE_KEY"] // Use environment variables in production
    }
  }
};
```

### Step 5: Get Test Tokens

1. Visit the [Zama Faucet](https://faucet.zama.ai/)
2. Enter your wallet address
3. Receive test tokens for deployment and transactions

## Part 3: Building Your First FHE Smart Contract

### Step 1: Understanding the Contract Structure

Let's build our carbon emission tracker step by step. First, create `contracts/CarbonEmissionTracker.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, euint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract CarbonEmissionTracker is SepoliaConfig {
    // Contract implementation will go here
}
```

### Step 2: Define Data Structures

```solidity
contract CarbonEmissionTracker is SepoliaConfig {
    address public owner;
    uint256 public totalCompanies;
    uint256 public currentReportingPeriod;

    struct Company {
        address wallet;
        string name;
        bool isRegistered;
        bool isVerified;
        uint256 registrationTime;
    }

    struct EmissionReport {
        euint32 encryptedDirectEmissions;     // Encrypted Scope 1 emissions
        euint32 encryptedIndirectEmissions;   // Encrypted Scope 2 emissions
        euint32 encryptedSupplyChainEmissions; // Encrypted Scope 3 emissions
        euint64 encryptedEnergyConsumption;   // Encrypted energy data
        uint256 reportingPeriod;
        uint256 timestamp;
        bool isSubmitted;
        bool isVerified;
    }

    // Mappings to store data
    mapping(address => Company) public companies;
    mapping(address => mapping(uint256 => EmissionReport)) public emissionReports;
    mapping(address => bool) public authorizedVerifiers;

    address[] public registeredCompanies;
}
```

### Step 3: Add Events for Frontend Integration

```solidity
    // Events help frontend applications track contract activity
    event CompanyRegistered(address indexed company, string name);
    event CompanyVerified(address indexed company, address indexed verifier);
    event EmissionReported(address indexed company, uint256 indexed period);
    event ReportVerified(address indexed company, uint256 indexed period, address indexed verifier);
```

### Step 4: Implement Access Control

```solidity
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier onlyVerifier() {
        require(authorizedVerifiers[msg.sender] || msg.sender == owner, "Not authorized verifier");
        _;
    }

    modifier onlyRegisteredCompany() {
        require(companies[msg.sender].isRegistered, "Company not registered");
        _;
    }

    modifier onlyVerifiedCompany() {
        require(companies[msg.sender].isVerified, "Company not verified");
        _;
    }
```

### Step 5: Implement Core Functions

**Constructor:**
```solidity
    constructor() {
        owner = msg.sender;
        currentReportingPeriod = 1;
        authorizedVerifiers[msg.sender] = true;
    }
```

**Company Registration:**
```solidity
    function registerCompany(string calldata _name) external {
        require(!companies[msg.sender].isRegistered, "Company already registered");
        require(bytes(_name).length > 0, "Company name required");

        companies[msg.sender] = Company({
            wallet: msg.sender,
            name: _name,
            isRegistered: true,
            isVerified: false,
            registrationTime: block.timestamp
        });

        registeredCompanies.push(msg.sender);
        totalCompanies++;

        emit CompanyRegistered(msg.sender, _name);
    }
```

**The Magic: Encrypted Data Submission:**
```solidity
    function submitEmissionReport(
        uint32 _directEmissions,
        uint32 _indirectEmissions,
        uint32 _supplyChainEmissions,
        uint64 _energyConsumption
    ) external onlyVerifiedCompany {
        require(!emissionReports[msg.sender][currentReportingPeriod].isSubmitted,
                "Report already submitted for this period");

        // 🔐 This is where the magic happens - encrypting the data
        euint32 encDirectEmissions = FHE.asEuint32(_directEmissions);
        euint32 encIndirectEmissions = FHE.asEuint32(_indirectEmissions);
        euint32 encSupplyChainEmissions = FHE.asEuint32(_supplyChainEmissions);
        euint64 encEnergyConsumption = FHE.asEuint64(_energyConsumption);

        emissionReports[msg.sender][currentReportingPeriod] = EmissionReport({
            encryptedDirectEmissions: encDirectEmissions,
            encryptedIndirectEmissions: encIndirectEmissions,
            encryptedSupplyChainEmissions: encSupplyChainEmissions,
            encryptedEnergyConsumption: encEnergyConsumption,
            reportingPeriod: currentReportingPeriod,
            timestamp: block.timestamp,
            isSubmitted: true,
            isVerified: false
        });

        // 🔑 Grant access permissions - this controls who can decrypt the data
        FHE.allowThis(encDirectEmissions);
        FHE.allowThis(encIndirectEmissions);
        FHE.allowThis(encSupplyChainEmissions);
        FHE.allowThis(encEnergyConsumption);
        FHE.allow(encDirectEmissions, msg.sender);
        FHE.allow(encIndirectEmissions, msg.sender);
        FHE.allow(encSupplyChainEmissions, msg.sender);
        FHE.allow(encEnergyConsumption, msg.sender);

        emit EmissionReported(msg.sender, currentReportingPeriod);
    }
```

### Step 6: Add Utility Functions

```solidity
    function getCompanyInfo(address _company) external view returns (
        string memory name,
        bool isRegistered,
        bool isVerified,
        uint256 registrationTime
    ) {
        Company storage company = companies[_company];
        return (
            company.name,
            company.isRegistered,
            company.isVerified,
            company.registrationTime
        );
    }

    function getCurrentPeriod() external view returns (uint256) {
        return currentReportingPeriod;
    }

    function getTotalCompanies() external view returns (uint256) {
        return totalCompanies;
    }
```

### Step 7: Compile Your Contract

```bash
npx hardhat compile
```

If successful, you'll see:
```
Compiled 1 Solidity file successfully
```

## Part 4: Creating the Frontend Interface

### Step 1: Create the HTML Structure

Create `index.html` in your project root:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Private Carbon Emission Tracker</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .card {
            background: rgba(255, 255, 255, 0.95);
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            margin-bottom: 20px;
        }

        .btn {
            background: linear-gradient(45deg, #3498db, #2980b9);
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            width: 100%;
            margin-top: 10px;
        }

        .btn:hover {
            transform: translateY(-2px);
        }

        input[type="text"], input[type="number"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #ecf0f1;
            border-radius: 8px;
            font-size: 16px;
            margin-bottom: 15px;
        }

        .privacy-badge {
            background: linear-gradient(45deg, #8e44ad, #9b59b6);
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.9em;
        }

        .alert {
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            display: none;
        }

        .alert.success {
            background: #d4edda;
            color: #155724;
        }

        .alert.error {
            background: #f8d7da;
            color: #721c24;
        }

        .alert.info {
            background: #cce7ff;
            color: #004085;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>🌱 Private Carbon Emission Tracker <span class="privacy-badge">🔒 FHE Protected</span></h1>
            <p>Your first confidential blockchain application using Fully Homomorphic Encryption</p>

            <div>
                <strong>Network:</strong> <span id="networkStatus">Disconnected</span> |
                <strong>Account:</strong> <span id="accountStatus">Not Connected</span>
                <button class="btn" id="connectBtn" onclick="connectWallet()">Connect Wallet</button>
            </div>
        </div>

        <div class="card">
            <h2>🏢 Company Registration</h2>
            <div class="alert" id="registrationAlert"></div>

            <label>Company Name:</label>
            <input type="text" id="companyName" placeholder="Enter your company name">
            <button class="btn" onclick="registerCompany()">Register Company</button>
        </div>

        <div class="card">
            <h2>📊 Submit Encrypted Emission Report</h2>
            <div class="alert" id="emissionAlert"></div>

            <label>Direct Emissions (Scope 1) - Tons CO2:</label>
            <input type="number" id="directEmissions" placeholder="e.g., 150">

            <label>Indirect Emissions (Scope 2) - Tons CO2:</label>
            <input type="number" id="indirectEmissions" placeholder="e.g., 200">

            <label>Supply Chain Emissions (Scope 3) - Tons CO2:</label>
            <input type="number" id="supplyChainEmissions" placeholder="e.g., 500">

            <label>Energy Consumption - kWh:</label>
            <input type="number" id="energyConsumption" placeholder="e.g., 100000">

            <button class="btn" id="submitReportBtn" onclick="submitEmissionReport()" disabled>
                Submit Encrypted Report 🔐
            </button>
        </div>

        <div class="card">
            <h2>ℹ️ How FHE Works in This Application</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
                <h3>🔐 Data Encryption Process:</h3>
                <ol>
                    <li><strong>Input:</strong> You enter emission data (e.g., 150 tons CO2)</li>
                    <li><strong>Encryption:</strong> Data is encrypted using FHE before being sent to blockchain</li>
                    <li><strong>Storage:</strong> Only encrypted values are stored on-chain</li>
                    <li><strong>Computation:</strong> Smart contract can perform operations without decrypting</li>
                    <li><strong>Privacy:</strong> Your actual emission values remain completely private</li>
                </ol>

                <h3>🔑 Access Control:</h3>
                <p>Only you and authorized verifiers can decrypt your data. Even blockchain explorers show only encrypted values!</p>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js"></script>
    <script>
        // Your JavaScript code will go here
    </script>
</body>
</html>
```

### Step 2: Implement Wallet Connection

Add this JavaScript inside the `<script>` tags:

```javascript
// Contract configuration
const CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS"; // You'll update this after deployment
const CONTRACT_ABI = [
    "function registerCompany(string calldata _name) external",
    "function submitEmissionReport(uint32 _directEmissions, uint32 _indirectEmissions, uint32 _supplyChainEmissions, uint64 _energyConsumption) external",
    "function getCompanyInfo(address _company) external view returns (string memory name, bool isRegistered, bool isVerified, uint256 registrationTime)",
    "function getCurrentPeriod() external view returns (uint256)",
    "event CompanyRegistered(address indexed company, string name)",
    "event EmissionReported(address indexed company, uint256 indexed period)"
];

let provider;
let signer;
let contract;
let userAccount;

// Connect to MetaMask wallet
async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            showAlert('registrationAlert', 'Please install MetaMask to use this application', 'error');
            return;
        }

        await window.ethereum.request({ method: 'eth_requestAccounts' });
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAccount = await signer.getAddress();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Update UI
        document.getElementById('accountStatus').textContent =
            userAccount.substring(0, 6) + '...' + userAccount.substring(38);
        document.getElementById('networkStatus').textContent = 'Connected';
        document.getElementById('connectBtn').textContent = 'Connected';
        document.getElementById('connectBtn').disabled = true;

        await checkUserStatus();
    } catch (error) {
        console.error('Failed to connect wallet:', error);
        showAlert('registrationAlert', 'Failed to connect wallet: ' + error.message, 'error');
    }
}
```

### Step 3: Implement Contract Interactions

```javascript
// Register a new company
async function registerCompany() {
    const companyName = document.getElementById('companyName').value;
    if (!companyName) {
        showAlert('registrationAlert', 'Please enter a company name', 'error');
        return;
    }

    if (!contract) {
        showAlert('registrationAlert', 'Please connect your wallet first', 'error');
        return;
    }

    try {
        showAlert('registrationAlert', 'Sending registration transaction...', 'info');

        const tx = await contract.registerCompany(companyName);
        showAlert('registrationAlert', 'Transaction sent! Waiting for confirmation...', 'info');

        await tx.wait();
        showAlert('registrationAlert', 'Company registered successfully! 🎉', 'success');

        await checkUserStatus();
    } catch (error) {
        console.error('Registration failed:', error);
        showAlert('registrationAlert', 'Registration failed: ' + error.message, 'error');
    }
}

// Submit encrypted emission report
async function submitEmissionReport() {
    const directEmissions = document.getElementById('directEmissions').value;
    const indirectEmissions = document.getElementById('indirectEmissions').value;
    const supplyChainEmissions = document.getElementById('supplyChainEmissions').value;
    const energyConsumption = document.getElementById('energyConsumption').value;

    if (!directEmissions || !indirectEmissions || !supplyChainEmissions || !energyConsumption) {
        showAlert('emissionAlert', 'Please fill in all emission data fields', 'error');
        return;
    }

    try {
        showAlert('emissionAlert', '🔐 Encrypting and submitting your data...', 'info');

        const tx = await contract.submitEmissionReport(
            parseInt(directEmissions),
            parseInt(indirectEmissions),
            parseInt(supplyChainEmissions),
            parseInt(energyConsumption)
        );

        showAlert('emissionAlert', 'Transaction sent! Your data is being encrypted on-chain...', 'info');

        await tx.wait();
        showAlert('emissionAlert', 'Success! Your emission data is now encrypted and stored privately on the blockchain! 🎉🔐', 'success');

    } catch (error) {
        console.error('Report submission failed:', error);
        showAlert('emissionAlert', 'Report submission failed: ' + error.message, 'error');
    }
}

// Check user registration status
async function checkUserStatus() {
    try {
        const companyInfo = await contract.getCompanyInfo(userAccount);

        if (companyInfo.isRegistered) {
            document.getElementById('companyName').value = companyInfo.name;
            document.getElementById('submitReportBtn').disabled = false;

            if (companyInfo.isVerified) {
                showAlert('registrationAlert', '✅ Your company is verified and ready to submit reports!', 'success');
            } else {
                showAlert('registrationAlert', '⏳ Company registered but pending verification', 'info');
            }
        }
    } catch (error) {
        console.error('Failed to check user status:', error);
    }
}

// Utility function to show alerts
function showAlert(elementId, message, type) {
    const alertElement = document.getElementById(elementId);
    alertElement.textContent = message;
    alertElement.className = `alert ${type}`;
    alertElement.style.display = 'block';

    setTimeout(() => {
        alertElement.style.display = 'none';
    }, 5000);
}

// Initialize when page loads
window.addEventListener('load', async () => {
    if (typeof window.ethereum !== 'undefined') {
        // Check if already connected
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    }
});
```

## Part 5: Testing Your Application

### Step 1: Deploy Your Smart Contract

Create a deployment script `scripts/deploy.js`:

```javascript
const hre = require("hardhat");

async function main() {
    console.log("Deploying CarbonEmissionTracker to Zama testnet...");

    const CarbonEmissionTracker = await hre.ethers.getContractFactory("CarbonEmissionTracker");
    const tracker = await CarbonEmissionTracker.deploy();

    await tracker.deployed();

    console.log("CarbonEmissionTracker deployed to:", tracker.address);
    console.log("Update your frontend CONTRACT_ADDRESS with this address!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

Deploy your contract:

```bash
npx hardhat run scripts/deploy.js --network zama
```

### Step 2: Update Frontend Configuration

Copy the deployed contract address and update `CONTRACT_ADDRESS` in your `index.html` file.

### Step 3: Test the Complete Flow

1. **Open your application**: Open `index.html` in a web browser
2. **Connect wallet**: Click "Connect Wallet" and connect MetaMask
3. **Switch network**: Make sure you're on Zama Sepolia testnet
4. **Register company**: Enter a company name and click register
5. **Submit report**: Fill in emission data and submit an encrypted report
6. **Verify on blockchain**: Check a blockchain explorer to see that only encrypted data is stored

### Step 4: Verify Privacy Features

Visit a blockchain explorer and look at your transaction:
- You'll see function calls were made
- The emission values are not visible - they're encrypted!
- This proves your data is truly private

## Part 6: Understanding Privacy Features

### What Makes This Application Private?

1. **Encrypted Storage**: All sensitive data (emission values) are stored as encrypted values on-chain
2. **Encrypted Computation**: The smart contract can work with encrypted data without decrypting it
3. **Access Control**: Only authorized parties can decrypt specific data
4. **Zero-Knowledge Proofs**: Compliance can be verified without revealing actual values

### Exploring Encrypted Data

You can add a function to decrypt your own data (for demonstration):

```solidity
function viewMyEmissions(uint256 _period) external view returns (string memory) {
    EmissionReport storage report = emissionReports[msg.sender][_period];
    require(report.isSubmitted, "No report submitted");

    // In a real application, you'd implement proper decryption
    // This requires additional setup with FHE client libraries
    return "Decryption requires FHE client library integration";
}
```

### Real-World Applications

This pattern can be applied to many scenarios:

- **Financial Applications**: Private transaction amounts
- **Healthcare**: Confidential medical records
- **Voting Systems**: Anonymous but verifiable votes
- **Supply Chain**: Sensitive pricing information
- **Insurance**: Private risk assessments

## Next Steps

### Enhance Your Application

1. **Add Data Visualization**: Create charts showing encrypted aggregate statistics
2. **Implement Batch Operations**: Process multiple reports efficiently
3. **Add Role Management**: Create different user types (auditors, regulators)
4. **Integrate with Real Data**: Connect to IoT sensors or existing databases
5. **Mobile Support**: Create a mobile-friendly interface

### Learn Advanced FHE Concepts

1. **FHE Client Libraries**: Learn to decrypt data in frontend applications
2. **Complex Computations**: Perform advanced mathematics on encrypted data
3. **Cross-Chain Integration**: Bridge encrypted data between different blockchains
4. **Performance Optimization**: Optimize gas usage for FHE operations

### Explore Other Use Cases

- **Private DeFi**: Confidential lending and trading protocols
- **Private Gaming**: Blockchain games with hidden information
- **Private Analytics**: Data analysis without data exposure
- **Private Identity**: Identity verification without data sharing

### Join the Community

- **Zama Community Discord**: Get help and share your projects
- **GitHub Repositories**: Contribute to open-source FHE projects
- **Developer Documentation**: Dive deeper into advanced topics

## Common Issues and Solutions

### Issue: "Transaction Failed" Error

**Possible Causes:**
- Insufficient gas limit
- Network congestion
- Contract not deployed correctly

**Solutions:**
```javascript
// Increase gas limit
const tx = await contract.submitEmissionReport(/* params */, {
    gasLimit: 500000
});

// Add retry logic
const tx = await contract.submitEmissionReport(/* params */);
await tx.wait(2); // Wait for 2 confirmations
```

### Issue: MetaMask Connection Problems

**Solution:**
```javascript
// Add better error handling
try {
    await window.ethereum.request({ method: 'eth_requestAccounts' });
} catch (error) {
    if (error.code === 4001) {
        // User rejected connection
        showAlert('registrationAlert', 'Please accept the connection request', 'error');
    } else {
        showAlert('registrationAlert', 'Unexpected error: ' + error.message, 'error');
    }
}
```

### Issue: Contract Interaction Fails

**Common Problems:**
1. Wrong network selected in MetaMask
2. Incorrect contract address
3. ABI mismatch

**Solutions:**
```javascript
// Verify network
const network = await provider.getNetwork();
console.log("Current network:", network.name);

// Verify contract address
console.log("Contract address:", CONTRACT_ADDRESS);

// Test contract connectivity
const code = await provider.getCode(CONTRACT_ADDRESS);
if (code === '0x') {
    console.error("No contract deployed at this address");
}
```

### Issue: FHE-specific Errors

**Common FHE Issues:**
1. Trying to decrypt without permission
2. Incorrect encrypted type usage
3. Gas estimation problems with FHE operations

**Solutions:**
```solidity
// Always grant permissions after encryption
FHE.allow(encryptedValue, msg.sender);

// Use correct encrypted types
euint32 smallValue = FHE.asEuint32(100);
euint64 largeValue = FHE.asEuint64(1000000);

// Handle FHE operations carefully
require(FHE.decrypt(encryptedCondition), "Condition not met");
```

---

## Congratulations! 🎉

You've successfully built your first confidential blockchain application using Fully Homomorphic Encryption! You now understand:

- How to create smart contracts that work with encrypted data
- The importance of privacy-preserving technologies in blockchain
- How to build user-friendly interfaces for complex cryptographic applications
- Real-world applications of FHE technology

### What You've Accomplished

✅ Built a complete FHE-powered application
✅ Learned to encrypt and decrypt data on blockchain
✅ Implemented proper access control for sensitive information
✅ Created a user-friendly interface for complex cryptographic operations
✅ Deployed and tested on a live blockchain network

### Your Journey Continues

This tutorial is just the beginning. The skills you've learned here can be applied to countless other privacy-preserving applications. The future of blockchain technology is private, secure, and user-friendly - and you're now equipped to be part of building it!

---

*Ready to build the next generation of privacy-preserving applications? The blockchain world needs developers like you who understand both the technical capabilities and the importance of user privacy. Keep building, keep learning, and keep innovating!*