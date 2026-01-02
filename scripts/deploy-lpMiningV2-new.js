const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying LPMiningV2 with account:", deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB");

    const network = hre.network.name;

    // 读取现有部署信息
    const deploymentPath = path.join(__dirname, "../deployments", `${network}.json`);
    let deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    const lpTokenAddress = deployment.contracts?.lpToken;
    const rewardTokenAddress = deployment.contracts?.rewardToken;

    console.log("\n========== EXISTING CONTRACTS ==========");
    console.log("LP Token:", lpTokenAddress);
    console.log("Reward Token:", rewardTokenAddress);

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
    console.log("\nLPMiningV2 deployed to:", lpMiningV2Address);
    console.log("- Start time:", new Date(lpStartTime * 1000).toISOString());
    console.log("- Total rewards: 60,000,000 RWT");
    console.log("- Mining duration: 3 years");
    console.log("- Lock duration: 30 days");
    console.log("- Admin can transfer LP: YES");

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

    deployment.lastUpdate = new Date().toISOString();

    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("\n--- Deployment info saved ---");

    console.log("\n========== NEXT STEPS ==========");
    console.log("1. Fund LPMiningV2 with reward tokens:");
    console.log(`   npx hardhat run scripts/fund-lpMiningV2.js --network ${network}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
