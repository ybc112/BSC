// 检查钱包余额的脚本
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("钱包地址:", deployer.address);
  console.log("tBNB 余额:", hre.ethers.formatEther(balance), "tBNB");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (parseFloat(hre.ethers.formatEther(balance)) < 0.05) {
    console.log("\n⚠️  余额不足！请先获取测试网 BNB：");
    console.log("   https://www.bnbchain.org/en/testnet-faucet");
  } else {
    console.log("\n✅ 余额充足，可以进行部署！");
  }
}

main().catch(console.error);
