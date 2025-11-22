const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Simulate complete workflow of CarbonEmissionTracker
 * This script demonstrates the entire lifecycle of the platform
 *
 * Usage:
 *   npx hardhat run scripts/simulate.js --network sepolia
 *   npx hardhat run scripts/simulate.js --network localhost
 */

async function main() {
  console.log("\n🎬 Starting CarbonEmissionTracker Simulation...\n");

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

  // Get signers (simulate different participants)
  const [owner, company1, company2, company3, verifier] = await hre.ethers.getSigners();

  console.log("👥 Simulation Participants:");
  console.log(`   Owner: ${await owner.getAddress()}`);
  console.log(`   Company 1: ${await company1.getAddress()}`);
  console.log(`   Company 2: ${await company2.getAddress()}`);
  console.log(`   Company 3: ${await company3.getAddress()}`);
  console.log(`   Verifier: ${await verifier.getAddress()}\n`);

  // Connect to contract
  const CarbonEmissionTracker = await hre.ethers.getContractFactory("CarbonEmissionTracker");
  const contract = CarbonEmissionTracker.attach(contractAddress);

  // ==================== PHASE 1: SETUP ====================
  console.log("=" .repeat(60));
  console.log("PHASE 1: INITIAL SETUP");
  console.log("=" .repeat(60) + "\n");

  // Add verifier
  await step("Adding authorized verifier", async () => {
    const tx = await contract.connect(owner).addVerifier(await verifier.getAddress());
    await tx.wait();
    console.log(`   ✅ Verifier added: ${await verifier.getAddress()}`);
  });

  await displayStats(contract);

  // ==================== PHASE 2: COMPANY REGISTRATION ====================
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 2: COMPANY REGISTRATION");
  console.log("=" .repeat(60) + "\n");

  const companies = [
    { signer: company1, name: "GreenTech Industries" },
    { signer: company2, name: "EcoManufacturing Corp" },
    { signer: company3, name: "Sustainable Solutions Ltd" },
  ];

  for (const company of companies) {
    await step(`Registering ${company.name}`, async () => {
      const tx = await contract.connect(company.signer).registerCompany(company.name);
      const receipt = await tx.wait();

      // Find the event
      const event = receipt.logs.find(log => {
        try {
          return contract.interface.parseLog(log).name === "CompanyRegistered";
        } catch {
          return false;
        }
      });

      if (event) {
        const parsedEvent = contract.interface.parseLog(event);
        console.log(`   ✅ Registered: ${parsedEvent.args.name}`);
        console.log(`   📍 Address: ${parsedEvent.args.company}`);
      }
    });

    await sleep(1000); // Small delay between registrations
  }

  await displayStats(contract);

  // ==================== PHASE 3: VERIFICATION ====================
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 3: COMPANY VERIFICATION");
  console.log("=" .repeat(60) + "\n");

  for (const company of companies) {
    await step(`Verifying ${company.name}`, async () => {
      const companyAddress = await company.signer.getAddress();
      const tx = await contract.connect(verifier).verifyCompany(companyAddress);
      await tx.wait();
      console.log(`   ✅ Verified: ${company.name}`);
    });

    await sleep(1000);
  }

  await displayStats(contract);

  // ==================== PHASE 4: EMISSION REPORTING ====================
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 4: EMISSION REPORTING");
  console.log("=" .repeat(60) + "\n");

  const emissionData = [
    {
      company: companies[0],
      data: {
        direct: 1250,        // tons CO2
        indirect: 850,       // tons CO2
        supplyChain: 3200,   // tons CO2
        energy: 450000,      // kWh
      },
    },
    {
      company: companies[1],
      data: {
        direct: 2100,
        indirect: 1200,
        supplyChain: 4500,
        energy: 720000,
      },
    },
    {
      company: companies[2],
      data: {
        direct: 950,
        indirect: 600,
        supplyChain: 2800,
        energy: 380000,
      },
    },
  ];

  for (const entry of emissionData) {
    await step(`${entry.company.name} submitting emission report`, async () => {
      const tx = await contract.connect(entry.company.signer).submitEmissionReport(
        entry.data.direct,
        entry.data.indirect,
        entry.data.supplyChain,
        entry.data.energy
      );
      const receipt = await tx.wait();

      console.log(`   📊 Report Details:`);
      console.log(`      Direct Emissions: ${entry.data.direct} tons CO2`);
      console.log(`      Indirect Emissions: ${entry.data.indirect} tons CO2`);
      console.log(`      Supply Chain: ${entry.data.supplyChain} tons CO2`);
      console.log(`      Energy: ${entry.data.energy} kWh`);
      console.log(`   🔒 All data encrypted using FHE`);
      console.log(`   ✅ Submitted (Block: ${receipt.blockNumber})`);
    });

    await sleep(1000);
  }

  await displayStats(contract);

  // ==================== PHASE 5: REPORT VERIFICATION ====================
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 5: REPORT VERIFICATION");
  console.log("=" .repeat(60) + "\n");

  const currentPeriod = await contract.currentReportingPeriod();

  for (const company of companies) {
    await step(`Verifying ${company.name}'s emission report`, async () => {
      const companyAddress = await company.signer.getAddress();
      const tx = await contract.connect(verifier).verifyEmissionReport(
        companyAddress,
        currentPeriod
      );
      await tx.wait();
      console.log(`   ✅ Report verified for ${company.name}`);
    });

    await sleep(1000);
  }

  await displayStats(contract);

  // ==================== PHASE 6: PERIOD MANAGEMENT ====================
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 6: PERIOD MANAGEMENT");
  console.log("=" .repeat(60) + "\n");

  await step("Closing current reporting period", async () => {
    const tx = await contract.connect(owner).closePeriodAndAdvance();
    const receipt = await tx.wait();

    const event = receipt.logs.find(log => {
      try {
        return contract.interface.parseLog(log).name === "PeriodClosed";
      } catch {
        return false;
      }
    });

    if (event) {
      const parsedEvent = contract.interface.parseLog(event);
      console.log(`   ✅ Period ${parsedEvent.args.period} closed`);
      console.log(`   📊 Participating Companies: ${parsedEvent.args.participatingCompanies}`);
    }
  });

  await displayStats(contract);

  // ==================== PHASE 7: GATEWAY FEATURES ====================
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 7: GATEWAY FEATURES (Pause/Unpause)");
  console.log("=" .repeat(60) + "\n");

  await step("Testing pause functionality", async () => {
    // Get first pauser
    const pauser = await contract.getPauserAtIndex(0);
    console.log(`   🔐 Pauser: ${pauser}`);

    // Get pauser signer (assuming it's the owner)
    const pauserSigner = owner;

    // Pause contract
    const pauseTx = await contract.connect(pauserSigner).pause();
    await pauseTx.wait();
    console.log(`   ⏸️  Contract paused`);

    const isPaused = await contract.isPaused();
    console.log(`   📊 Status: ${isPaused ? "Paused" : "Active"}`);
  });

  await sleep(1000);

  await step("Testing unpause functionality", async () => {
    const unpauseTx = await contract.connect(owner).unpause();
    await unpauseTx.wait();
    console.log(`   ▶️  Contract unpaused`);

    const isPaused = await contract.isPaused();
    console.log(`   📊 Status: ${isPaused ? "Paused" : "Active"}`);
  });

  // ==================== SIMULATION COMPLETE ====================
  console.log("\n" + "=".repeat(60));
  console.log("SIMULATION COMPLETE");
  console.log("=" .repeat(60) + "\n");

  await displayFinalStats(contract, companies);

  console.log("\n✨ Simulation completed successfully!\n");
}

