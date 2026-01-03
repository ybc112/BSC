const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB");

    const network = hre.network.name;
    console.log("Network:", network);

    // 读取现有部署信息
    const deploymentPath = path.join(__dirname, "../deployments", `${network}.json`);
    let deployment = {};
    if (fs.existsSync(deploymentPath)) {
        deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        console.log("\nLoaded existing deployment");
    }

    // 使用现有的 ProjectTokenV2
    const projectTokenV2Address = deployment.projectTokenV2?.address;

    if (!projectTokenV2Address) {
        throw new Error("ProjectTokenV2 not found in deployment!");
    }

    console.log("\n========== EXISTING CONTRACTS ==========");
    console.log("ProjectTokenV2:", projectTokenV2Address);

    // ========== 部署新的 TokenMiningV2（多档锁仓版本） ==========
    console.log("\n--- Deploying TokenMiningV2 (多档锁仓版本) ---");

    const startTime = Math.floor(Date.now() / 1000) + 60; // 1分钟后开始

    const TokenMiningV2 = await hre.ethers.getContractFactory("TokenMiningV2");
    const tokenMiningV2 = await TokenMiningV2.deploy(
        projectTokenV2Address,  // staking token
        projectTokenV2Address,  // reward token
        startTime
    );
    await tokenMiningV2.waitForDeployment();

    const tokenMiningV2Address = await tokenMiningV2.getAddress();
    console.log("TokenMiningV2 deployed to:", tokenMiningV2Address);
    console.log("- Start time:", new Date(startTime * 1000).toISOString());
    console.log("- 随进随出: 0.4%/天 (APY 146%)");
    console.log("- 3个月锁仓: 0.6%/天 (APY 219%)");
    console.log("- 6个月锁仓: 0.8%/天 (APY 292%)");
    console.log("- 12个月锁仓: 1.0%/天 (APY 365%)");

    // ========== 设置白名单 ==========
    console.log("\n--- Setting up whitelist ---");

    const ProjectTokenV2 = await hre.ethers.getContractFactory("ProjectTokenV2");
    const tokenV2 = ProjectTokenV2.attach(projectTokenV2Address);

    try {
        await tokenV2.setExcludedFromFee(tokenMiningV2Address, true);
        console.log("TokenMiningV2 added to fee whitelist");
    } catch (err) {
        console.log("Warning: Could not add to whitelist:", err.message);
    }

    // ========== 充值奖励代币 ==========
    console.log("\n--- Funding reward tokens ---");

    const fundAmount = hre.ethers.parseEther("30000000"); // 3000万
    const currentBalance = await tokenV2.balanceOf(deployer.address);
    console.log("Your ProjectTokenV2 balance:", hre.ethers.formatEther(currentBalance));

    if (currentBalance >= fundAmount) {
        try {
            const tx = await tokenV2.transfer(tokenMiningV2Address, fundAmount);
            await tx.wait();
            console.log("Funded 30,000,000 ProjectTokenV2 to TokenMiningV2");
        } catch (err) {
            console.log("Warning: Could not fund:", err.message);
        }
    } else {
        console.log("Warning: Insufficient balance to fund. Please fund manually.");
    }

    // ========== 保存部署信息 ==========
    deployment.tokenMiningV2 = {
        address: tokenMiningV2Address,
        stakingToken: projectTokenV2Address,
        rewardToken: projectTokenV2Address,
        startTime: startTime,
        startTimeHuman: new Date(startTime * 1000).toISOString(),
        version: "Multi-Tier",
        tiers: {
            flexible: { dailyRate: "0.4%", apy: "146%", lockDays: 0 },
            threeMonths: { dailyRate: "0.6%", apy: "219%", lockDays: 90 },
            sixMonths: { dailyRate: "0.8%", apy: "292%", lockDays: 180 },
            twelveMonths: { dailyRate: "1.0%", apy: "365%", lockDays: 365 },
        }
    };

    deployment.lastUpdate = new Date().toISOString();

    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("\n--- Deployment info saved ---");

    // ========== 更新前端配置提示 ==========
    console.log("\n========== DEPLOYMENT SUMMARY ==========");
    console.log("TokenMiningV2 (多档锁仓):", tokenMiningV2Address);

    console.log("\n========== NEXT STEPS ==========");
    console.log("1. Update frontend/src/utils/constants.js:");
    console.log(`   TOKEN_MINING_V2: '${tokenMiningV2Address}'`);
    console.log("\n2. Verify contract:");
    console.log(`   npx hardhat verify --network ${network} ${tokenMiningV2Address} ${projectTokenV2Address} ${projectTokenV2Address} ${startTime}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
