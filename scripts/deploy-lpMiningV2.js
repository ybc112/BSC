const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("========================================");
  console.log("部署 LPMiningV2 合约");
  console.log("========================================\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", hre.ethers.formatEther(balance), "BNB\n");

  // 读取现有部署信息
  const networkName = hre.network.name;
  const deploymentPath = path.join(__dirname, `../deployments/${networkName}.json`);

  let existingDeployment = {};
  if (fs.existsSync(deploymentPath)) {
    existingDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    console.log("已找到现有部署信息:");
    console.log("- 奖励代币:", existingDeployment.contracts?.rewardToken);
    console.log("- LP 代币:", existingDeployment.contracts?.lpToken);
    console.log("");
  }

  // 配置参数
  const CONFIG = {
    // 使用现有的代币地址
    REWARD_TOKEN: existingDeployment.contracts?.rewardToken || process.env.REWARD_TOKEN_ADDRESS,
    LP_TOKEN: existingDeployment.contracts?.lpToken || process.env.LP_TOKEN_ADDRESS,

    // 开始时间：5分钟后开始
    START_TIME: Math.floor(Date.now() / 1000) + 5 * 60,
  };

  // 验证配置
  if (!CONFIG.REWARD_TOKEN) {
    throw new Error("未找到奖励代币地址，请在 .env 中设置 REWARD_TOKEN_ADDRESS 或先部署代币");
  }
  if (!CONFIG.LP_TOKEN) {
    throw new Error("未找到 LP 代币地址，请在 .env 中设置 LP_TOKEN_ADDRESS");
  }

  console.log("部署配置:");
  console.log("- 奖励代币:", CONFIG.REWARD_TOKEN);
  console.log("- LP 代币:", CONFIG.LP_TOKEN);
  console.log("- 开始时间:", new Date(CONFIG.START_TIME * 1000).toLocaleString());
  console.log("");

  // 部署 LPMiningV2
  console.log("正在部署 LPMiningV2...");
  const LPMiningV2 = await hre.ethers.getContractFactory("LPMiningV2");
  const lpMiningV2 = await LPMiningV2.deploy(
    CONFIG.REWARD_TOKEN,
    CONFIG.LP_TOKEN,
    CONFIG.START_TIME
  );

  await lpMiningV2.waitForDeployment();
  const lpMiningV2Address = await lpMiningV2.getAddress();
  console.log("LPMiningV2 部署成功:", lpMiningV2Address);

  // 获取合约信息
  const rewardPerSecond = await lpMiningV2.rewardPerSecond();
  const totalRewards = await lpMiningV2.totalRewards();
  const miningDuration = await lpMiningV2.miningDuration();
  const lockDuration = await lpMiningV2.lockDuration();

  console.log("\n合约参数:");
  console.log("- 总奖励:", hre.ethers.formatEther(totalRewards), "代币");
  console.log("- 挖矿时长:", Number(miningDuration) / 86400 / 365, "年");
  console.log("- 每秒释放:", hre.ethers.formatEther(rewardPerSecond), "代币");
  console.log("- 锁仓时长:", Number(lockDuration) / 86400, "天");

  // 保存部署信息
  const deployment = {
    network: networkName,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    deployTime: new Date().toISOString(),
    contracts: {
      ...existingDeployment.contracts,
      lpMiningV2: lpMiningV2Address,
    },
    lpMiningV2Config: {
      startTime: CONFIG.START_TIME,
      startTimeHuman: new Date(CONFIG.START_TIME * 1000).toISOString(),
      rewardToken: CONFIG.REWARD_TOKEN,
      lpToken: CONFIG.LP_TOKEN,
      totalRewards: hre.ethers.formatEther(totalRewards),
      miningDurationDays: Number(miningDuration) / 86400,
      lockDurationDays: Number(lockDuration) / 86400,
    },
  };

  // 确保目录存在
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("\n部署信息已保存到:", deploymentPath);

  // 输出后续操作指南
  console.log("\n========================================");
  console.log("部署完成！后续操作：");
  console.log("========================================");
  console.log("\n1. 转入奖励代币到合约（60,000,000 代币）:");
  console.log(`   合约地址: ${lpMiningV2Address}`);

  console.log("\n2. 配置分流地址（可选，调用 setSplitAddresses）:");
  console.log("   示例：setSplitAddresses([地址1, 地址2], [5000, 5000])");

  console.log("\n3. 验证合约（如果在主网）:");
  console.log(`   npx hardhat verify --network ${networkName} ${lpMiningV2Address} ${CONFIG.REWARD_TOKEN} ${CONFIG.LP_TOKEN} ${CONFIG.START_TIME}`);

  console.log("\n4. 更新前端配置:");
  console.log("   编辑 frontend/src/utils/constants.js");
  console.log(`   LP_MINING_V2: '${lpMiningV2Address}'`);

  return {
    lpMiningV2: lpMiningV2Address,
    config: CONFIG,
  };
}

main()
  .then((result) => {
    console.log("\n部署结果:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });
