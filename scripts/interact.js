const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Interact with deployed CarbonEmissionTracker contract
 *
 * Usage:
 *   npx hardhat run scripts/interact.js --network sepolia
 */

async function main() {
  console.log("\n🔗 Starting contract interaction...\n");

  // Get network information
  const network = await hre.ethers.provider.getNetwork();
  console.log(`📡 Network: ${network.name} (Chain ID: ${network.chainId})`);

  // Load deployment info
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);

  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ Error: Deployment file not found: ${deploymentFile}`);
    console.error("   Please deploy the contract first using: npx hardhat run scripts/deploy.js --network " + network.name);
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const contractAddress = deploymentInfo.contractAddress;

  console.log(`📍 Contract Address: ${contractAddress}\n`);

  // Get signer
  const [signer] = await hre.ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log(`👤 Signer: ${signerAddress}\n`);

  // Connect to contract
  const CarbonEmissionTracker = await hre.ethers.getContractFactory("CarbonEmissionTracker");
  const contract = CarbonEmissionTracker.attach(contractAddress);

  // Display menu
  console.log("📋 Available Interactions:\n");
  console.log("1️⃣  View Contract Statistics");
  console.log("2️⃣  Register Company");
  console.log("3️⃣  View Company Info");
  console.log("4️⃣  Submit Emission Report");
  console.log("5️⃣  View Report Status");
  console.log("6️⃣  Verify Company (Verifier only)");
  console.log("7️⃣  Verify Report (Verifier only)");
  console.log("8️⃣  View All Companies");
  console.log("9️⃣  Close Current Period (Owner only)");
  console.log("🔟 Pause Contract (Pauser only)");
  console.log("1️⃣1️⃣  Unpause Contract (Owner only)");
  console.log("\n");

  // For this script, we'll execute option 1 (View Statistics) by default
  // You can modify this to accept command-line arguments for other operations

  await viewStatistics(contract);

  console.log("\n✨ Interaction complete!\n");
}

/**
 * View contract statistics
 */
async function viewStatistics(contract) {
  console.log("📊 Contract Statistics:\n");

  try {
    const owner = await contract.owner();
    const totalCompanies = await contract.totalCompanies();
    const currentPeriod = await contract.currentReportingPeriod();
    const isPaused = await contract.isPaused();
    const kmsGeneration = await contract.kmsGeneration();
    const pauserCount = await contract.getPauserCount();

    console.log(`   Owner: ${owner}`);
    console.log(`   Total Companies: ${totalCompanies}`);
    console.log(`   Current Period: ${currentPeriod}`);
    console.log(`   Contract Status: ${isPaused ? "⏸️  Paused" : "▶️  Active"}`);
    console.log(`   KMS Generation: ${kmsGeneration}`);
    console.log(`   Pausers: ${pauserCount}`);

    // Get period stats
    if (currentPeriod > 0) {
      const periodStats = await contract.getPeriodStats(currentPeriod);
      console.log(`\n   Current Period Stats:`);
      console.log(`     Participating Companies: ${periodStats.participatingCompanies}`);
      console.log(`     Total Reports: ${periodStats.totalReports}`);
      console.log(`     Period Closed: ${periodStats.periodClosed ? "Yes" : "No"}`);
    }

  } catch (error) {
    console.error("❌ Error fetching statistics:", error.message);
  }
}

/**
 * Register a company
 */
async function registerCompany(contract, companyName) {
  console.log(`\n📝 Registering company: ${companyName}`);

  try {
    const tx = await contract.registerCompany(companyName);
    console.log(`⏳ Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`✅ Company registered! (Block: ${receipt.blockNumber})`);

    // Get registration event
    const event = receipt.logs.find(log => {
      try {
        return contract.interface.parseLog(log).name === "CompanyRegistered";
      } catch {
        return false;
      }
    });

    if (event) {
      const parsedEvent = contract.interface.parseLog(event);
      console.log(`   Company: ${parsedEvent.args.company}`);
      console.log(`   Name: ${parsedEvent.args.name}`);
    }

  } catch (error) {
    console.error("❌ Registration failed:", error.message);
  }
}

