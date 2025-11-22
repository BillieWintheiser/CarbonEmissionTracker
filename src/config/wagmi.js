import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { sepolia } from 'wagmi/chains';

const zamaSepolia = {
  id: 8009,
  name: 'Zama Sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'ZAMA',
    symbol: 'ZAMA',
  },
  rpcUrls: {
    default: { http: ['https://devnet.zama.ai'] },
    public: { http: ['https://devnet.zama.ai'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.zama.ai' },
  },
  testnet: true,
};

export const config = getDefaultConfig({
  appName: 'Carbon Emission Tracker',
  projectId: 'YOUR_PROJECT_ID',
  chains: [zamaSepolia, sepolia],
  transports: {
    [zamaSepolia.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: false,
});

export const CONTRACT_ADDRESS = "0x80C36125008d8643b8B59c2ddfE3C2E3Ec98a7B2";

export const CONTRACT_ABI = [
  // Core Functions
  "function registerCompany(string calldata _name) external",
  "function verifyCompany(address _company) external",
  "function submitEmissionReport(uint32 _directEmissions, uint32 _indirectEmissions, uint32 _supplyChainEmissions, uint64 _energyConsumption) external",
  "function verifyEmissionReport(address _company, uint256 _period) external",
  "function closePeriodAndAdvance() external",
  "function addVerifier(address _verifier) external",
  "function removeVerifier(address _verifier) external",
  "function grantReportAccess(address _to, uint256 _period) external",

  // Gateway Functions (NEW)
  "function addPauser(address _pauser) external",
  "function removePauser(address _pauser) external",
  "function pause() external",
  "function unpause() external",
  "function updateKmsGeneration(uint256 _newGeneration) external",
  "function requestDecryption(bytes32 _encryptedValue) external returns (uint256)",
  "function submitDecryptionResponse(uint256 _requestId, bytes calldata _encryptedShare, bytes calldata _signature) external",

  // View Functions
  "function getCompanyInfo(address _company) external view returns (string memory name, bool isRegistered, bool isVerified, uint256 registrationTime)",
  "function getReportStatus(address _company, uint256 _period) external view returns (bool isSubmitted, bool isVerified, uint256 timestamp)",
  "function getPeriodStats(uint256 _period) external view returns (uint256 participatingCompanies, uint256 totalReports, bool periodClosed, uint256 closeTime)",
  "function getCurrentPeriod() external view returns (uint256)",
  "function getTotalCompanies() external view returns (uint256)",
  "function getRegisteredCompanies() external view returns (address[] memory)",
  "function isVerifier(address _address) external view returns (bool)",
  "function getEncryptedEmissions(address _company, uint256 _period) external view returns (bytes32 directEmissions, bytes32 indirectEmissions, bytes32 supplyChainEmissions, bytes32 energyConsumption)",

  // Gateway View Functions (NEW)
  "function isPublicDecryptAllowed() external view returns (bool)",
  "function isPauser(address _address) external view returns (bool)",
  "function isContractPaused() external view returns (bool)",
  "function isPeriodValid(uint256 _period) external view returns (bool)",
  "function getPauserCount() external view returns (uint256)",
  "function getPauserAtIndex(uint256 _index) external view returns (address)",

  // Original Events
  "event CompanyRegistered(address indexed company, string name)",
  "event CompanyVerified(address indexed company, address indexed verifier)",
  "event EmissionReported(address indexed company, uint256 indexed period)",
  "event ReportVerified(address indexed company, uint256 indexed period, address indexed verifier)",
  "event PeriodClosed(uint256 indexed period, uint256 participatingCompanies)",
  "event VerifierAdded(address indexed verifier)",
  "event VerifierRemoved(address indexed verifier)",

  // Gateway Events (NEW)
  "event DecryptionRequested(uint256 indexed requestId, address indexed requester, uint256 kmsGeneration, bytes32 encryptedValue, uint256 timestamp)",
  "event DecryptionResponse(uint256 indexed requestId, address indexed kmsNode, bytes encryptedShare, bytes signature, uint256 timestamp)",
  "event PauserAdded(address indexed pauser, uint256 timestamp)",
  "event PauserRemoved(address indexed pauser, uint256 timestamp)",
  "event ContractPaused(address indexed by, uint256 timestamp)",
  "event ContractUnpaused(address indexed by, uint256 timestamp)",
  "event KmsGenerationUpdated(uint256 oldGeneration, uint256 newGeneration)"
];
