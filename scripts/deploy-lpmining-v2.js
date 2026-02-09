const { ethers } = require("hardhat");

/**
 * LPMiningV2 V2.1 部署脚本
 *
 * 使用方法:
 *   测试网: npx hardhat run scripts/deploy-lpmining-v2.js --network bscTestnet
 *   主网:   npx hardhat run scripts/deploy-lpmining-v2.js --network bscMainnet
 *
 * V2.1 更新内容:
 *   1. 推荐关系无需质押即可绑定
 *   2. 支持管理员批量发放奖励（每日自动到账功能）
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("========================================");
  console.log("LPMiningV2 V2.1 部署脚本");
  console.log("========================================");
  console.log("部署网络:", network.name, `(chainId: ${network.chainId})`);
  console.log("部署账户:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "BNB");
  console.log("---");

  // ========== 配置参数 ==========
  // 根据网络选择代币地址
  let rewardToken, lpToken;

  if (network.chainId === 97n) {
    // BSC 测试网
    console.log("使用 BSC 测试网配置...");
    rewardToken = "0x579A34dfE590020d9aB17b665c2d2e8640c8DaBd"; // AGG Token (测试网)
    lpToken = "0x30758d09AAD52BfE8773839bD0aF44e46a8D5E33";     // LP Token (测试网)
  } else if (network.chainId === 56n) {
    // BSC 主网
    console.log("使用 BSC 主网配置...");
    // TODO: 填入主网代币地址
    rewardToken = "0x..."; // AGG Token (主网)
    lpToken = "0x...";     // LP Token (主网)

    if (rewardToken === "0x..." || lpToken === "0x...") {
      console.error("错误: 请先配置主网代币地址!");
      process.exit(1);
    }
  } else {
    console.error("错误: 不支持的网络");
    process.exit(1);
  }

  // 开始时间：部署后 1 分钟
  const startTime = Math.floor(Date.now() / 1000) + 60;

  console.log("奖励代币:", rewardToken);
  console.log("LP 代币:", lpToken);
  console.log("开始时间:", new Date(startTime * 1000).toLocaleString());
  console.log("---");

  // ========== 部署合约 ==========
  console.log("正在部署 LPMiningV2...");

  const LPMiningV2 = await ethers.getContractFactory("LPMiningV2");
  const lpMining = await LPMiningV2.deploy(
    rewardToken,
    lpToken,
    startTime
  );

  await lpMining.waitForDeployment();
  const address = await lpMining.getAddress();

  console.log("\n========================================");
  console.log("部署成功!");
  console.log("========================================");
  console.log("LPMiningV2 地址:", address);
  console.log("---");

  // 读取合约配置
  const totalRewards = await lpMining.totalRewards();
  const miningDuration = await lpMining.miningDuration();
  const lockDuration = await lpMining.lockDuration();
  const userBaseShare = await lpMining.userBaseShare();
  const splitShare = await lpMining.splitShare();

  console.log("合约配置:");
  console.log("  总奖励:", ethers.formatEther(totalRewards), "AGG");
  console.log("  挖矿周期:", Number(miningDuration) / 86400 / 365, "年");
  console.log("  锁仓期:", Number(lockDuration) / 86400, "天");
  console.log("  用户占比:", Number(userBaseShare) / 100, "%");
  console.log("  分流占比:", Number(splitShare) / 100, "%");
  console.log("---");

  // ========== 后续操作提示 ==========
  console.log("\n后续操作:");
  console.log("1. 向合约转入 AGG 奖励代币");
  console.log(`   代币地址: ${rewardToken}`);
  console.log(`   接收地址: ${address}`);
  console.log("");
  console.log("2. 配置分流地址 (可选)");
  console.log("   调用: setSplitAddresses(addresses[], rates[])");
  console.log("");
  console.log("3. 更新前端配置");
  console.log("   文件: frontend/src/utils/constants.js");
  console.log(`   LP_MINING: '${address}'`);
  console.log("");
  console.log("4. 如需转移 Owner 权限");
  console.log("   调用: transferOwnership(newOwner)");
  console.log("========================================");

  // 保存部署信息
  const fs = require("fs");
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    lpMiningV2: address,
    rewardToken,
    lpToken,
    startTime,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    version: "2.1"
  };

  const filename = `deployments/lpMiningV2-${network.chainId}.json`;
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n部署信息已保存到: ${filename}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