/**
 * View company information
 */
async function viewCompanyInfo(contract, companyAddress) {
  console.log(`\n🏢 Company Information: ${companyAddress}`);

  try {
    const info = await contract.getCompanyInfo(companyAddress);

    console.log(`   Name: ${info.name}`);
    console.log(`   Registered: ${info.isRegistered ? "Yes" : "No"}`);
    console.log(`   Verified: ${info.isVerified ? "✅ Yes" : "⏳ Pending"}`);
    console.log(`   Registration Time: ${new Date(Number(info.registrationTime) * 1000).toLocaleString()}`);

  } catch (error) {
    console.error("❌ Error fetching company info:", error.message);
  }
}

/**
 * Submit emission report
 */
async function submitEmissionReport(contract, directEmissions, indirectEmissions, supplyChainEmissions, energyConsumption) {
  console.log(`\n📊 Submitting Emission Report`);
  console.log(`   Direct Emissions (Scope 1): ${directEmissions} tons CO2`);
  console.log(`   Indirect Emissions (Scope 2): ${indirectEmissions} tons CO2`);
  console.log(`   Supply Chain (Scope 3): ${supplyChainEmissions} tons CO2`);
  console.log(`   Energy Consumption: ${energyConsumption} kWh`);

  try {
    const tx = await contract.submitEmissionReport(
      directEmissions,
      indirectEmissions,
      supplyChainEmissions,
      energyConsumption
    );
    console.log(`⏳ Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`✅ Report submitted! (Block: ${receipt.blockNumber})`);
    console.log(`🔒 All data is now encrypted on-chain using FHE`);

  } catch (error) {
    console.error("❌ Submission failed:", error.message);
  }
}

/**
 * View report status
 */
async function viewReportStatus(contract, companyAddress, period) {
  console.log(`\n📋 Report Status for ${companyAddress} (Period ${period})`);

  try {
    const status = await contract.getReportStatus(companyAddress, period);

    console.log(`   Submitted: ${status.isSubmitted ? "✅ Yes" : "❌ No"}`);
    console.log(`   Verified: ${status.isVerified ? "✅ Yes" : "⏳ Pending"}`);

    if (status.isSubmitted) {
      console.log(`   Timestamp: ${new Date(Number(status.timestamp) * 1000).toLocaleString()}`);
    }

  } catch (error) {
    console.error("❌ Error fetching report status:", error.message);
  }
}

/**
 * Verify a company (verifier only)
 */
async function verifyCompany(contract, companyAddress) {
  console.log(`\n✅ Verifying company: ${companyAddress}`);

  try {
    const tx = await contract.verifyCompany(companyAddress);
    console.log(`⏳ Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`✅ Company verified! (Block: ${receipt.blockNumber})`);

  } catch (error) {
    console.error("❌ Verification failed:", error.message);
  }
}

/**
 * View all registered companies
 */
async function viewAllCompanies(contract) {
  console.log(`\n🏭 Registered Companies:\n`);

  try {
    const companies = await contract.getRegisteredCompanies();

    if (companies.length === 0) {
      console.log("   No companies registered yet.");
      return;
    }

    for (let i = 0; i < companies.length; i++) {
      const address = companies[i];
      const info = await contract.getCompanyInfo(address);

      console.log(`${i + 1}. ${info.name}`);
      console.log(`   Address: ${address}`);
      console.log(`   Status: ${info.isVerified ? "✅ Verified" : "⏳ Pending"}`);
      console.log(`   Registered: ${new Date(Number(info.registrationTime) * 1000).toLocaleString()}`);
      console.log("");
    }

  } catch (error) {
    console.error("❌ Error fetching companies:", error.message);
  }
}

// Execute interaction
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Interaction failed:", error);
    process.exit(1);
  });
