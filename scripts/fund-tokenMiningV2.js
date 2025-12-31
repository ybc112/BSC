const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Funding with account:", deployer.address);

    const network = hre.network.name;

    // 读取部署信息
    const deploymentPath = path.join(__dirname, "../deployments", `${network}.json`);
    if (!fs.existsSync(deploymentPath)) {
        throw new Error("Deployment file not found. Please deploy contracts first.");
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    if (!deployment.tokenMiningV2 || !deployment.projectTokenV2) {
        throw new Error("TokenMiningV2 or ProjectTokenV2 not deployed. Please run deploy-v2-contracts.js first.");
    }

    const tokenAddress = deployment.projectTokenV2.address;
    const miningAddress = deployment.tokenMiningV2.address;

    console.log("ProjectTokenV2 address:", tokenAddress);
    console.log("TokenMiningV2 address:", miningAddress);

    // 获取合约实例
    const token = await hre.ethers.getContractAt("ProjectTokenV2", tokenAddress);
    const mining = await hre.ethers.getContractAt("TokenMiningV2", miningAddress);

    // 获取总奖励量
    const totalRewards = await mining.totalRewards();
    console.log("Total rewards needed:", hre.ethers.formatEther(totalRewards), "tokens");

    // 检查当前余额
    const currentBalance = await token.balanceOf(miningAddress);
    console.log("Current mining contract balance:", hre.ethers.formatEther(currentBalance), "tokens");

    const deployerBalance = await token.balanceOf(deployer.address);
    console.log("Deployer balance:", hre.ethers.formatEther(deployerBalance), "tokens");

    // 计算需要转入的数量
    const needed = totalRewards - currentBalance;
    if (needed <= 0) {
        console.log("Mining contract already has enough tokens!");
        return;
    }

    console.log("Need to transfer:", hre.ethers.formatEther(needed), "tokens");

    if (deployerBalance < needed) {
        console.log("WARNING: Deployer doesn't have enough tokens!");
        console.log("Will transfer all available:", hre.ethers.formatEther(deployerBalance), "tokens");
    }

    // 转入代币
    const transferAmount = deployerBalance < needed ? deployerBalance : needed;
    console.log("\nTransferring", hre.ethers.formatEther(transferAmount), "tokens to TokenMiningV2...");

    const tx = await token.transfer(miningAddress, transferAmount);
    await tx.wait();

    console.log("Transfer successful! Tx:", tx.hash);

    // 验证余额
    const newBalance = await token.balanceOf(miningAddress);
    console.log("New mining contract balance:", hre.ethers.formatEther(newBalance), "tokens");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
