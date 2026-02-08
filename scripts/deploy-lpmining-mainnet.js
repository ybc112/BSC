const { ethers } = require("hardhat");

async function main() {
  console.log("========================================");
  console.log("部署 LPMiningV2 到 BSC 主网");
  console.log("========================================\n");

  // 配置参数
  const LP_TOKEN = "0x7552081681410f1828a02cfeb865ea444fb21909";
  const REWARD_TOKEN = "0xCd339aec4797790A8e387eF10035df0000d3a815"; // AGG
  const LOCK_DURATION = 30 * 24 * 60 * 60; // 30天锁仓 (秒)

  const [deployer] = await ethers.getSigners();
  console.log("部署钱包:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("BNB 余额:", ethers.formatEther(balance), "BNB\n");

  // 获取当前区块时间，设置开始时间为1分钟后
  const block = await ethers.provider.getBlock("latest");
  const startTime = block.timestamp + 60; // 1分钟后开始

  // 部署 LPMiningV2
  console.log("正在部署 LPMiningV2...");
  console.log("参数:");
  console.log("  LP Token:", LP_TOKEN);
  console.log("  奖励代币:", REWARD_TOKEN);
  console.log("  开始时间:", new Date(startTime * 1000).toISOString());
  console.log("  锁仓期:", LOCK_DURATION / (24 * 60 * 60), "天");
  console.log("");

  // 构造函数: constructor(address _rewardToken, address _lpToken, uint256 _startTime)
  const LPMiningV2 = await ethers.getContractFactory("LPMiningV2");
  const lpMining = await LPMiningV2.deploy(
    REWARD_TOKEN,
    LP_TOKEN,
    startTime
  );

  await lpMining.waitForDeployment();
  const lpMiningAddress = await lpMining.getAddress();

  console.log("✅ LPMiningV2 部署成功!");
  console.log("   合约地址:", lpMiningAddress);
  console.log("");

  // 设置锁仓期
  console.log("设置锁仓期为 30 天...");
  const tx = await lpMining.setLockDuration(LOCK_DURATION);
  await tx.wait();
  console.log("✅ 锁仓期设置完成");
  console.log("");

  // 输出汇总
  console.log("========================================");
  console.log("部署完成!");
  console.log("========================================");
  console.log("LPMiningV2 地址:", lpMiningAddress);
  console.log("Owner:", deployer.address);
  console.log("");
  console.log("下一步:");
  console.log("1. 客户往合约转入 AGG 代币作为奖励");
  console.log("   合约地址:", lpMiningAddress);
  console.log("   建议初始充值: 500万~1000万 AGG");
  console.log("");
  console.log("2. 更新前端配置 frontend/src/utils/constants.js");
  console.log("   LP_TOKEN:", LP_TOKEN);
  console.log("   LP_MINING:", lpMiningAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });
