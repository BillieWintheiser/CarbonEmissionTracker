// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, euint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

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

    mapping(address => Company) public companies;
    mapping(address => mapping(uint256 => EmissionReport)) public emissionReports;
    mapping(uint256 => PeriodStats) public periodStats;
    mapping(address => bool) public authorizedVerifiers;

    address[] public registeredCompanies;

    event CompanyRegistered(address indexed company, string name);
    event CompanyVerified(address indexed company, address indexed verifier);
    event EmissionReported(address indexed company, uint256 indexed period);
    event ReportVerified(address indexed company, uint256 indexed period, address indexed verifier);
    event PeriodClosed(uint256 indexed period, uint256 participatingCompanies);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);

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

    constructor() {
        owner = msg.sender;
        currentReportingPeriod = 1;
        authorizedVerifiers[msg.sender] = true;
    }

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

    function verifyCompany(address _company) external onlyVerifier {
        require(companies[_company].isRegistered, "Company not registered");
        require(!companies[_company].isVerified, "Company already verified");

        companies[_company].isVerified = true;

        emit CompanyVerified(_company, msg.sender);
    }

    function submitEmissionReport(
        uint32 _directEmissions,
        uint32 _indirectEmissions,
        uint32 _supplyChainEmissions,
        uint64 _energyConsumption
    ) external onlyVerifiedCompany {
        require(!emissionReports[msg.sender][currentReportingPeriod].isSubmitted,
                "Report already submitted for this period");

        // Encrypt sensitive emission data
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

    function verifyEmissionReport(address _company, uint256 _period) external onlyVerifier {
        require(emissionReports[_company][_period].isSubmitted, "No report submitted");
        require(!emissionReports[_company][_period].isVerified, "Report already verified");

        emissionReports[_company][_period].isVerified = true;

        emit ReportVerified(_company, _period, msg.sender);
    }

    function closePeriodAndAdvance() external onlyOwner {
        require(!periodStats[currentReportingPeriod].periodClosed, "Period already closed");

        periodStats[currentReportingPeriod].periodClosed = true;
        periodStats[currentReportingPeriod].closeTime = block.timestamp;

        emit PeriodClosed(currentReportingPeriod, periodStats[currentReportingPeriod].participatingCompanies);

        currentReportingPeriod++;
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

    function grantReportAccess(address _to, uint256 _period) external onlyRegisteredCompany {
        EmissionReport storage report = emissionReports[msg.sender][_period];
        require(report.isSubmitted, "No report to share");

        FHE.allow(report.encryptedDirectEmissions, _to);
        FHE.allow(report.encryptedIndirectEmissions, _to);
        FHE.allow(report.encryptedSupplyChainEmissions, _to);
        FHE.allow(report.encryptedEnergyConsumption, _to);
    }

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

    function calculateEmissionCategory(address _company, uint256 _period) external view returns (string memory) {
        EmissionReport storage report = emissionReports[_company][_period];
        require(report.isSubmitted, "No report submitted");

        // This would need decryption in a real implementation
        // For now, return a placeholder
        return "Category calculation requires decryption";
    }
}