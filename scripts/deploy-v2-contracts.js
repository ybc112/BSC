const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

    const network = hre.network.name;
    console.log("Network:", network);

    // 读取现有部署信息
    const deploymentPath = path.join(__dirname, "../deployments", `${network}.json`);
    let deployment = {};
    if (fs.existsSync(deploymentPath)) {
        deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        console.log("Loaded existing deployment:", deployment);
    }

    // ========== 部署 ProjectTokenV2 ==========
    console.log("\n--- Deploying ProjectTokenV2 ---");

    // 滑点接收地址（可以设为deployer或其他地址）
    const feeReceiver = deployer.address;

    const ProjectTokenV2 = await hre.ethers.getContractFactory("ProjectTokenV2");
    const tokenV2 = await ProjectTokenV2.deploy(
        "Project Token V2",  // name
        "PTKV2",             // symbol
        feeReceiver          // fee receiver
    );
    await tokenV2.waitForDeployment();

    const tokenV2Address = await tokenV2.getAddress();
    console.log("ProjectTokenV2 deployed to:", tokenV2Address);
    console.log("- Buy fee: 0%");
    console.log("- Sell fee: 2.8%");
    console.log("- Fee receiver:", feeReceiver);

    // ========== 部署 TokenMiningV2 ==========
    console.log("\n--- Deploying TokenMiningV2 ---");

    // 开始时间：部署后立即开始
    const startTime = Math.floor(Date.now() / 1000) + 60; // 1分钟后开始

    const TokenMiningV2 = await hre.ethers.getContractFactory("TokenMiningV2");
    const miningV2 = await TokenMiningV2.deploy(
        tokenV2Address,  // staking token
        tokenV2Address,  // reward token (同一个代币)
        startTime
    );
    await miningV2.waitForDeployment();

    const miningV2Address = await miningV2.getAddress();
    console.log("TokenMiningV2 deployed to:", miningV2Address);
    console.log("- Start time:", new Date(startTime * 1000).toISOString());
    console.log("- Lock tiers:");
    console.log("  - Flexible: 0.4% daily");
    console.log("  - 3 months: 0.6% daily");
    console.log("  - 6 months: 0.8% daily");
    console.log("  - 12 months: 1.0% daily");

    // ========== 设置白名单 ==========
    console.log("\n--- Setting up whitelist ---");

    // TokenMiningV2 合约免滑点
    await tokenV2.setExcludedFromFee(miningV2Address, true);
    console.log("TokenMiningV2 added to whitelist (no fee)");

    // ========== 保存部署信息 ==========
    deployment.projectTokenV2 = {
        address: tokenV2Address,
        buyFee: "0%",
        sellFee: "2.8%",
        feeReceiver: feeReceiver
    };

    deployment.tokenMiningV2 = {
        address: miningV2Address,
        stakingToken: tokenV2Address,
        rewardToken: tokenV2Address,
        startTime: startTime,
        tiers: {
            flexible: { duration: "0 days", dailyRate: "0.4%" },
            threeMonths: { duration: "90 days", dailyRate: "0.6%" },
            sixMonths: { duration: "180 days", dailyRate: "0.8%" },
            twelveMonths: { duration: "365 days", dailyRate: "1.0%" }
        }
    };

    deployment.deployedAt = new Date().toISOString();
    deployment.deployer = deployer.address;

    // 确保目录存在
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("\n--- Deployment info saved to:", deploymentPath);

    // ========== 输出后续操作提示 ==========
    console.log("\n========== NEXT STEPS ==========");
    console.log("1. Fund TokenMiningV2 with reward tokens:");
    console.log(`   npx hardhat run scripts/fund-tokenMiningV2.js --network ${network}`);
    console.log("\n2. Set DEX pair address (after creating liquidity pool):");
    console.log(`   await tokenV2.setPair("<PAIR_ADDRESS>", true)`);
    console.log("\n3. Verify contracts on BSCScan:");
    console.log(`   npx hardhat verify --network ${network} ${tokenV2Address} "Project Token V2" "PTKV2" "${feeReceiver}"`);
    console.log(`   npx hardhat verify --network ${network} ${miningV2Address} ${tokenV2Address} ${tokenV2Address} ${startTime}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
