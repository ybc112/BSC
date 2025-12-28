/**
 * BSC 测试网完整部署脚本
 *
 * 功能：
 * 1. 部署 RWT 代币
 * 2. 部署假的 LP Token（用于测试）
 * 3. 部署 LP Mining 合约
 * 4. 部署 Token Mining 合约
 * 5. 自动转入奖励代币
 * 6. 输出所有地址和下一步操作
 */

const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║          BSC 测试网 - 完整部署脚本                          ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log("📍 部署账户:", deployer.address);

  // 检查余额
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceInBNB = hre.ethers.formatEther(balance);
  console.log("💰 账户余额:", balanceInBNB, "tBNB\n");

  if (parseFloat(balanceInBNB) < 0.05) {
    console.log("⚠️  余额不足！请先获取测试网 BNB：");
    console.log("   https://www.bnbchain.org/en/testnet-faucet\n");
    return;
  }

  // 挖矿开始时间：2分钟后
  const startTime = Math.floor(Date.now() / 1000) + 120;
  console.log("⏰ 挖矿开始时间:", new Date(startTime * 1000).toLocaleString());
  console.log("");

  // ============================================
  // 1. 部署奖励代币 (RWT)
  // ============================================
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 [1/5] 部署奖励代币 (RWT)...");

  const MockToken = await hre.ethers.getContractFactory("MockToken");
  const rewardToken = await MockToken.deploy("Reward Token", "RWT");
  await rewardToken.waitForDeployment();
  const rewardTokenAddress = await rewardToken.getAddress();

  console.log("   ✅ RWT 代币地址:", rewardTokenAddress);
  console.log("   📊 总供应量: 100,000,000 RWT");

  // ============================================
  // 2. 部署 LP Token（测试用）
  // ============================================
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 [2/5] 部署 LP Token (测试用)...");

  const lpToken = await MockToken.deploy("PancakeSwap LP Token", "Cake-LP");
  await lpToken.waitForDeployment();
  const lpTokenAddress = await lpToken.getAddress();

  console.log("   ✅ LP Token 地址:", lpTokenAddress);
  console.log("   📊 总供应量: 100,000,000 LP");

  // ============================================
  // 3. 部署 LP Mining 合约
  // ============================================
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 [3/5] 部署 LP Mining 合约...");

  const LPMining = await hre.ethers.getContractFactory("LPMining");
  const lpMining = await LPMining.deploy(
    rewardTokenAddress,
    lpTokenAddress,
    startTime
  );
  await lpMining.waitForDeployment();
  const lpMiningAddress = await lpMining.getAddress();

  console.log("   ✅ LP Mining 地址:", lpMiningAddress);

  // ============================================
  // 4. 部署 Token Mining 合约
  // ============================================
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 [4/5] 部署 Token Mining 合约...");

  const TokenMining = await hre.ethers.getContractFactory("TokenMining");
  const tokenMining = await TokenMining.deploy(
    rewardTokenAddress,
    rewardTokenAddress,
    startTime
  );
  await tokenMining.waitForDeployment();
  const tokenMiningAddress = await tokenMining.getAddress();

  console.log("   ✅ Token Mining 地址:", tokenMiningAddress);

  // ============================================
  // 5. 转入奖励代币
  // ============================================
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💸 [5/5] 转入奖励代币...");

  const lpMiningRewards = hre.ethers.parseEther("60000000");
  const tokenMiningRewards = hre.ethers.parseEther("30000000");

  let tx = await rewardToken.transfer(lpMiningAddress, lpMiningRewards);
  await tx.wait();
  console.log("   ✅ 已转入 60,000,000 RWT 到 LP Mining");

  tx = await rewardToken.transfer(tokenMiningAddress, tokenMiningRewards);
  await tx.wait();
  console.log("   ✅ 已转入 30,000,000 RWT 到 Token Mining");

  // ============================================
  // 保存部署信息
  // ============================================
  const deployment = {
    network: "bscTestnet",
    chainId: 97,
    deployer: deployer.address,
    deployTime: new Date().toISOString(),
    startTime: startTime,
    startTimeReadable: new Date(startTime * 1000).toISOString(),
    contracts: {
      rewardToken: rewardTokenAddress,
      lpToken: lpTokenAddress,
      lpMining: lpMiningAddress,
      tokenMining: tokenMiningAddress,
    }
  };

  fs.mkdirSync("./deployments", { recursive: true });
  fs.writeFileSync(
    "./deployments/bscTestnet.json",
    JSON.stringify(deployment, null, 2)
  );

  // ============================================
  // 输出完整摘要
  // ============================================
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    🎉 部署完成！                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log("📋 合约地址汇总：");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│ RWT Token:    ", rewardTokenAddress, "│");
  console.log("│ LP Token:     ", lpTokenAddress, "│");
  console.log("│ LP Mining:    ", lpMiningAddress, "│");
  console.log("│ Token Mining: ", tokenMiningAddress, "│");
  console.log("└─────────────────────────────────────────────────────────────┘");

  console.log("\n⏰ 挖矿开始时间:", new Date(startTime * 1000).toLocaleString());
  console.log("   (约 2 分钟后开始)\n");

  console.log("📁 部署信息已保存到: ./deployments/bscTestnet.json\n");

  // 前端配置
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📝 请更新前端配置 (frontend/src/utils/constants.js)：");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log(`export const CONTRACTS = {`);
  console.log(`  REWARD_TOKEN: '${rewardTokenAddress}',`);
  console.log(`  LP_TOKEN: '${lpTokenAddress}',`);
  console.log(`  LP_MINING: '${lpMiningAddress}',`);
  console.log(`  TOKEN_MINING: '${tokenMiningAddress}',`);
  console.log(`};\n`);

  // BscScan 链接
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔗 BscScan 测试网链接：");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`RWT Token:    https://testnet.bscscan.com/address/${rewardTokenAddress}`);
  console.log(`LP Token:     https://testnet.bscscan.com/address/${lpTokenAddress}`);
  console.log(`LP Mining:    https://testnet.bscscan.com/address/${lpMiningAddress}`);
  console.log(`Token Mining: https://testnet.bscscan.com/address/${tokenMiningAddress}`);

  // 下一步操作
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📌 下一步操作：");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("1. 复制上面的 CONTRACTS 配置到 frontend/src/utils/constants.js");
  console.log("2. 启动前端: cd frontend && npm run dev");
  console.log("3. 打开 http://localhost:5173 测试功能");
  console.log("4. 等待 2 分钟后挖矿开始，即可测试质押");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  });
