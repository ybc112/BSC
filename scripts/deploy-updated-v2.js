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

    // 使用现有的 ProjectTokenV2 和 LP Token
    const projectTokenV2Address = deployment.projectTokenV2?.address;
    const lpTokenAddress = deployment.contracts?.lpToken;
    const rewardTokenAddress = deployment.contracts?.rewardToken;

    if (!projectTokenV2Address) {
        throw new Error("ProjectTokenV2 not found in deployment!");
    }

    console.log("\n========== EXISTING CONTRACTS ==========");
    console.log("ProjectTokenV2:", projectTokenV2Address);
    console.log("LP Token:", lpTokenAddress);
    console.log("Reward Token:", rewardTokenAddress);

    // ========== 部署新的 TokenMiningV2 ==========
    console.log("\n--- Deploying NEW TokenMiningV2 (随进随出 0.5%/天) ---");

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
    console.log("- Daily rate: 0.5%");
    console.log("- APY: 182.5%");
    console.log("- Lock period: NONE (随进随出)");

    // ========== 部署新的 LPMiningV2 ==========
    console.log("\n--- Deploying NEW LPMiningV2 (含管理员转LP功能) ---");

    const lpStartTime = Math.floor(Date.now() / 1000) + 60;

    const LPMiningV2 = await hre.ethers.getContractFactory("LPMiningV2");
    const lpMiningV2 = await LPMiningV2.deploy(
        rewardTokenAddress,   // reward token
        lpTokenAddress,       // LP token
        lpStartTime           // start time
    );
    await lpMiningV2.waitForDeployment();

    const lpMiningV2Address = await lpMiningV2.getAddress();
    console.log("LPMiningV2 deployed to:", lpMiningV2Address);
    console.log("- Start time:", new Date(lpStartTime * 1000).toISOString());
    console.log("- Total rewards: 60,000,000 RWT (default in contract)");
    console.log("- Mining duration: 3 years (default in contract)");
    console.log("- Lock duration: 30 days (default in contract)");
    console.log("- Admin can transfer LP: YES");

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

    // ========== 保存部署信息 ==========
    deployment.contracts.lpMiningV2 = lpMiningV2Address;

    deployment.lpMiningV2Config = {
        startTime: lpStartTime,
        startTimeHuman: new Date(lpStartTime * 1000).toISOString(),
        rewardToken: rewardTokenAddress,
        lpToken: lpTokenAddress,
        totalRewards: "60000000.0",
        miningDurationDays: 1095,
        lockDurationDays: 30,
        adminCanTransferLP: true
    };

    deployment.tokenMiningV2 = {
        address: tokenMiningV2Address,
        stakingToken: projectTokenV2Address,
        rewardToken: projectTokenV2Address,
        startTime: startTime,
        startTimeHuman: new Date(startTime * 1000).toISOString(),
        dailyRate: "0.5%",
        apy: "182.5%",
        lockPeriod: "None (随进随出)"
    };

    deployment.lastUpdate = new Date().toISOString();

    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("\n--- Deployment info saved to:", deploymentPath);

    // ========== 输出后续操作提示 ==========
    console.log("\n========== DEPLOYMENT SUMMARY ==========");
    console.log("TokenMiningV2 (新):", tokenMiningV2Address);
    console.log("LPMiningV2 (新):", lpMiningV2Address);

    console.log("\n========== NEXT STEPS ==========");
    console.log("1. Fund TokenMiningV2 with reward tokens (3000万 ProjectTokenV2):");
    console.log(`   npx hardhat run scripts/fund-tokenMiningV2.js --network ${network}`);
    console.log("\n2. Fund LPMiningV2 with reward tokens (6000万 RewardToken):");
    console.log(`   npx hardhat run scripts/fund-lpMiningV2.js --network ${network}`);
    console.log("\n3. Update frontend constants.js with new addresses");
    console.log("\n4. Verify contracts:");
    console.log(`   npx hardhat verify --network ${network} ${tokenMiningV2Address} ${projectTokenV2Address} ${projectTokenV2Address} ${startTime}`);
    console.log(`   npx hardhat verify --network ${network} ${lpMiningV2Address} ${rewardTokenAddress} ${lpTokenAddress} ${lpStartTime}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
