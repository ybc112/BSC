const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 获取当前时间戳
  const startTime = Math.floor(Date.now() / 1000) + 60; // 1分钟后开始

  // 部署奖励代币 (如果需要新代币)
  const MockToken = await hre.ethers.getContractFactory("MockToken");
  const rewardToken = await MockToken.deploy("Reward Token", "RWT");
  await rewardToken.waitForDeployment();
  console.log("Reward Token deployed to:", await rewardToken.getAddress());

  // 部署LP代币 (测试用)
  const lpToken = await MockToken.deploy("LP Token", "LP");
  await lpToken.waitForDeployment();
  console.log("LP Token deployed to:", await lpToken.getAddress());

  // 部署LP挖矿合约
  const LPMining = await hre.ethers.getContractFactory("LPMining");
  const lpMining = await LPMining.deploy(
    await rewardToken.getAddress(),
    await lpToken.getAddress(),
    startTime
  );
  await lpMining.waitForDeployment();
  console.log("LP Mining deployed to:", await lpMining.getAddress());

  // 部署代币挖矿合约
  const TokenMining = await hre.ethers.getContractFactory("TokenMining");
  const tokenMining = await TokenMining.deploy(
    await rewardToken.getAddress(),
    await rewardToken.getAddress(),
    startTime
  );
  await tokenMining.waitForDeployment();
  console.log("Token Mining deployed to:", await tokenMining.getAddress());

  // 转移奖励代币到挖矿合约
  const lpMiningRewards = hre.ethers.parseEther("60000000");  // 6000万
  const tokenMiningRewards = hre.ethers.parseEther("30000000"); // 3000万

  await rewardToken.transfer(await lpMining.getAddress(), lpMiningRewards);
  console.log("Transferred 60M tokens to LP Mining");

  await rewardToken.transfer(await tokenMining.getAddress(), tokenMiningRewards);
  console.log("Transferred 30M tokens to Token Mining");

  console.log("\n=== Deployment Summary ===");
  console.log("Reward Token:", await rewardToken.getAddress());
  console.log("LP Token:", await lpToken.getAddress());
  console.log("LP Mining:", await lpMining.getAddress());
  console.log("Token Mining:", await tokenMining.getAddress());
  console.log("Start Time:", new Date(startTime * 1000).toISOString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
