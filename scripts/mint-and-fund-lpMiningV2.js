const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    const rewardTokenAddress = '0x57E9cBF035776321F2A0d4AE74785FB56bD48e1B';
    const newLpMiningV2 = '0x7e9eDd989522F6f24dF47a6B9BFA9a04F9c6CE14';

    console.log("========================================");
    console.log("为 LPMiningV2 Mint 并充值奖励代币");
    console.log("========================================\n");

    const token = await hre.ethers.getContractAt('MockToken', rewardTokenAddress);

    // 检查当前余额
    const currentBalance = await token.balanceOf(newLpMiningV2);
    console.log("LPMiningV2 当前余额:", hre.ethers.formatEther(currentBalance));

    // 需要 6000万 代币
    const amountNeeded = hre.ethers.parseEther("60000000");
    const amountToMint = amountNeeded - currentBalance;

    if (amountToMint <= 0) {
        console.log("LPMiningV2 已有足够余额，无需 mint");
        return;
    }

    console.log("需要 mint 数量:", hre.ethers.formatEther(amountToMint));

    // Mint 代币到 deployer
    console.log("\n正在 mint 代币...");
    const mintTx = await token.mint(deployer.address, amountToMint);
    await mintTx.wait();
    console.log("Mint 成功! Tx:", mintTx.hash);

    // 转入 LPMiningV2
    console.log("\n正在转入 LPMiningV2...");
    const transferTx = await token.transfer(newLpMiningV2, amountToMint);
    await transferTx.wait();
    console.log("转入成功! Tx:", transferTx.hash);

    // 验证最终余额
    const newBalance = await token.balanceOf(newLpMiningV2);
    console.log("\nLPMiningV2 新余额:", hre.ethers.formatEther(newBalance));

    console.log("\n========================================");
    console.log("完成！LPMiningV2 已充值 6000万 RWT");
    console.log("========================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("错误:", error);
        process.exit(1);
    });
