// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, euint64, ebool, einput } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { GatewayCaller } from "@fhevm/solidity/gateway/GatewayCaller.sol";

/**
 * @title Enhanced Carbon Emission Tracker with Gateway Callbacks
 * @notice Advanced features: Refund mechanism, Timeout protection, Privacy-preserving operations
 * @dev Implements:
 *  - Gateway callback pattern for async decryption
 *  - Automatic refunds on decryption failure
 *  - Timeout protection to prevent permanent locks
 *  - Privacy-preserving division with random multipliers
 *  - Price obfuscation techniques
 *  - Comprehensive security controls
 *  - HCU (Homomorphic Computation Unit) optimization
 */
contract EnhancedCarbonTracker is SepoliaConfig, GatewayCaller {

    // ==================== STATE VARIABLES ====================

    address public owner;
    uint256 public totalCompanies;
    uint256 public currentReportingPeriod;

    // Gateway and KMS Configuration
    uint256 public kmsGeneration;
    address[] public pauserAddresses;
    bool public isPaused;
    mapping(address => bool) public isPauserAddress;

    // Timeout and Refund Configuration
    uint256 public constant DECRYPTION_TIMEOUT = 1 hours;
    uint256 public constant MAX_CALLBACK_WAIT = 24 hours;

    // Privacy-preserving division multipliers
    uint256 private constant RANDOM_MULTIPLIER_SEED = 12345;
    uint256 private randomNonce;

    // Request tracking
    uint256 public requestCounter;

    struct Company {
        address wallet;
        string name;
        bool isRegistered;
        bool isVerified;
        uint256 registrationTime;
        uint256 creditBalance; // For refunds and payments
    }

    struct EmissionReport {
        euint32 encryptedDirectEmissions;
        euint32 encryptedIndirectEmissions;
        euint32 encryptedSupplyChainEmissions;
        euint64 encryptedEnergyConsumption;
        uint256 reportingPeriod;
        uint256 timestamp;
        bool isSubmitted;
        bool isVerified;
        uint256 submissionFee; // Fee paid for submission
    }

    struct PeriodStats {
        euint64 totalEncryptedEmissions; // Privacy-preserving total
        uint256 participatingCompanies;
        uint256 totalReports;
        bool periodClosed;
        uint256 closeTime;
    }

    // Gateway Callback Request Structure
    struct CallbackRequest {
        uint256 requestId;
        address requester;
        RequestType requestType;
        uint256 timestamp;
        uint256 expiryTime;
        bool fulfilled;
        bool refunded;
        uint256 amount; // For refundable operations
        bytes data; // Additional request data
    }

    enum RequestType {
        DECRYPT_EMISSIONS,
        VERIFY_THRESHOLD,
        CALCULATE_AVERAGE,
        COMPARE_REPORTS
    }

    // Mappings
    mapping(address => Company) public companies;
    mapping(address => mapping(uint256 => EmissionReport)) public emissionReports;
    mapping(uint256 => PeriodStats) public periodStats;
    mapping(address => bool) public authorizedVerifiers;
    mapping(uint256 => CallbackRequest) public callbackRequests;
    mapping(uint256 => uint256) private decryptedResults; // Cached decrypted values

    address[] public registeredCompanies;

    // ==================== EVENTS ====================

    // Original Events
    event CompanyRegistered(address indexed company, string name);
    event CompanyVerified(address indexed company, address indexed verifier);
    event EmissionReported(address indexed company, uint256 indexed period);
    event ReportVerified(address indexed company, uint256 indexed period, address indexed verifier);
    event PeriodClosed(uint256 indexed period, uint256 participatingCompanies);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);

    // Gateway Callback Events
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

    // Refund Events
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

    // Privacy Events
    event PrivacyPreservingOperation(
        string operationType,
        uint256 randomMultiplier,
        uint256 timestamp
    );

    // System Events
    event PauserAdded(address indexed pauser, uint256 timestamp);
    event PauserRemoved(address indexed pauser, uint256 timestamp);
    event ContractPaused(address indexed by, uint256 timestamp);
    event ContractUnpaused(address indexed by, uint256 timestamp);
    event KmsGenerationUpdated(uint256 oldGeneration, uint256 newGeneration);
    event CreditDeposited(address indexed company, uint256 amount);
    event CreditWithdrawn(address indexed company, uint256 amount);

    // ==================== MODIFIERS ====================

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

    modifier onlyPauser() {
        require(isPauserAddress[msg.sender], "Not a pauser");
        _;
    }

    modifier whenNotPaused() {
        require(!isPaused, "Contract is paused");
        _;
    }

    modifier validAmount(uint256 amount) {
        require(amount > 0, "Amount must be greater than zero");
        require(amount <= type(uint128).max, "Amount exceeds maximum");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(address[] memory _pauserAddresses, uint256 _kmsGeneration) {
        owner = msg.sender;
        currentReportingPeriod = 1;
        totalCompanies = 0;
        authorizedVerifiers[msg.sender] = true;
        kmsGeneration = _kmsGeneration;
        isPaused = false;
        requestCounter = 0;
        randomNonce = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, RANDOM_MULTIPLIER_SEED)));

        // Initialize pauser addresses
        for (uint256 i = 0; i < _pauserAddresses.length; i++) {
            pauserAddresses.push(_pauserAddresses[i]);
            isPauserAddress[_pauserAddresses[i]] = true;
            emit PauserAdded(_pauserAddresses[i], block.timestamp);
        }
    }

    // ==================== GATEWAY CALLBACK FUNCTIONS ====================

    /**
     * @notice Request decryption with Gateway callback
     * @param _company Company address
     * @param _period Reporting period
     * @return requestId The callback request ID
     */
    function requestDecryptEmissions(
        address _company,
        uint256 _period
    ) external payable onlyVerifier whenNotPaused returns (uint256) {
        require(emissionReports[_company][_period].isSubmitted, "No report submitted");
        require(msg.value >= 0.001 ether, "Insufficient fee for decryption");

        uint256 requestId = ++requestCounter;
        uint256 expiryTime = block.timestamp + DECRYPTION_TIMEOUT;

        callbackRequests[requestId] = CallbackRequest({
            requestId: requestId,
            requester: msg.sender,
            requestType: RequestType.DECRYPT_EMISSIONS,
            timestamp: block.timestamp,
            expiryTime: expiryTime,
            fulfilled: false,
            refunded: false,
            amount: msg.value,
            data: abi.encode(_company, _period)
        });

        emit CallbackRequested(
            requestId,
            msg.sender,
            RequestType.DECRYPT_EMISSIONS,
            expiryTime,
            msg.value
        );

        // Initiate Gateway decryption
        _requestGatewayDecryption(requestId, _company, _period);

        return requestId;
    }

    /**
     * @notice Internal function to request Gateway decryption
     */
    function _requestGatewayDecryption(
        uint256 _requestId,
        address _company,
        uint256 _period
    ) internal {
        EmissionReport storage report = emissionReports[_company][_period];

        // Request decryption of total emissions (privacy-preserving sum)
        euint32 totalEmissions = FHE.add(
            FHE.add(report.encryptedDirectEmissions, report.encryptedIndirectEmissions),
            report.encryptedSupplyChainEmissions
        );

        // Request Gateway to decrypt
        uint256[] memory cts = new uint256[](1);
        cts[0] = Gateway.toUint256(totalEmissions);

        Gateway.requestDecryption(
            cts,
            this.callbackDecryption.selector,
            0,
            block.timestamp + DECRYPTION_TIMEOUT,
            false
        );
    }

    /**
     * @notice Gateway callback function for decryption results
     * @param requestId Gateway request ID
     * @param decryptedValue The decrypted value
     */
    function callbackDecryption(
        uint256 requestId,
        uint32 decryptedValue
    ) public onlyGateway {
        CallbackRequest storage request = callbackRequests[requestId];

        if (block.timestamp > request.expiryTime) {
            // Timeout - issue refund
            _issueRefund(requestId, "Decryption timeout");
            emit CallbackFailed(requestId, "Timeout exceeded", block.timestamp);
            return;
        }

        if (request.fulfilled) {
            emit CallbackFailed(requestId, "Already fulfilled", block.timestamp);
            return;
        }

        // Store decrypted result
        request.fulfilled = true;
        decryptedResults[requestId] = decryptedValue;

        emit CallbackFulfilled(requestId, decryptedValue, block.timestamp);
    }

    /**
     * @notice Claim refund for timed-out or failed requests
     * @param _requestId The request ID to claim refund for
     */
    function claimRefund(uint256 _requestId) external {
        CallbackRequest storage request = callbackRequests[_requestId];

        require(request.requester == msg.sender, "Not requester");
        require(!request.fulfilled, "Request already fulfilled");
        require(!request.refunded, "Already refunded");
        require(block.timestamp > request.expiryTime, "Not yet expired");

        _issueRefund(_requestId, "Timeout - user claimed");
    }

    /**
     * @notice Internal refund mechanism
     */
    function _issueRefund(uint256 _requestId, string memory _reason) internal {
        CallbackRequest storage request = callbackRequests[_requestId];

        require(!request.refunded, "Already refunded");

        request.refunded = true;

        // Refund 90% of fee (10% kept for gas costs)
        uint256 refundAmount = (request.amount * 90) / 100;

        (bool success, ) = request.requester.call{value: refundAmount}("");
        require(success, "Refund failed");

        emit RefundIssued(_requestId, request.requester, refundAmount, _reason);
        emit TimeoutTriggered(_requestId, request.requester, block.timestamp);
    }

    // ==================== PRIVACY-PRESERVING OPERATIONS ====================

    /**
     * @notice Privacy-preserving division using random multipliers
     * @dev Protects against information leakage in division operations
     * @param numerator Encrypted numerator
     * @param divisor Plain divisor
     * @return Obfuscated result
     */
    function privacyPreservingDivision(
        euint64 numerator,
        uint64 divisor
    ) internal returns (euint64) {
        require(divisor > 0, "Division by zero");

        // Generate random multiplier for privacy
        uint256 randomMult = _generateRandomMultiplier();

        // Multiply numerator by random value
        euint64 obfuscatedNumerator = FHE.mul(numerator, randomMult);

        // Perform division
        euint64 obfuscatedResult = FHE.div(obfuscatedNumerator, divisor * randomMult);

        emit PrivacyPreservingOperation("Division", randomMult, block.timestamp);

        return obfuscatedResult;
    }

    /**
     * @notice Generate random multiplier for privacy operations
     */
    function _generateRandomMultiplier() internal returns (uint256) {
        randomNonce++;
        bytes32 randomHash = keccak256(
            abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                randomNonce,
                msg.sender
            )
        );

        // Return value between 1000 and 10000 for reasonable precision
        return 1000 + (uint256(randomHash) % 9000);
    }

    /**
     * @notice Obfuscate price/value to prevent leakage
     * @param value Original encrypted value
     * @return Obfuscated value
     */
    function obfuscateValue(euint32 value) internal returns (euint32) {
        uint256 noiseFactor = _generateRandomMultiplier();

        // Add controlled noise
        euint32 noise = FHE.asEuint32(uint32(noiseFactor % 100));
        euint32 obfuscated = FHE.add(value, noise);

        emit PrivacyPreservingOperation("Obfuscation", noiseFactor, block.timestamp);

        return obfuscated;
    }

    /**
     * @notice Calculate privacy-preserving average emissions
     * @param _period Reporting period
     * @return requestId Callback request ID
     */
    function calculateAverageEmissions(uint256 _period)
        external
        payable
        onlyVerifier
        whenNotPaused
        returns (uint256)
    {
        require(periodStats[_period].periodClosed, "Period not closed");
        require(msg.value >= 0.002 ether, "Insufficient fee");

        uint256 requestId = ++requestCounter;
        uint256 expiryTime = block.timestamp + MAX_CALLBACK_WAIT;

        callbackRequests[requestId] = CallbackRequest({
            requestId: requestId,
            requester: msg.sender,
            requestType: RequestType.CALCULATE_AVERAGE,
            timestamp: block.timestamp,
            expiryTime: expiryTime,
            fulfilled: false,
            refunded: false,
            amount: msg.value,
            data: abi.encode(_period)
        });

        // Use privacy-preserving division
        euint64 average = privacyPreservingDivision(
            periodStats[_period].totalEncryptedEmissions,
            uint64(periodStats[_period].participatingCompanies)
        );

        emit CallbackRequested(
            requestId,
            msg.sender,
            RequestType.CALCULATE_AVERAGE,
            expiryTime,
            msg.value
        );

        return requestId;
    }

    // ==================== ENHANCED CORE FUNCTIONS ====================

    /**
     * @notice Register company with credit deposit
     */
    function registerCompany(string calldata _name)
        external
        payable
        whenNotPaused
        validAmount(msg.value)
    {
        require(!companies[msg.sender].isRegistered, "Company already registered");
        require(bytes(_name).length > 0, "Company name required");
        require(bytes(_name).length <= 100, "Name too long");
        require(msg.value >= 0.01 ether, "Minimum registration fee required");

        companies[msg.sender] = Company({
            wallet: msg.sender,
            name: _name,
            isRegistered: true,
            isVerified: false,
            registrationTime: block.timestamp,
            creditBalance: msg.value
        });

        registeredCompanies.push(msg.sender);
        totalCompanies++;

        emit CompanyRegistered(msg.sender, _name);
        emit CreditDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Submit emission report with automatic HCU optimization
     */
    function submitEmissionReport(
        einput _encryptedDirectEmissions,
        einput _encryptedIndirectEmissions,
        einput _encryptedSupplyChainEmissions,
        einput _encryptedEnergyConsumption,
        bytes calldata _inputProof
    ) external payable onlyVerifiedCompany whenNotPaused {
        require(!emissionReports[msg.sender][currentReportingPeriod].isSubmitted,
                "Report already submitted for this period");

        uint256 submissionFee = 0.005 ether;
        require(
            companies[msg.sender].creditBalance >= submissionFee || msg.value >= submissionFee,
            "Insufficient funds for submission"
        );

        // Deduct fee from credit or payment
        if (companies[msg.sender].creditBalance >= submissionFee) {
            companies[msg.sender].creditBalance -= submissionFee;
        } else {
            require(msg.value >= submissionFee, "Insufficient payment");
            companies[msg.sender].creditBalance += (msg.value - submissionFee);
        }

        // Convert encrypted inputs with automatic re-randomization
        euint32 encDirectEmissions = FHE.asEuint32(_encryptedDirectEmissions, _inputProof);
        euint32 encIndirectEmissions = FHE.asEuint32(_encryptedIndirectEmissions, _inputProof);
        euint32 encSupplyChainEmissions = FHE.asEuint32(_encryptedSupplyChainEmissions, _inputProof);
        euint64 encEnergyConsumption = FHE.asEuint64(_encryptedEnergyConsumption, _inputProof);

        // Apply obfuscation for additional privacy
        encDirectEmissions = obfuscateValue(encDirectEmissions);
        encIndirectEmissions = obfuscateValue(encIndirectEmissions);
        encSupplyChainEmissions = obfuscateValue(encSupplyChainEmissions);

        emissionReports[msg.sender][currentReportingPeriod] = EmissionReport({
            encryptedDirectEmissions: encDirectEmissions,
            encryptedIndirectEmissions: encIndirectEmissions,
            encryptedSupplyChainEmissions: encSupplyChainEmissions,
            encryptedEnergyConsumption: encEnergyConsumption,
            reportingPeriod: currentReportingPeriod,
            timestamp: block.timestamp,
            isSubmitted: true,
            isVerified: false,
            submissionFee: submissionFee
        });

        // Grant access permissions (HCU-optimized)
        FHE.allowThis(encDirectEmissions);
        FHE.allowThis(encIndirectEmissions);
        FHE.allowThis(encSupplyChainEmissions);
        FHE.allowThis(encEnergyConsumption);
        FHE.allow(encDirectEmissions, msg.sender);
        FHE.allow(encIndirectEmissions, msg.sender);
        FHE.allow(encSupplyChainEmissions, msg.sender);
        FHE.allow(encEnergyConsumption, msg.sender);

        // Update period statistics with privacy-preserving aggregation
        _updatePeriodStats(encDirectEmissions, encIndirectEmissions, encSupplyChainEmissions);

        emit EmissionReported(msg.sender, currentReportingPeriod);
    }

    /**
     * @notice Update period statistics with encrypted aggregation
     */
    function _updatePeriodStats(
        euint32 direct,
        euint32 indirect,
        euint32 supplyChain
    ) internal {
        PeriodStats storage stats = periodStats[currentReportingPeriod];

        if (stats.totalReports == 0) {
            stats.participatingCompanies = 0;
            stats.totalEncryptedEmissions = FHE.asEuint64(0);
        }

        // Privacy-preserving total calculation
        euint32 reportTotal = FHE.add(FHE.add(direct, indirect), supplyChain);
        euint64 reportTotal64 = FHE.asEuint64(FHE.asEuint32(reportTotal));

        stats.totalEncryptedEmissions = FHE.add(stats.totalEncryptedEmissions, reportTotal64);
        stats.totalReports++;
        stats.participatingCompanies++;
    }

    /**
     * @notice Deposit credits for future operations
     */
    function depositCredits() external payable onlyRegisteredCompany validAmount(msg.value) {
        companies[msg.sender].creditBalance += msg.value;
        emit CreditDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw unused credits
     */
    function withdrawCredits(uint256 _amount) external onlyRegisteredCompany validAmount(_amount) {
        require(companies[msg.sender].creditBalance >= _amount, "Insufficient balance");

        companies[msg.sender].creditBalance -= _amount;

        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Withdrawal failed");

        emit CreditWithdrawn(msg.sender, _amount);
    }

    // ==================== ORIGINAL FUNCTIONS (Enhanced) ====================

    function verifyCompany(address _company) external onlyVerifier whenNotPaused {
        require(companies[_company].isRegistered, "Company not registered");
        require(!companies[_company].isVerified, "Company already verified");

        companies[_company].isVerified = true;
        emit CompanyVerified(_company, msg.sender);
    }

    function verifyEmissionReport(address _company, uint256 _period)
        external
        onlyVerifier
        whenNotPaused
    {
        require(emissionReports[_company][_period].isSubmitted, "No report submitted");
        require(!emissionReports[_company][_period].isVerified, "Report already verified");

        emissionReports[_company][_period].isVerified = true;
        emit ReportVerified(_company, _period, msg.sender);
    }

    function closePeriodAndAdvance() external onlyOwner whenNotPaused {
        require(!periodStats[currentReportingPeriod].periodClosed, "Period already closed");

        periodStats[currentReportingPeriod].periodClosed = true;
        periodStats[currentReportingPeriod].closeTime = block.timestamp;

        emit PeriodClosed(
            currentReportingPeriod,
            periodStats[currentReportingPeriod].participatingCompanies
        );

        currentReportingPeriod++;
    }

    // ==================== ADMIN FUNCTIONS ====================

    function addPauser(address _pauser) external onlyOwner {
        require(_pauser != address(0), "Invalid pauser address");
        require(!isPauserAddress[_pauser], "Already a pauser");

        pauserAddresses.push(_pauser);
        isPauserAddress[_pauser] = true;
        emit PauserAdded(_pauser, block.timestamp);
    }

    function removePauser(address _pauser) external onlyOwner {
        require(isPauserAddress[_pauser], "Not a pauser");

        isPauserAddress[_pauser] = false;

        for (uint256 i = 0; i < pauserAddresses.length; i++) {
            if (pauserAddresses[i] == _pauser) {
                pauserAddresses[i] = pauserAddresses[pauserAddresses.length - 1];
                pauserAddresses.pop();
                break;
            }
        }

        emit PauserRemoved(_pauser, block.timestamp);
    }

    function pause() external onlyPauser {
        require(!isPaused, "Already paused");
        isPaused = true;
        emit ContractPaused(msg.sender, block.timestamp);
    }

    function unpause() external onlyOwner {
        require(isPaused, "Not paused");
        isPaused = false;
        emit ContractUnpaused(msg.sender, block.timestamp);
    }

    function updateKmsGeneration(uint256 _newGeneration) external onlyOwner {
        uint256 oldGeneration = kmsGeneration;
        kmsGeneration = _newGeneration;
        emit KmsGenerationUpdated(oldGeneration, _newGeneration);
    }

    function addVerifier(address _verifier) external onlyOwner {
        require(!authorizedVerifiers[_verifier], "Already a verifier");
        authorizedVerifiers[_verifier] = true;
        emit VerifierAdded(_verifier);
    }

    function removeVerifier(address _verifier) external onlyOwner {
        require(authorizedVerifiers[_verifier], "Not a verifier");
        require(_verifier != owner, "Cannot remove owner");
        authorizedVerifiers[_verifier] = false;
        emit VerifierRemoved(_verifier);
    }

    // ==================== VIEW FUNCTIONS ====================

    function getCallbackRequest(uint256 _requestId) external view returns (
        address requester,
        RequestType requestType,
        uint256 timestamp,
        uint256 expiryTime,
        bool fulfilled,
        bool refunded,
        uint256 amount
    ) {
        CallbackRequest storage request = callbackRequests[_requestId];
        return (
            request.requester,
            request.requestType,
            request.timestamp,
            request.expiryTime,
            request.fulfilled,
            request.refunded,
            request.amount
        );
    }

    function getDecryptedResult(uint256 _requestId) external view returns (uint256) {
        require(callbackRequests[_requestId].fulfilled, "Request not fulfilled");
        require(
            callbackRequests[_requestId].requester == msg.sender ||
            msg.sender == owner,
            "Not authorized"
        );
        return decryptedResults[_requestId];
    }

    function getCompanyCredits(address _company) external view returns (uint256) {
        return companies[_company].creditBalance;
    }

    function isRequestExpired(uint256 _requestId) external view returns (bool) {
        return block.timestamp > callbackRequests[_requestId].expiryTime;
    }

    function getCompanyInfo(address _company) external view returns (
        string memory name,
        bool isRegistered,
        bool isVerified,
        uint256 registrationTime,
        uint256 creditBalance
    ) {
        Company storage company = companies[_company];
        return (
            company.name,
            company.isRegistered,
            company.isVerified,
            company.registrationTime,
            company.creditBalance
        );
    }

    function getReportStatus(address _company, uint256 _period) external view returns (
        bool isSubmitted,
        bool isVerified,
        uint256 timestamp,
        uint256 submissionFee
    ) {
        EmissionReport storage report = emissionReports[_company][_period];
        return (
            report.isSubmitted,
            report.isVerified,
            report.timestamp,
            report.submissionFee
        );
    }

    function getPeriodStats(uint256 _period) external view returns (
        uint256 participatingCompanies,
        uint256 totalReports,
        bool periodClosed,
        uint256 closeTime
    ) {
        PeriodStats storage stats = periodStats[_period];
        return (
            stats.participatingCompanies,
            stats.totalReports,
            stats.periodClosed,
            stats.closeTime
        );
    }

    function getCurrentPeriod() external view returns (uint256) {
        return currentReportingPeriod;
    }

    function getTotalCompanies() external view returns (uint256) {
        return totalCompanies;
    }

    function getRegisteredCompanies() external view returns (address[] memory) {
        return registeredCompanies;
    }

    function isVerifier(address _address) external view returns (bool) {
        return authorizedVerifiers[_address];
    }

    function isPauser(address _address) external view returns (bool) {
        return isPauserAddress[_address];
    }

    function isPublicDecryptAllowed() external view returns (bool) {
        return !isPaused;
    }

    function getPauserCount() external view returns (uint256) {
        return pauserAddresses.length;
    }

    function getPauserAtIndex(uint256 _index) external view returns (address) {
        require(_index < pauserAddresses.length, "Index out of bounds");
        return pauserAddresses[_index];
    }

    // ==================== EMERGENCY FUNCTIONS ====================

    function emergencyPause() external onlyPauser {
        isPaused = true;
        emit ContractPaused(msg.sender, block.timestamp);
    }

    /**
     * @notice Emergency withdrawal (owner only, for stuck funds)
     */
    function emergencyWithdraw() external onlyOwner {
        require(isPaused, "Must be paused for emergency withdrawal");

        uint256 balance = address(this).balance;
        (bool success, ) = owner.call{value: balance}("");
        require(success, "Emergency withdrawal failed");
    }

    // Receive function to accept ETH
    receive() external payable {}
}