/**
 * Display current contract statistics
 */
async function displayStats(contract) {
  console.log("\n📊 Current Statistics:");

  const totalCompanies = await contract.totalCompanies();
  const currentPeriod = await contract.currentReportingPeriod();
  const isPaused = await contract.isPaused();

  console.log(`   Total Companies: ${totalCompanies}`);
  console.log(`   Current Period: ${currentPeriod}`);
  console.log(`   Contract Status: ${isPaused ? "⏸️  Paused" : "▶️  Active"}`);

  if (currentPeriod > 0) {
    const periodStats = await contract.getPeriodStats(currentPeriod);
    console.log(`   Period ${currentPeriod} - Participating: ${periodStats.participatingCompanies}, Reports: ${periodStats.totalReports}`);
  }
}

/**
 * Display final comprehensive statistics
 */
async function displayFinalStats(contract, companies) {
  console.log("📈 Final Statistics:\n");

  const totalCompanies = await contract.totalCompanies();
  const currentPeriod = await contract.currentReportingPeriod();
  const kmsGeneration = await contract.kmsGeneration();
  const pauserCount = await contract.getPauserCount();

  console.log(`   Total Companies: ${totalCompanies}`);
  console.log(`   Current Period: ${currentPeriod}`);
  console.log(`   KMS Generation: ${kmsGeneration}`);
  console.log(`   Pausers: ${pauserCount}`);

  console.log(`\n📋 Company Details:\n`);

  for (const company of companies) {
    const address = await company.signer.getAddress();
    const info = await contract.getCompanyInfo(address);
    const reportStatus = await contract.getReportStatus(address, 1); // Period 1

    console.log(`   ${company.name}:`);
    console.log(`      Address: ${address}`);
    console.log(`      Verified: ${info.isVerified ? "✅" : "❌"}`);
    console.log(`      Report Submitted: ${reportStatus.isSubmitted ? "✅" : "❌"}`);
    console.log(`      Report Verified: ${reportStatus.isVerified ? "✅" : "❌"}`);
    console.log("");
  }
}

/**
 * Execute a step with error handling
 */
async function step(description, action) {
  console.log(`\n▶️  ${description}...`);
  try {
    await action();
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Execute simulation
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Simulation failed:", error);
    process.exit(1);
  });
