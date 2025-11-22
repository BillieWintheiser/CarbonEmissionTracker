import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Deploying CarbonEmissionTracker contract...");

  const carbonEmissionTracker = await deploy("CarbonEmissionTracker", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });

  console.log(`CarbonEmissionTracker deployed to: ${carbonEmissionTracker.address}`);
};

export default func;
func.tags = ["CarbonEmissionTracker"];
