const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// PancakeSwap V2 Router 地址
const PANCAKE_ROUTER_TESTNET = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
const PANCAKE_FACTORY_TESTNET = "0x6725F303b657a9451d8BA641348b6761A6CC7a17";
const WBNB_TESTNET = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";

// Router ABI (简化版)
const ROUTER_ABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)",
  "function factory() view returns (address)"
];

// Factory ABI
const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)",
  "function createPair(address tokenA, address tokenB) returns (address pair)"
];

// ERC20 ABI
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

// ProjectTokenV2 ABI
const TOKEN_V2_ABI = [
  "function setPair(address pair, bool status)",
  "function setExcludedFromFee(address account, bool status)",
  "function isPair(address) view returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)"
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB");

  const network = hre.network.name;

  // 读取部署信息
  const deploymentPath = path.join(__dirname, "../deployments", `${network}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const tokenV2Address = deployment.projectTokenV2.address;
  console.log("\nProjectTokenV2:", tokenV2Address);

  // 获取合约实例
  const tokenV2 = new hre.ethers.Contract(tokenV2Address, TOKEN_V2_ABI, deployer);
  const router = new hre.ethers.Contract(PANCAKE_ROUTER_TESTNET, ROUTER_ABI, deployer);
  const factory = new hre.ethers.Contract(PANCAKE_FACTORY_TESTNET, FACTORY_ABI, deployer);

  // 检查是否已存在交易对
  let pairAddress = await factory.getPair(tokenV2Address, WBNB_TESTNET);
  console.log("\nExisting pair address:", pairAddress);

  if (pairAddress === "0x0000000000000000000000000000000000000000") {
    console.log("\n--- Creating Liquidity Pool ---");

    // 设置添加流动性的参数
    const tokenAmount = hre.ethers.parseEther("1000000"); // 100万代币
    const bnbAmount = hre.ethers.parseEther("0.1"); // 0.1 BNB

    // 检查余额
    const tokenBalance = await tokenV2.balanceOf(deployer.address);
    console.log("Token balance:", hre.ethers.formatEther(tokenBalance));

    if (tokenBalance < tokenAmount) {
      console.log("ERROR: Not enough tokens!");
      return;
    }

    // 授权 Router 使用代币
    console.log("\nApproving tokens...");
    const approveTx = await tokenV2.approve(PANCAKE_ROUTER_TESTNET, tokenAmount);
    await approveTx.wait();
    console.log("Approved!");

    // 添加流动性
    console.log("\nAdding liquidity...");
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20分钟后过期

    try {
      const tx = await router.addLiquidityETH(
        tokenV2Address,
        tokenAmount,
        0, // 最小代币数量
        0, // 最小 BNB 数量
        deployer.address,
        deadline,
        { value: bnbAmount }
      );

      console.log("Transaction:", tx.hash);
      const receipt = await tx.wait();
      console.log("Liquidity added! Gas used:", receipt.gasUsed.toString());

      // 获取创建的交易对地址
      pairAddress = await factory.getPair(tokenV2Address, WBNB_TESTNET);
      console.log("\nNew pair address:", pairAddress);
    } catch (err) {
      console.error("Add liquidity error:", err.message);
      return;
    }
  }

  if (pairAddress !== "0x0000000000000000000000000000000000000000") {
    // 设置交易对地址
    console.log("\n--- Setting Pair Address ---");

    const isPair = await tokenV2.isPair(pairAddress);
    if (isPair) {
      console.log("Pair already set!");
    } else {
      const tx = await tokenV2.setPair(pairAddress, true);
      await tx.wait();
      console.log("Pair set successfully!");
    }

    // 更新部署信息
    deployment.projectTokenV2.pairAddress = pairAddress;
    deployment.projectTokenV2.pairWith = "WBNB";
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("\nDeployment info updated!");

    console.log("\n========== SUMMARY ==========");
    console.log("ProjectTokenV2:", tokenV2Address);
    console.log("Pair Address:", pairAddress);
    console.log("View on BSCScan:");
    console.log(`  Token: https://testnet.bscscan.com/address/${tokenV2Address}`);
    console.log(`  Pair: https://testnet.bscscan.com/address/${pairAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
