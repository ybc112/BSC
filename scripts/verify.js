const hre = require("hardhat");

// 部署信息 - 2025-12-27 新部署
const contracts = {
  RewardToken: {
    address: "0x626a03c4aE66A93ba208194107941161B3590fe6",
    args: ["Reward Token", "RWT"]
  },
  LPToken: {
    address: "0xD252b6F0C4c11a7332fc986728caB974A02c8EA8",
    args: ["LP Token", "LP"]
  },
  LPMining: {
    address: "0x2c556Fc2Baf45a9c57228119241d92871348676D",
    args: [
      "0x626a03c4aE66A93ba208194107941161B3590fe6", // rewardToken
      "0xD252b6F0C4c11a7332fc986728caB974A02c8EA8", // lpToken
      1766772634 // startTime: 2025-12-26T18:10:34.000Z
    ]
  },
  TokenMining: {
    address: "0xD986ad28BE396ECC5CA882416AAF84F216ae08dc",
    args: [
      "0x626a03c4aE66A93ba208194107941161B3590fe6", // stakingToken
      "0x626a03c4aE66A93ba208194107941161B3590fe6", // rewardToken
      1766772634 // startTime: 2025-12-26T18:10:34.000Z
    ]
  }
};

async function main() {
  console.log("开始验证合约...\n");

  for (const [name, info] of Object.entries(contracts)) {
    console.log(`验证 ${name}: ${info.address}`);
    try {
      await hre.run("verify:verify", {
        address: info.address,
        constructorArguments: info.args,
      });
      console.log(`✅ ${name} 验证成功\n`);
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log(`⚠️ ${name} 已经验证过了\n`);
      } else {
        console.log(`❌ ${name} 验证失败: ${error.message}\n`);
      }
    }
  }

  console.log("=== 验证完成 ===");
  console.log("查看合约:");
  console.log(`Reward Token: https://testnet.bscscan.com/address/${contracts.RewardToken.address}#code`);
  console.log(`LP Token: https://testnet.bscscan.com/address/${contracts.LPToken.address}#code`);
  console.log(`LP Mining: https://testnet.bscscan.com/address/${contracts.LPMining.address}#code`);
  console.log(`Token Mining: https://testnet.bscscan.com/address/${contracts.TokenMining.address}#code`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
