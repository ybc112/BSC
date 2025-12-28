const hre = require("hardhat");

/**
 * BSC 主网部署脚本
 * 
 * 使用方法：
 * 1. 如果已有代币，修改下面的 EXISTING_TOKEN_ADDRESS
 * 2. 如果需要新部署代币，设置 DEPLOY_NEW_TOKEN = true
 * 3. LP_TOKEN_ADDRESS 需要在 PancakeSwap 创建流动性后填入
 */

// ============ 配置区域 ============
const CONFIG = {
  // 是否部署新代币（如果已有代币设为 false）
  DEPLOY_NEW_TOKEN: true,
  
  // 已有代币地址（DEPLOY_NEW_TOKEN 为 false 时使用）
  EXISTING_TOKEN_ADDRESS: "",
  
  // LP Token 地址（在 PancakeSwap 创建流动性后获取）
  // 留空则跳过 LP Mining 部署
  LP_TOKEN_ADDRESS: "",
  
  // 代币信息（部署新代币时使用）
  TOKEN_NAME: "Your Token Name",
  TOKEN_SYMBOL: "YTN",
  
  // 挖矿开始时间（Unix 时间戳，0 表示部署后立即开始）
  START_TIME: 0,
  
  // 是否部署 Token Mining
  DEPLOY_TOKEN_MINING: true,
  
  // 是否部署 LP Mining（需要 LP_TOKEN_ADDRESS）
  DEPLOY_LP_MINING: true,
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("========================================");
  console.log("BSC 主网部署");
  console.log("========================================");
  console.log("部署账户:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", hre.ethers.formatEther(balance), "BNB");
  console.log("========================================\n");

  let tokenAddress;
  
  // 步骤1: 部署或使用已有代币
  if (CONFIG.DEPLOY_NEW_TOKEN) {
    console.log("步骤 1: 部署项目代币...");
    const ProjectToken = await hre.ethers.getContractFactory("ProjectToken");
    const token = await ProjectToken.deploy(CONFIG.TOKEN_NAME, CONFIG.TOKEN_SYMBOL);
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();
    console.log(`✅ 代币已部署: ${tokenAddress}`);
    console.log(`   名称: ${CONFIG.TOKEN_NAME}`);
    console.log(`   符号: ${CONFIG.TOKEN_SYMBOL}`);
    console.log(`   总量: 100,000,000\n`);
  } else {
    tokenAddress = CONFIG.EXISTING_TOKEN_ADDRESS;
    console.log("步骤 1: 使用已有代币");
    console.log(`   地址: ${tokenAddress}\n`);
  }

  // 计算开始时间
  const startTime = CONFIG.START_TIME || (Math.floor(Date.now() / 1000) + 300); // 默认5分钟后
  console.log(`挖矿开始时间: ${new Date(startTime * 1000).toISOString()}\n`);

  let lpMiningAddress = null;
  let tokenMiningAddress = null;

  // 步骤2: 部署 LP Mining（如果有 LP Token）
  if (CONFIG.DEPLOY_LP_MINING && CONFIG.LP_TOKEN_ADDRESS) {
    console.log("步骤 2: 部署 LP Mining 合约...");
    const LPMining = await hre.ethers.getContractFactory("LPMining");
    const lpMining = await LPMining.deploy(
      tokenAddress,
      CONFIG.LP_TOKEN_ADDRESS,
      startTime
    );
    await lpMining.waitForDeployment();
    lpMiningAddress = await lpMining.getAddress();
    console.log(`✅ LP Mining 已部署: ${lpMiningAddress}\n`);
  } else {
    console.log("步骤 2: 跳过 LP Mining（未提供 LP Token 地址）\n");
    console.log("   ⚠️  请先在 PancakeSwap 创建流动性池获取 LP Token 地址\n");
  }

  // 步骤3: 部署 Token Mining
  if (CONFIG.DEPLOY_TOKEN_MINING) {
    console.log("步骤 3: 部署 Token Mining 合约...");
    const TokenMining = await hre.ethers.getContractFactory("TokenMining");
    const tokenMining = await TokenMining.deploy(
      tokenAddress,
      tokenAddress,
      startTime
    );
    await tokenMining.waitForDeployment();
    tokenMiningAddress = await tokenMining.getAddress();
    console.log(`✅ Token Mining 已部署: ${tokenMiningAddress}\n`);
  }

  // 部署总结
  console.log("========================================");
  console.log("部署完成！");
  console.log("========================================");
  console.log("代币地址:", tokenAddress);
  if (lpMiningAddress) {
    console.log("LP Mining:", lpMiningAddress);
  }
  if (tokenMiningAddress) {
    console.log("Token Mining:", tokenMiningAddress);
  }
  console.log("开始时间:", new Date(startTime * 1000).toISOString());
  console.log("========================================\n");

  // 下一步提示
  console.log("📋 下一步操作：");
  console.log("----------------------------------------");
  
  if (!CONFIG.LP_TOKEN_ADDRESS) {
    console.log("1. 在 PancakeSwap 创建流动性池：");
    console.log("   https://pancakeswap.finance/add");
    console.log(`   - 代币A: ${tokenAddress}`);
    console.log("   - 代币B: BNB 或 USDT");
    console.log("   - 创建后获取 LP Token 地址\n");
  }

  console.log("2. 向挖矿合约转入奖励代币：");
  if (lpMiningAddress) {
    console.log(`   - LP Mining: 转入 6000 万代币到 ${lpMiningAddress}`);
  }
  if (tokenMiningAddress) {
    console.log(`   - Token Mining: 转入 3000 万代币到 ${tokenMiningAddress}`);
  }
  
  console.log("\n3. 验证合约代码：");
  console.log("   npx hardhat verify --network bscMainnet <合约地址> <构造函数参数>");
  
  console.log("\n4. 更新前端配置 (frontend/src/utils/constants.js)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
