const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy CarbonEmissionTracker contract to Sepolia
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network sepolia
 *   npx hardhat run scripts/deploy.js --network zamaSepolia
 */

async function main() {
  console.log("\n🚀 Starting CarbonEmissionTracker deployment...\n");

  // Get network information
  const network = await hre.ethers.provider.getNetwork();
  console.log(`📡 Network: ${network.name} (Chain ID: ${network.chainId})`);

  // Get deployer account
  const [deployer, pauser1, pauser2] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log(`👤 Deployer: ${deployerAddress}`);

  // Get deployer balance
  const balance = await hre.ethers.provider.getBalance(deployerAddress);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // Configure pauser addresses (use env vars or default to deployer + additional accounts)
  const pauserAddresses = [
    process.env.PAUSER_ADDRESS_1 || (pauser1 ? await pauser1.getAddress() : deployerAddress),
    process.env.PAUSER_ADDRESS_2 || (pauser2 ? await pauser2.getAddress() : deployerAddress),
  ];

  // Configure KMS generation
  const kmsGeneration = process.env.KMS_GENERATION || 1;

  console.log("📋 Deployment Configuration:");
  console.log(`   Pauser 1: ${pauserAddresses[0]}`);
  console.log(`   Pauser 2: ${pauserAddresses[1]}`);
  console.log(`   KMS Generation: ${kmsGeneration}\n`);

  // Deploy contract
  console.log("⏳ Deploying CarbonEmissionTracker...");
  const CarbonEmissionTracker = await hre.ethers.getContractFactory("CarbonEmissionTracker");
  const contract = await CarbonEmissionTracker.deploy(pauserAddresses, kmsGeneration);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`\n✅ Contract deployed successfully!`);
  console.log(`📍 Address: ${contractAddress}\n`);

  // Save deployment information
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    contractAddress: contractAddress,
    deployer: deployerAddress,
    pauserAddresses: pauserAddresses,
    kmsGeneration: Number(kmsGeneration),
    deploymentTime: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
  };

  // Save to deployments directory
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Deployment info saved to: ${deploymentFile}\n`);

  // Update frontend config
  updateFrontendConfig(contractAddress, network.name);

  // Wait for block confirmations before verification
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("⏳ Waiting for 5 block confirmations...");
    await contract.deploymentTransaction().wait(5);
    console.log("✅ Confirmed!\n");

    // Verify on Etherscan (if Sepolia)
    if (network.chainId === 11155111n && process.env.ETHERSCAN_API_KEY) {
      console.log("🔍 Verifying contract on Etherscan...");
      try {
        await hre.run("verify:verify", {
          address: contractAddress,
          constructorArguments: [pauserAddresses, kmsGeneration],
        });
        console.log("✅ Contract verified on Etherscan!\n");
      } catch (error) {
        console.log("⚠️  Verification failed:", error.message);
        console.log("   You can verify manually later using scripts/verify.js\n");
      }
    }
  }

  // Display next steps
  console.log("📝 Next Steps:");
  console.log("   1. Update .env with CONTRACT_ADDRESS=" + contractAddress);
  console.log("   2. Run tests: npx hardhat test --network " + network.name);
  console.log("   3. Interact with contract: npx hardhat run scripts/interact.js --network " + network.name);
  console.log("   4. Simulate usage: npx hardhat run scripts/simulate.js --network " + network.name);

  if (network.chainId === 11155111n) {
    console.log(`   5. View on Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`);
  }

  console.log("\n✨ Deployment complete!\n");

  return contractAddress;
}

/**
 * Update frontend configuration with new contract address
 */
function updateFrontendConfig(contractAddress, networkName) {
  try {
    const configPath = path.join(__dirname, "..", "src", "config", "wagmi.js");
    if (fs.existsSync(configPath)) {
      let config = fs.readFileSync(configPath, "utf8");

      // Update contract address
      config = config.replace(
        /export const CONTRACT_ADDRESS = ["']0x[a-fA-F0-9]{40}["']/,
        `export const CONTRACT_ADDRESS = "${contractAddress}"`
      );

      fs.writeFileSync(configPath, config);
      console.log(`✅ Updated frontend config: ${configPath}`);
    }

    // Update public/index.html
    const publicHtmlPath = path.join(__dirname, "..", "public", "index.html");
    if (fs.existsSync(publicHtmlPath)) {
      let html = fs.readFileSync(publicHtmlPath, "utf8");

      // Update contract address
      html = html.replace(
        /const CONTRACT_ADDRESS = ["']0x[a-fA-F0-9]{40}["']/,
        `const CONTRACT_ADDRESS = "${contractAddress}"`
      );

      fs.writeFileSync(publicHtmlPath, html);
      console.log(`✅ Updated public HTML: ${publicHtmlPath}`);
    }
  } catch (error) {
    console.log("⚠️  Could not update frontend config:", error.message);
  }
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
