const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("========================================");
  console.log("向 LPMiningV2 合约转入奖励代币");
  console.log("========================================\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("操作账户:", deployer.address);

  // 读取部署信息
  const networkName = hre.network.name;
  const deploymentPath = path.join(__dirname, `../deployments/${networkName}.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error("未找到部署信息，请先部署合约");
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const rewardTokenAddress = deployment.contracts.rewardToken;
  const lpMiningV2Address = deployment.contracts.lpMiningV2;

  if (!lpMiningV2Address) {
    throw new Error("未找到 LPMiningV2 合约地址");
  }

  console.log("奖励代币地址:", rewardTokenAddress);
  console.log("LPMiningV2 地址:", lpMiningV2Address);

  // 获取代币合约
  const RewardToken = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", rewardTokenAddress);

  // 检查当前余额
  const deployerBalance = await RewardToken.balanceOf(deployer.address);
  console.log("\n当前账户代币余额:", hre.ethers.formatEther(deployerBalance));

  const contractBalance = await RewardToken.balanceOf(lpMiningV2Address);
  console.log("合约当前代币余额:", hre.ethers.formatEther(contractBalance));

  // 需要转入的数量（6000万）
  const amountToTransfer = hre.ethers.parseEther("60000000");
  console.log("\n需要转入数量:", hre.ethers.formatEther(amountToTransfer));

  if (deployerBalance < amountToTransfer) {
    console.log("\n警告: 账户余额不足，将转入所有可用余额");
    console.log("可用余额:", hre.ethers.formatEther(deployerBalance));

    if (deployerBalance > 0) {
      console.log("\n正在转入代币...");
      const tx = await RewardToken.transfer(lpMiningV2Address, deployerBalance);
      await tx.wait();
      console.log("转账成功！交易哈希:", tx.hash);
    } else {
      console.log("账户无可用代币");
    }
  } else {
    console.log("\n正在转入代币...");
    const tx = await RewardToken.transfer(lpMiningV2Address, amountToTransfer);
    await tx.wait();
    console.log("转账成功！交易哈希:", tx.hash);
  }

  // 验证转账后余额
  const newContractBalance = await RewardToken.balanceOf(lpMiningV2Address);
  console.log("\n合约新代币余额:", hre.ethers.formatEther(newContractBalance));

  console.log("\n========================================");
  console.log("完成！");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("错误:", error);
    process.exit(1);
  });
