// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, euint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title CarbonEmissionTracker v2.0
 * @notice Migrated to support new Gateway contract specifications
 * @dev Changes:
 * - Added NUM_PAUSERS and PAUSER_ADDRESS_[0-N] support
 * - Renamed kmsManagement to kmsGeneration
 * - Replaced check...() functions with is...() boolean returns
 * - Added new Decryption events with individual KMS responses
 * - Implemented transaction input re-randomization support
 */
contract CarbonEmissionTracker is SepoliaConfig {

    address public owner;
    uint256 public totalCompanies;
    uint256 public currentReportingPeriod;

    // Gateway and KMS Configuration (NEW)
    uint256 public kmsGeneration; // Renamed from kmsManagement
    address[] public pauserAddresses;
    bool public isPaused;
    mapping(address => bool) public isPauserAddress;
    uint256 public decryptionRequestCounter;

    struct Company {
        address wallet;
        string name;
        bool isRegistered;
        bool isVerified;
        uint256 registrationTime;
    }

    struct EmissionReport {
        euint32 encryptedDirectEmissions;     // Scope 1: Direct emissions (tons CO2)
        euint32 encryptedIndirectEmissions;   // Scope 2: Indirect emissions (tons CO2)
        euint32 encryptedSupplyChainEmissions; // Scope 3: Supply chain emissions (tons CO2)
        euint64 encryptedEnergyConsumption;   // Energy consumption (kWh)
        uint256 reportingPeriod;
        uint256 timestamp;
        bool isSubmitted;
        bool isVerified;
    }

    struct PeriodStats {
        uint256 participatingCompanies;
        uint256 totalReports;
        bool periodClosed;
        uint256 closeTime;
    }

    // Decryption Request Struct (NEW)
    struct DecryptionRequest {
        uint256 requestId;
        address requester;
        bytes32 encryptedValue;
        uint256 timestamp;
        bool fulfilled;
        uint256 kmsGeneration;
    }

    mapping(address => Company) public companies;
    mapping(address => mapping(uint256 => EmissionReport)) public emissionReports;
    mapping(uint256 => PeriodStats) public periodStats;
    mapping(address => bool) public authorizedVerifiers;
    mapping(uint256 => DecryptionRequest) public decryptionRequests; // NEW

    address[] public registeredCompanies;

    // Original Events
    event CompanyRegistered(address indexed company, string name);
    event CompanyVerified(address indexed company, address indexed verifier);
    event EmissionReported(address indexed company, uint256 indexed period);
    event ReportVerified(address indexed company, uint256 indexed period, address indexed verifier);
    event PeriodClosed(uint256 indexed period, uint256 participatingCompanies);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);

    // NEW Gateway Events - Individual KMS responses instead of aggregated
    event DecryptionRequested(
        uint256 indexed requestId,
        address indexed requester,
        uint256 kmsGeneration,
        bytes32 encryptedValue,
        uint256 timestamp
    );

    event DecryptionResponse(
        uint256 indexed requestId,
        address indexed kmsNode,
        bytes encryptedShare,
        bytes signature,
        uint256 timestamp
    );

    event PauserAdded(address indexed pauser, uint256 timestamp);
    event PauserRemoved(address indexed pauser, uint256 timestamp);
    event ContractPaused(address indexed by, uint256 timestamp);
    event ContractUnpaused(address indexed by, uint256 timestamp);
    event KmsGenerationUpdated(uint256 oldGeneration, uint256 newGeneration);

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

    constructor(address[] memory _pauserAddresses, uint256 _kmsGeneration) {
        owner = msg.sender;
        currentReportingPeriod = 1;
        totalCompanies = 0;
        authorizedVerifiers[msg.sender] = true;
        kmsGeneration = _kmsGeneration;
        isPaused = false;
        decryptionRequestCounter = 0;

        // Initialize pauser addresses
        for (uint256 i = 0; i < _pauserAddresses.length; i++) {
            pauserAddresses.push(_pauserAddresses[i]);
            isPauserAddress[_pauserAddresses[i]] = true;
            emit PauserAdded(_pauserAddresses[i], block.timestamp);
        }
    }

    // ==================== NEW GATEWAY FUNCTIONS ====================

    /**
     * @notice Add a new pauser address (only owner)
     * @param _pauser The address to add as pauser
     */
    function addPauser(address _pauser) external onlyOwner {
        require(_pauser != address(0), "Invalid pauser address");
        require(!isPauserAddress[_pauser], "Already a pauser");

        pauserAddresses.push(_pauser);
        isPauserAddress[_pauser] = true;
        emit PauserAdded(_pauser, block.timestamp);
    }

    /**
     * @notice Remove a pauser address (only owner)
     * @param _pauser The address to remove
     */
    function removePauser(address _pauser) external onlyOwner {
        require(isPauserAddress[_pauser], "Not a pauser");

        isPauserAddress[_pauser] = false;

        // Remove from array
        for (uint256 i = 0; i < pauserAddresses.length; i++) {
            if (pauserAddresses[i] == _pauser) {
                pauserAddresses[i] = pauserAddresses[pauserAddresses.length - 1];
                pauserAddresses.pop();
                break;
            }
        }

        emit PauserRemoved(_pauser, block.timestamp);
    }

    /**
     * @notice Pause the contract (only pausers)
     */
    function pause() external onlyPauser {
        require(!isPaused, "Already paused");
        isPaused = true;
        emit ContractPaused(msg.sender, block.timestamp);
    }

    /**
     * @notice Unpause the contract (only owner)
     */
    function unpause() external onlyOwner {
        require(isPaused, "Not paused");
        isPaused = false;
        emit ContractUnpaused(msg.sender, block.timestamp);
    }

    /**
     * @notice Update KMS generation number
     * @param _newGeneration New KMS generation
     */
    function updateKmsGeneration(uint256 _newGeneration) external onlyOwner {
        uint256 oldGeneration = kmsGeneration;
        kmsGeneration = _newGeneration;
        emit KmsGenerationUpdated(oldGeneration, _newGeneration);
    }

    /**
     * @notice Request decryption from KMS
     * @param _encryptedValue The encrypted value to decrypt
     * @return requestId The ID of the decryption request
     */
    function requestDecryption(bytes32 _encryptedValue) external onlyRegisteredCompany returns (uint256) {
        uint256 requestId = ++decryptionRequestCounter;

        decryptionRequests[requestId] = DecryptionRequest({
            requestId: requestId,
            requester: msg.sender,
            encryptedValue: _encryptedValue,
            timestamp: block.timestamp,
            fulfilled: false,
            kmsGeneration: kmsGeneration
        });

        emit DecryptionRequested(
            requestId,
            msg.sender,
            kmsGeneration,
            _encryptedValue,
            block.timestamp
        );

        return requestId;
    }

    /**
     * @notice Submit decryption response from KMS node
     * @dev Each KMS node submits its own response separately (not aggregated on-chain)
     */
    function submitDecryptionResponse(
        uint256 _requestId,
        bytes calldata _encryptedShare,
        bytes calldata _signature
    ) external {
        require(decryptionRequests[_requestId].requestId == _requestId, "Invalid request");

        emit DecryptionResponse(
            _requestId,
            msg.sender,
            _encryptedShare,
            _signature,
            block.timestamp
        );
    }

    // ==================== REPLACED check...() WITH is...() ====================

    /**
     * @notice Check if public decryption is allowed (REPLACED checkPublicDecryptAllowed)
     * @return bool True if allowed, false otherwise (no revert)
     */
    function isPublicDecryptAllowed() external view returns (bool) {
        return !isPaused;
    }

    /**
     * @notice Check if address is a valid pauser (NEW)
     * @return bool True if address is pauser
     */
    function isPauser(address _address) external view returns (bool) {
        return isPauserAddress[_address];
    }

    /**
     * @notice Check if contract is currently paused (NEW)
     * @return bool True if paused
     */
    function isContractPaused() external view returns (bool) {
        return isPaused;
    }

    /**
     * @notice Check if period is valid and closed
     * @return bool True if valid
     */
    function isPeriodValid(uint256 _period) external view returns (bool) {
        return _period > 0 && _period < currentReportingPeriod;
    }

    // ==================== ORIGINAL FUNCTIONS (with whenNotPaused) ====================

    /**
     * @notice Register a new company
     */
    function registerCompany(string calldata _name) external whenNotPaused {
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

    /**
     * @notice Verify a company (only authorized verifiers)
     */
    function verifyCompany(address _company) external onlyVerifier whenNotPaused {
        require(companies[_company].isRegistered, "Company not registered");
        require(!companies[_company].isVerified, "Company already verified");

        companies[_company].isVerified = true;

        emit CompanyVerified(_company, msg.sender);
    }

    /**
     * @notice Submit encrypted emission report
     * @dev All transaction inputs are re-randomized before FHE evaluation (automatic)
     */
    function submitEmissionReport(
        uint32 _directEmissions,
        uint32 _indirectEmissions,
        uint32 _supplyChainEmissions,
        uint64 _energyConsumption
    ) external onlyVerifiedCompany whenNotPaused {
        require(!emissionReports[msg.sender][currentReportingPeriod].isSubmitted,
                "Report already submitted for this period");

        // Encrypt sensitive emission data (inputs are re-randomized automatically for sIND-CPAD security)
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

        // Grant access permissions
        FHE.allowThis(encDirectEmissions);
        FHE.allowThis(encIndirectEmissions);
        FHE.allowThis(encSupplyChainEmissions);
        FHE.allowThis(encEnergyConsumption);
        FHE.allow(encDirectEmissions, msg.sender);
        FHE.allow(encIndirectEmissions, msg.sender);
        FHE.allow(encSupplyChainEmissions, msg.sender);
        FHE.allow(encEnergyConsumption, msg.sender);

        // Update period statistics
        if (periodStats[currentReportingPeriod].totalReports == 0) {
            periodStats[currentReportingPeriod].participatingCompanies = 0;
        }
        periodStats[currentReportingPeriod].totalReports++;
        periodStats[currentReportingPeriod].participatingCompanies++;

        emit EmissionReported(msg.sender, currentReportingPeriod);
    }

    /**
     * @notice Verify emission report (only authorized verifiers)
     */
    function verifyEmissionReport(address _company, uint256 _period) external onlyVerifier whenNotPaused {
        require(emissionReports[_company][_period].isSubmitted, "No report submitted");
        require(!emissionReports[_company][_period].isVerified, "Report already verified");

        emissionReports[_company][_period].isVerified = true;

        emit ReportVerified(_company, _period, msg.sender);
    }

    /**
     * @notice Close current period and advance to next
     */
    function closePeriodAndAdvance() external onlyOwner whenNotPaused {
        require(!periodStats[currentReportingPeriod].periodClosed, "Period already closed");

        periodStats[currentReportingPeriod].periodClosed = true;
        periodStats[currentReportingPeriod].closeTime = block.timestamp;

        emit PeriodClosed(currentReportingPeriod, periodStats[currentReportingPeriod].participatingCompanies);

        currentReportingPeriod++;
    }

    /**
     * @notice Add authorized verifier
     */
    function addVerifier(address _verifier) external onlyOwner {
        require(!authorizedVerifiers[_verifier], "Already a verifier");
        authorizedVerifiers[_verifier] = true;
        emit VerifierAdded(_verifier);
    }

    /**
     * @notice Remove authorized verifier
     */
    function removeVerifier(address _verifier) external onlyOwner {
        require(authorizedVerifiers[_verifier], "Not a verifier");
        require(_verifier != owner, "Cannot remove owner");
        authorizedVerifiers[_verifier] = false;
        emit VerifierRemoved(_verifier);
    }

    /**
     * @notice Grant access to emission report data
     */
    function grantReportAccess(address _to, uint256 _period) external onlyRegisteredCompany {
        EmissionReport storage report = emissionReports[msg.sender][_period];
        require(report.isSubmitted, "No report to share");

        FHE.allow(report.encryptedDirectEmissions, _to);
        FHE.allow(report.encryptedIndirectEmissions, _to);
        FHE.allow(report.encryptedSupplyChainEmissions, _to);
        FHE.allow(report.encryptedEnergyConsumption, _to);
    }

    /**
     * @notice Get encrypted emission data for authorized parties
     */
    function getEncryptedEmissions(address _company, uint256 _period) external view returns (
        bytes32 directEmissions,
        bytes32 indirectEmissions,
        bytes32 supplyChainEmissions,
        bytes32 energyConsumption
    ) {
        EmissionReport storage report = emissionReports[_company][_period];
        require(report.isSubmitted, "No report submitted");

        return (
            FHE.toBytes32(report.encryptedDirectEmissions),
            FHE.toBytes32(report.encryptedIndirectEmissions),
            FHE.toBytes32(report.encryptedSupplyChainEmissions),
            FHE.toBytes32(report.encryptedEnergyConsumption)
        );
    }

    // ==================== VIEW FUNCTIONS ====================

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

    function getReportStatus(address _company, uint256 _period) external view returns (
        bool isSubmitted,
        bool isVerified,
        uint256 timestamp
    ) {
        EmissionReport storage report = emissionReports[_company][_period];
        return (
            report.isSubmitted,
            report.isVerified,
            report.timestamp
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

    function getPauserCount() external view returns (uint256) {
        return pauserAddresses.length;
    }

    function getPauserAtIndex(uint256 _index) external view returns (address) {
        require(_index < pauserAddresses.length, "Index out of bounds");
        return pauserAddresses[_index];
    }

    // ==================== ADMIN FUNCTIONS ====================

    function emergencyPause() external onlyPauser {
        isPaused = true;
        emit ContractPaused(msg.sender, block.timestamp);
    }
}
