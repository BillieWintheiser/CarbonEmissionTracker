const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Verify CarbonEmissionTracker contract on Etherscan
 *
 * Usage:
 *   npx hardhat run scripts/verify.js --network sepolia
 */

async function main() {
  console.log("\n🔍 Starting contract verification...\n");

  // Get network information
  const network = await hre.ethers.provider.getNetwork();
  console.log(`📡 Network: ${network.name} (Chain ID: ${network.chainId})`);

  // Check if Etherscan API key is set
  if (!process.env.ETHERSCAN_API_KEY) {
    console.error("❌ Error: ETHERSCAN_API_KEY not set in .env file");
    process.exit(1);
  }

  // Load deployment info
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);

  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ Error: Deployment file not found: ${deploymentFile}`);
    console.error("   Please deploy the contract first using: npx hardhat run scripts/deploy.js --network " + network.name);
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const contractAddress = deploymentInfo.contractAddress;
  const pauserAddresses = deploymentInfo.pauserAddresses;
  const kmsGeneration = deploymentInfo.kmsGeneration;

  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`📋 Constructor Arguments:`);
  console.log(`   Pauser Addresses: [${pauserAddresses.join(", ")}]`);
  console.log(`   KMS Generation: ${kmsGeneration}\n`);

  // Verify contract
  try {
    console.log("⏳ Verifying contract on Etherscan...");

    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [pauserAddresses, kmsGeneration],
    });

    console.log("\n✅ Contract verified successfully!");

    if (network.chainId === 11155111n) {
      console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/address/${contractAddress}#code`);
    }

  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("\n✅ Contract is already verified!");
      if (network.chainId === 11155111n) {
        console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/address/${contractAddress}#code`);
      }
    } else {
      console.error("\n❌ Verification failed:", error.message);
      console.log("\n📝 Manual verification instructions:");
      console.log(`   1. Go to: https://sepolia.etherscan.io/address/${contractAddress}#code`);
      console.log(`   2. Click "Verify and Publish"`);
      console.log(`   3. Select "Solidity (Single file)"`);
      console.log(`   4. Compiler: v0.8.24`);
      console.log(`   5. Optimization: Yes (200 runs)`);
      console.log(`   6. Constructor Arguments (ABI-encoded):`);

      // Encode constructor arguments
      const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();
      const encodedArgs = abiCoder.encode(
        ["address[]", "uint256"],
        [pauserAddresses, kmsGeneration]
      );
      console.log(`      ${encodedArgs.slice(2)}`); // Remove '0x' prefix

      process.exit(1);
    }
  }

  console.log("\n✨ Verification complete!\n");
}

// Execute verification
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  });
