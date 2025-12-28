/**
 * 单独部署代币脚本
 * 用于先部署代币，然后去 PancakeSwap 创建流动性
 */

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("========================================");
  console.log("部署项目代币到 BSC 主网");
  console.log("========================================");
  console.log("部署账户:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", hre.ethers.formatEther(balance), "BNB\n");

  // 部署代币
  console.log("正在部署代币...");
  const MockToken = await hre.ethers.getContractFactory("MockToken");
  const token = await MockToken.deploy("Reward Token", "RWT");
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();

  console.log("\n========================================");
  console.log("代币部署成功！");
  console.log("========================================");
  console.log("代币地址:", tokenAddress);
  console.log("代币名称: Reward Token");
  console.log("代币符号: RWT");
  console.log("总供应量: 100,000,000 RWT");
  console.log("========================================\n");

  console.log("下一步操作：");
  console.log("1. 复制代币地址");
  console.log("2. 访问 https://pancakeswap.finance/add");
  console.log("3. 添加流动性（代币 + BNB）");
  console.log("4. 获取 LP Token 地址");
  console.log("5. 运行 deploy-mainnet.js 部署挖矿合约\n");

  console.log("验证代币命令：");
  console.log(`npx hardhat verify --network bscMainnet ${tokenAddress} "Reward Token" "RWT"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
