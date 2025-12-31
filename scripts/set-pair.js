const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// 在这里输入你的交易对地址
const PAIR_ADDRESS = process.env.PAIR_ADDRESS || "";

const TOKEN_V2_ABI = [
  "function setPair(address pair, bool status)",
  "function setExcludedFromFee(address account, bool status)",
  "function isPair(address) view returns (bool)",
  "function owner() view returns (address)"
];

async function main() {
  if (!PAIR_ADDRESS) {
    console.log("Usage: PAIR_ADDRESS=0x... npx hardhat run scripts/set-pair.js --network bscTestnet");
    console.log("\nOr edit the PAIR_ADDRESS in this script.");
    return;
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Account:", deployer.address);

  const network = hre.network.name;

  // 读取部署信息
  const deploymentPath = path.join(__dirname, "../deployments", `${network}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const tokenV2Address = deployment.projectTokenV2.address;
  console.log("ProjectTokenV2:", tokenV2Address);
  console.log("Pair Address:", PAIR_ADDRESS);

  // 获取合约实例
  const tokenV2 = new hre.ethers.Contract(tokenV2Address, TOKEN_V2_ABI, deployer);

  // 检查是否是owner
  const owner = await tokenV2.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("ERROR: You are not the owner of this contract!");
    console.log("Owner:", owner);
    return;
  }

  // 检查是否已设置
  const isPair = await tokenV2.isPair(PAIR_ADDRESS);
  if (isPair) {
    console.log("This address is already set as a pair!");
    return;
  }

  // 设置交易对
  console.log("\nSetting pair address...");
  const tx = await tokenV2.setPair(PAIR_ADDRESS, true);
  await tx.wait();
  console.log("Pair set successfully!");
  console.log("Tx:", tx.hash);

  // 更新部署信息
  deployment.projectTokenV2.pairAddress = PAIR_ADDRESS;
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("\nDeployment info updated!");

  console.log("\n========== DONE ==========");
  console.log("Now when users sell tokens to this pair, 2.8% fee will be charged.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
