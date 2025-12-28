/**
 * 批量验证合约脚本
 * 从 deployments/bscMainnet.json 读取部署信息并验证
 */

const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("========================================");
  console.log("批量验证合约");
  console.log("========================================\n");

  // 读取部署信息
  const deploymentPath = "./deployments/bscMainnet.json";

  if (!fs.existsSync(deploymentPath)) {
    console.error("错误: 找不到部署文件 " + deploymentPath);
    console.log("请先运行部署脚本，或手动创建该文件。\n");

    console.log("文件格式示例：");
    console.log(JSON.stringify({
      startTime: 1703980800,
      contracts: {
        rewardToken: "0x...",
        lpToken: "0x...",
        lpMining: "0x...",
        tokenMining: "0x..."
      }
    }, null, 2));
    return;
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const { contracts, startTime } = deployment;

  console.log("部署信息：");
  console.log("- Reward Token:", contracts.rewardToken);
  console.log("- LP Token:", contracts.lpToken);
  console.log("- LP Mining:", contracts.lpMining);
  console.log("- Token Mining:", contracts.tokenMining);
  console.log("- Start Time:", startTime);
  console.log("");

  // 验证 Reward Token（如果是我们部署的）
  if (contracts.rewardToken) {
    console.log("验证 Reward Token...");
    try {
      await hre.run("verify:verify", {
        address: contracts.rewardToken,
        constructorArguments: ["Reward Token", "RWT"],
      });
      console.log("✅ Reward Token 验证成功\n");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("⚠️ Reward Token 已验证\n");
      } else {
        console.log("❌ Reward Token 验证失败:", error.message, "\n");
      }
    }
  }

  // 验证 LP Mining
  if (contracts.lpMining) {
    console.log("验证 LP Mining...");
    try {
      await hre.run("verify:verify", {
        address: contracts.lpMining,
        constructorArguments: [
          contracts.rewardToken,
          contracts.lpToken,
          startTime
        ],
      });
      console.log("✅ LP Mining 验证成功\n");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("⚠️ LP Mining 已验证\n");
      } else {
        console.log("❌ LP Mining 验证失败:", error.message, "\n");
      }
    }
  }

  // 验证 Token Mining
  if (contracts.tokenMining) {
    console.log("验证 Token Mining...");
    try {
      await hre.run("verify:verify", {
        address: contracts.tokenMining,
        constructorArguments: [
          contracts.rewardToken,
          contracts.rewardToken,
          startTime
        ],
      });
      console.log("✅ Token Mining 验证成功\n");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("⚠️ Token Mining 已验证\n");
      } else {
        console.log("❌ Token Mining 验证失败:", error.message, "\n");
      }
    }
  }

  console.log("========================================");
  console.log("验证完成！");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
