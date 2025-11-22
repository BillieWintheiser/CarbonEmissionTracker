# Enhanced Carbon Tracker - API Documentation

## Table of Contents

1. [Gateway Callback Functions](#gateway-callback-functions)
2. [Core Business Functions](#core-business-functions)
3. [Credit Management](#credit-management)
4. [Administrative Functions](#administrative-functions)
5. [View Functions](#view-functions)
6. [Emergency Functions](#emergency-functions)
7. [Event Reference](#event-reference)
8. [Error Codes](#error-codes)

---

## Gateway Callback Functions

### requestDecryptEmissions

Request Gateway decryption of emission data with automatic refund on timeout.

```solidity
function requestDecryptEmissions(
    address _company,
    uint256 _period
) external payable onlyVerifier whenNotPaused returns (uint256)
```

**Parameters**:
- `_company` (address): Company address to decrypt
- `_period` (uint256): Reporting period

**Returns**:
- `requestId` (uint256): Unique callback request ID

**Requirements**:
- Caller must be authorized verifier
- Report must exist for company/period
- Payment ≥ 0.001 ETH

**Payment**:
- Fee: 0.001 ETH minimum
- Refund: 90% if timeout
- Retention: 10% for gas costs

**Events Emitted**:
- `CallbackRequested(requestId, requester, DECRYPT_EMISSIONS, expiryTime, amount)`

**Example**:
```javascript
// Request decryption
const tx = await contract.requestDecryptEmissions(
    companyAddress,
    1, // period
    { value: ethers.parseEther("0.001") }
);

const receipt = await tx.wait();
const event = receipt.events.find(e => e.event === 'CallbackRequested');
const requestId = event.args.requestId;

// Wait for callback...
// Check result later
const result = await contract.getDecryptedResult(requestId);
```

**Timeout Handling**:
```javascript
// Check if request expired
const isExpired = await contract.isRequestExpired(requestId);

if (isExpired) {
    // Claim refund
    await contract.claimRefund(requestId);
}
```

---

### calculateAverageEmissions

Calculate privacy-preserving average emissions for a closed period.

```solidity
function calculateAverageEmissions(uint256 _period)
    external payable onlyVerifier whenNotPaused returns (uint256)
```

**Parameters**:
- `_period` (uint256): Reporting period (must be closed)

**Returns**:
- `requestId` (uint256): Callback request ID

**Requirements**:
- Period must be closed
- Payment ≥ 0.002 ETH
- Caller must be verifier

**Privacy Features**:
- Uses privacy-preserving division
- Random multiplier obfuscation
- Protects individual company data

**Example**:
```javascript
// Close period first
await contract.closePeriodAndAdvance();

// Calculate average
const tx = await contract.calculateAverageEmissions(
    1, // period
    { value: ethers.parseEther("0.002") }
);

const receipt = await tx.wait();
const requestId = receipt.events[0].args.requestId;
```

---

### claimRefund

Claim refund for timed-out or failed decryption requests.

```solidity
function claimRefund(uint256 _requestId) external
```

**Parameters**:
- `_requestId` (uint256): Request ID to refund

**Requirements**:
- Caller must be original requester
- Request must be expired
- Not already refunded
- Not already fulfilled

**Refund Amount**:
- 90% of original payment
- 10% retained for gas costs

**Events Emitted**:
- `RefundIssued(requestId, recipient, amount, reason)`
- `TimeoutTriggered(requestId, requester, timestamp)`

**Example**:
```javascript
// Check timeout status
const request = await contract.getCallbackRequest(requestId);
const now = Math.floor(Date.now() / 1000);

if (now > request.expiryTime && !request.fulfilled && !request.refunded) {
    // Claim refund
    const tx = await contract.claimRefund(requestId);
    await tx.wait();
    console.log("Refund claimed successfully");
}
```

---

## Core Business Functions

### registerCompany

Register a new company with credit deposit.

```solidity
function registerCompany(string calldata _name)
    external payable whenNotPaused validAmount(msg.value)
```

**Parameters**:
- `_name` (string): Company name (1-100 characters)

**Requirements**:
- Not already registered
- Name not empty, max 100 chars
- Payment ≥ 0.01 ETH (registration fee)
- Contract not paused

**Payment Allocation**:
- Registration fee consumed
- Excess added to credit balance

**Events Emitted**:
- `CompanyRegistered(companyAddress, name)`
- `CreditDeposited(companyAddress, depositAmount)`

**Example**:
```javascript
// Register with 0.1 ETH (0.01 fee + 0.09 credits)
const tx = await contract.registerCompany("GreenTech Industries", {
    value: ethers.parseEther("0.1")
});

await tx.wait();

// Check credit balance
const info = await contract.getCompanyInfo(userAddress);
console.log("Credit balance:", ethers.formatEther(info.creditBalance));
```

---

### submitEmissionReport

Submit encrypted emission report with automatic fee deduction.

```solidity
function submitEmissionReport(
    einput _encryptedDirectEmissions,
    einput _encryptedIndirectEmissions,
    einput _encryptedSupplyChainEmissions,
    einput _encryptedEnergyConsumption,
    bytes calldata _inputProof
) external payable onlyVerifiedCompany whenNotPaused
```

**Parameters**:
- `_encryptedDirectEmissions` (einput): Encrypted Scope 1 emissions
- `_encryptedIndirectEmissions` (einput): Encrypted Scope 2 emissions
- `_encryptedSupplyChainEmissions` (einput): Encrypted Scope 3 emissions
- `_encryptedEnergyConsumption` (einput): Encrypted energy usage (kWh)
- `_inputProof` (bytes): FHE input proof

**Requirements**:
- Company must be verified
- Not already submitted for current period
- Credit balance ≥ 0.005 ETH OR payment ≥ 0.005 ETH
- Contract not paused

**Fee Handling**:
1. Check credit balance
2. Deduct from credits if available
3. Otherwise require payment
4. Excess payment added to credits

**Privacy Features**:
- Automatic input re-randomization
- Value obfuscation applied
- Encrypted aggregation in period stats

**Events Emitted**:
- `EmissionReported(companyAddress, period)`

**Example**:
```javascript
// Create encrypted inputs
const input = await fhevm.createEncryptedInput(contractAddress, userAddress);
input.add32(1000);  // Direct emissions
input.add32(500);   // Indirect emissions
input.add32(2000);  // Supply chain emissions
input.add64(50000); // Energy consumption

const encryptedInput = await input.encrypt();

// Submit report (uses credit balance)
const tx = await contract.submitEmissionReport(
    encryptedInput.handles[0],
    encryptedInput.handles[1],
    encryptedInput.handles[2],
    encryptedInput.handles[3],
    encryptedInput.inputProof
);

await tx.wait();
```

**With Payment (if insufficient credits)**:
```javascript
const tx = await contract.submitEmissionReport(
    /* ... encrypted inputs ... */
    { value: ethers.parseEther("0.005") }
);
```

---

### verifyCompany

Verify a registered company (verifiers only).

```solidity
function verifyCompany(address _company)
    external onlyVerifier whenNotPaused
```

**Parameters**:
- `_company` (address): Company address to verify

**Requirements**:
- Caller is authorized verifier
- Company is registered
- Company not already verified

**Events Emitted**:
- `CompanyVerified(companyAddress, verifierAddress)`

**Example**:
```javascript
await contract.verifyCompany(companyAddress);
```

---

### verifyEmissionReport

Verify a submitted emission report (verifiers only).

```solidity
function verifyEmissionReport(address _company, uint256 _period)
    external onlyVerifier whenNotPaused
```

**Parameters**:
- `_company` (address): Company address
- `_period` (uint256): Reporting period

**Requirements**:
- Report exists for company/period
- Report not already verified
- Caller is authorized verifier

**Events Emitted**:
- `ReportVerified(companyAddress, period, verifierAddress)`

**Example**:
```javascript
await contract.verifyEmissionReport(companyAddress, 1);
```

---

### closePeriodAndAdvance

Close current reporting period and advance to next (owner only).

```solidity
function closePeriodAndAdvance() external onlyOwner whenNotPaused
```

**Requirements**:
- Caller is owner
- Current period not already closed

**Effects**:
- Marks current period as closed
- Records close timestamp
- Increments period counter
- Locks period statistics

**Events Emitted**:
- `PeriodClosed(period, participatingCompanies)`

**Example**:
```javascript
// Close current period
await contract.closePeriodAndAdvance();

// Check new period
const currentPeriod = await contract.getCurrentPeriod();
console.log("Current period:", currentPeriod); // Now period 2
```

---

## Credit Management

### depositCredits

Deposit credits for future operations.

```solidity
function depositCredits()
    external payable onlyRegisteredCompany validAmount(msg.value)
```

**Requirements**:
- Caller is registered company
- Payment > 0 and ≤ type(uint128).max

**Events Emitted**:
- `CreditDeposited(companyAddress, amount)`

**Example**:
```javascript
// Deposit 1 ETH
await contract.depositCredits({
    value: ethers.parseEther("1.0")
});

// Check balance
const balance = await contract.getCompanyCredits(userAddress);
console.log("Balance:", ethers.formatEther(balance));
```

---

### withdrawCredits

Withdraw unused credits.

```solidity
function withdrawCredits(uint256 _amount)
    external onlyRegisteredCompany validAmount(_amount)
```

**Parameters**:
- `_amount` (uint256): Amount to withdraw (wei)

**Requirements**:
- Caller is registered company
- Sufficient credit balance
- Amount > 0

**Events Emitted**:
- `CreditWithdrawn(companyAddress, amount)`

**Example**:
```javascript
// Withdraw 0.5 ETH
await contract.withdrawCredits(ethers.parseEther("0.5"));
```

---

## Administrative Functions

### addVerifier

Add authorized verifier (owner only).

```solidity
function addVerifier(address _verifier) external onlyOwner
```

**Parameters**:
- `_verifier` (address): Address to add as verifier

**Requirements**:
- Not already a verifier

**Events Emitted**:
- `VerifierAdded(verifierAddress)`

**Example**:
```javascript
await contract.addVerifier(verifierAddress);
```

---

### removeVerifier

Remove authorized verifier (owner only).

```solidity
function removeVerifier(address _verifier) external onlyOwner
```

**Parameters**:
- `_verifier` (address): Verifier to remove

**Requirements**:
- Currently a verifier
- Cannot remove owner

**Events Emitted**:
- `VerifierRemoved(verifierAddress)`

**Example**:
```javascript
await contract.removeVerifier(verifierAddress);
```

---

### addPauser

Add authorized pauser (owner only).

```solidity
function addPauser(address _pauser) external onlyOwner
```

**Parameters**:
- `_pauser` (address): Address to add as pauser

**Requirements**:
- Not zero address
- Not already a pauser

**Events Emitted**:
- `PauserAdded(pauserAddress, timestamp)`

**Example**:
```javascript
await contract.addPauser(pauserAddress);
```

---

### removePauser

Remove authorized pauser (owner only).

```solidity
function removePauser(address _pauser) external onlyOwner
```

**Parameters**:
- `_pauser` (address): Pauser to remove

**Requirements**:
- Currently a pauser

**Events Emitted**:
- `PauserRemoved(pauserAddress, timestamp)`

---

### updateKmsGeneration

Update KMS generation number (owner only).

```solidity
function updateKmsGeneration(uint256 _newGeneration) external onlyOwner
```

**Parameters**:
- `_newGeneration` (uint256): New KMS generation

**Events Emitted**:
- `KmsGenerationUpdated(oldGeneration, newGeneration)`

**Example**:
```javascript
await contract.updateKmsGeneration(2);
```

---

## View Functions

### getCallbackRequest

Get callback request details.

```solidity
function getCallbackRequest(uint256 _requestId) external view returns (
    address requester,
    RequestType requestType,
    uint256 timestamp,
    uint256 expiryTime,
    bool fulfilled,
    bool refunded,
    uint256 amount
)
```

**Parameters**:
- `_requestId` (uint256): Request ID

**Returns**:
```javascript
{
    requester: "0x...",
    requestType: 0, // 0=DECRYPT_EMISSIONS, 1=VERIFY_THRESHOLD, etc.
    timestamp: 1234567890,
    expiryTime: 1234571490, // timestamp + 1 hour
    fulfilled: false,
    refunded: false,
    amount: "1000000000000000" // wei
}
```

**Example**:
```javascript
const request = await contract.getCallbackRequest(requestId);
console.log("Request type:", request.requestType);
console.log("Expires at:", new Date(request.expiryTime * 1000));
```

---

### getDecryptedResult

Get decrypted result from fulfilled callback.

```solidity
function getDecryptedResult(uint256 _requestId) external view returns (uint256)
```

**Parameters**:
- `_requestId` (uint256): Request ID

**Returns**:
- `result` (uint256): Decrypted value

**Requirements**:
- Request must be fulfilled
- Caller is requester or owner

**Example**:
```javascript
try {
    const result = await contract.getDecryptedResult(requestId);
    console.log("Decrypted emissions:", result);
} catch (error) {
    console.log("Not yet fulfilled or not authorized");
}
```

---

### getCompanyCredits

Get company's credit balance.

```solidity
function getCompanyCredits(address _company) external view returns (uint256)
```

**Parameters**:
- `_company` (address): Company address

**Returns**:
- `balance` (uint256): Credit balance in wei

**Example**:
```javascript
const balance = await contract.getCompanyCredits(userAddress);
console.log("Credits:", ethers.formatEther(balance), "ETH");
```

---

### isRequestExpired

Check if callback request has expired.

```solidity
function isRequestExpired(uint256 _requestId) external view returns (bool)
```

**Parameters**:
- `_requestId` (uint256): Request ID

**Returns**:
- `expired` (bool): True if expired

**Example**:
```javascript
const expired = await contract.isRequestExpired(requestId);
if (expired) {
    console.log("Request timed out - can claim refund");
}
```

---

### getCompanyInfo

Get comprehensive company information.

```solidity
function getCompanyInfo(address _company) external view returns (
    string memory name,
    bool isRegistered,
    bool isVerified,
    uint256 registrationTime,
    uint256 creditBalance
)
```

**Parameters**:
- `_company` (address): Company address

**Returns**:
```javascript
{
    name: "GreenTech Industries",
    isRegistered: true,
    isVerified: true,
    registrationTime: 1234567890,
    creditBalance: "100000000000000000" // 0.1 ETH
}
```

**Example**:
```javascript
const info = await contract.getCompanyInfo(companyAddress);
console.log(`${info.name} - Verified: ${info.isVerified}`);
console.log(`Credits: ${ethers.formatEther(info.creditBalance)} ETH`);
```

---

### getReportStatus

Get emission report status.

```solidity
function getReportStatus(address _company, uint256 _period) external view returns (
    bool isSubmitted,
    bool isVerified,
    uint256 timestamp,
    uint256 submissionFee
)
```

**Parameters**:
- `_company` (address): Company address
- `_period` (uint256): Reporting period

**Returns**:
```javascript
{
    isSubmitted: true,
    isVerified: false,
    timestamp: 1234567890,
    submissionFee: "5000000000000000" // 0.005 ETH
}
```

---

### getPeriodStats

Get reporting period statistics.

```solidity
function getPeriodStats(uint256 _period) external view returns (
    uint256 participatingCompanies,
    uint256 totalReports,
    bool periodClosed,
    uint256 closeTime
)
```

**Parameters**:
- `_period` (uint256): Period number

**Returns**:
```javascript
{
    participatingCompanies: 25,
    totalReports: 25,
    periodClosed: true,
    closeTime: 1234567890
}
```

---

### Additional View Functions

```solidity
// Get current reporting period
function getCurrentPeriod() external view returns (uint256)

// Get total registered companies
function getTotalCompanies() external view returns (uint256)

// Get all registered company addresses
function getRegisteredCompanies() external view returns (address[] memory)

// Check if address is verifier
function isVerifier(address _address) external view returns (bool)

// Check if address is pauser
function isPauser(address _address) external view returns (bool)

// Check if public decryption allowed
function isPublicDecryptAllowed() external view returns (bool)

// Get number of pausers
function getPauserCount() external view returns (uint256)

// Get pauser at index
function getPauserAtIndex(uint256 _index) external view returns (address)
```

---

## Emergency Functions

### pause

Pause contract (pausers only).

```solidity
function pause() external onlyPauser
```

**Effects**:
- Blocks all state-changing functions with `whenNotPaused`
- Allows: View functions, unpause, refund claims

**Events Emitted**:
- `ContractPaused(pauserAddress, timestamp)`

---

### unpause

Unpause contract (owner only).

```solidity
function unpause() external onlyOwner
```

**Requirements**:
- Contract currently paused

**Events Emitted**:
- `ContractUnpaused(ownerAddress, timestamp)`

---

### emergencyPause

Emergency pause (pausers only).

```solidity
function emergencyPause() external onlyPauser
```

**Same as `pause()` but emphasizes emergency nature.**

---

### emergencyWithdraw

Emergency withdrawal of stuck funds (owner only).

```solidity
function emergencyWithdraw() external onlyOwner
```

**Requirements**:
- Contract must be paused
- Only callable by owner

**Use Case**:
- Recovery of stuck funds in exceptional circumstances
- Should only be used after thorough investigation

---

## Event Reference

### Callback Events

```solidity
event CallbackRequested(
    uint256 indexed requestId,
    address indexed requester,
    RequestType requestType,
    uint256 expiryTime,
    uint256 amount
);

event CallbackFulfilled(
    uint256 indexed requestId,
    uint256 result,
    uint256 timestamp
);

event CallbackFailed(
    uint256 indexed requestId,
    string reason,
    uint256 timestamp
);
```

### Refund Events

```solidity
event RefundIssued(
    uint256 indexed requestId,
    address indexed recipient,
    uint256 amount,
    string reason
);

event TimeoutTriggered(
    uint256 indexed requestId,
    address indexed requester,
    uint256 timestamp
);
```

### Privacy Events

```solidity
event PrivacyPreservingOperation(
    string operationType,
    uint256 randomMultiplier,
    uint256 timestamp
);
```

### Credit Events

```solidity
event CreditDeposited(address indexed company, uint256 amount);
event CreditWithdrawn(address indexed company, uint256 amount);
```

---

## Error Codes

### Access Control

| Error | Meaning |
|-------|---------|
| "Not authorized" | Caller not owner |
| "Not authorized verifier" | Caller not verifier |
| "Not a pauser" | Caller not authorized pauser |
| "Company not registered" | Company must register first |
| "Company not verified" | Company must be verified |

### Registration

| Error | Meaning |
|-------|---------|
| "Company already registered" | Cannot register twice |
| "Company name required" | Name cannot be empty |
| "Name too long" | Name exceeds 100 characters |
| "Minimum registration fee required" | Payment < 0.01 ETH |

### Reports

| Error | Meaning |
|-------|---------|
| "Report already submitted for this period" | One report per period |
| "No report submitted" | Report doesn't exist |
| "Report already verified" | Cannot verify twice |
| "Insufficient funds for submission" | Need 0.005 ETH |

### Callbacks

| Error | Meaning |
|-------|---------|
| "Not requester" | Only requester can claim |
| "Request already fulfilled" | Callback already processed |
| "Not yet expired" | Cannot refund before timeout |
| "Already refunded" | Cannot refund twice |
| "Invalid request" | Request ID doesn't exist |

### Credits

| Error | Meaning |
|-------|---------|
| "Insufficient balance" | Credit balance too low |
| "Amount must be greater than zero" | Cannot use zero amount |
| "Amount exceeds maximum" | Amount > uint128 max |

### System

| Error | Meaning |
|-------|---------|
| "Contract is paused" | Operations blocked during pause |
| "Already paused" | Contract already paused |
| "Not paused" | Cannot unpause if not paused |
| "Period already closed" | Cannot close twice |
| "Invalid pauser address" | Zero address not allowed |

---

## Usage Examples

### Complete Flow Example

```javascript
// 1. Register company
const registerTx = await contract.registerCompany("GreenTech Industries", {
    value: ethers.parseEther("0.1") // 0.01 fee + 0.09 credits
});
await registerTx.wait();

// 2. Owner verifies company
await contract.verifyCompany(companyAddress);

// 3. Submit emission report
const input = await fhevm.createEncryptedInput(contractAddress, companyAddress);
input.add32(1000).add32(500).add32(2000).add64(50000);
const encrypted = await input.encrypt();

const submitTx = await contract.submitEmissionReport(
    encrypted.handles[0],
    encrypted.handles[1],
    encrypted.handles[2],
    encrypted.handles[3],
    encrypted.inputProof
);
await submitTx.wait();

// 4. Verifier requests decryption
const decryptTx = await contract.requestDecryptEmissions(
    companyAddress,
    1,
    { value: ethers.parseEther("0.001") }
);
const receipt = await decryptTx.wait();
const requestId = receipt.events[0].args.requestId;

// 5. Wait for callback (or handle timeout)
setTimeout(async () => {
    try {
        const result = await contract.getDecryptedResult(requestId);
        console.log("Total emissions:", result);
    } catch {
        // Check if expired
        const expired = await contract.isRequestExpired(requestId);
        if (expired) {
            await contract.claimRefund(requestId);
        }
    }
}, 30000); // Check after 30 seconds
```

---

**API Version**: 2.0
**Last Updated**: 2024
**Status**: ✅ Production Ready
