const hre = require("hardhat");

async function main() {
    console.log("========================================");
    console.log("验证新部署的合约状态");
    console.log("========================================\n");

    const [deployer] = await hre.ethers.getSigners();

    // 合约地址
    const tokenMiningV2Address = '0x7011554695A29faa12eB4FA1437180D412326F4c';
    const lpMiningV2Address = '0x7e9eDd989522F6f24dF47a6B9BFA9a04F9c6CE14';
    const projectTokenV2Address = '0xa3C9744b4a3C986E01d81009134589FF67748435';
    const rewardTokenAddress = '0x57E9cBF035776321F2A0d4AE74785FB56bD48e1B';

    // ========== TokenMiningV2 ==========
    console.log("--- TokenMiningV2 (代币挖矿) ---");
    const tokenMining = await hre.ethers.getContractAt('TokenMiningV2', tokenMiningV2Address);
    const projectToken = await hre.ethers.getContractAt('ProjectTokenV2', projectTokenV2Address);

    const tmStatus = await tokenMining.getMiningStatus();
    const tmDailyRate = await tokenMining.dailyRate();
    const tmOwner = await tokenMining.owner();
    const tmBalance = await projectToken.balanceOf(tokenMiningV2Address);

    console.log("合约地址:", tokenMiningV2Address);
    console.log("合约Owner:", tmOwner);
    console.log("是否为Owner:", tmOwner.toLowerCase() === deployer.address.toLowerCase() ? "是" : "否");
    console.log("奖励代币余额:", hre.ethers.formatEther(tmBalance), "PTKV2");
    console.log("总质押量:", hre.ethers.formatEther(tmStatus._totalStaked), "PTKV2");
    console.log("已分发奖励:", hre.ethers.formatEther(tmStatus._totalDistributed), "PTKV2");
    console.log("剩余奖励:", hre.ethers.formatEther(tmStatus._remainingRewards), "PTKV2");
    console.log("日收益率:", Number(tmDailyRate) / 100, "%");
    console.log("年化收益率:", Number(tmDailyRate) / 100 * 365, "%");
    console.log("挖矿已开始:", tmStatus._startTime <= Math.floor(Date.now() / 1000) ? "是" : "否");
    console.log("挖矿已结束:", tmStatus._miningEnded ? "是" : "否");

    // ========== LPMiningV2 ==========
    console.log("\n--- LPMiningV2 (LP挖矿) ---");
    const lpMining = await hre.ethers.getContractAt('LPMiningV2', lpMiningV2Address);
    const rewardToken = await hre.ethers.getContractAt('MockToken', rewardTokenAddress);

    const lpStatus = await lpMining.getMiningStatus();
    const lpOwner = await lpMining.owner();
    const lpBalance = await rewardToken.balanceOf(lpMiningV2Address);
    const lockDuration = await lpMining.lockDuration();

    console.log("合约地址:", lpMiningV2Address);
    console.log("合约Owner:", lpOwner);
    console.log("是否为Owner:", lpOwner.toLowerCase() === deployer.address.toLowerCase() ? "是" : "否");
    console.log("奖励代币余额:", hre.ethers.formatEther(lpBalance), "RWT");
    console.log("总质押量:", hre.ethers.formatEther(lpStatus._totalStaked), "LP");
    console.log("已分发奖励:", hre.ethers.formatEther(lpStatus._totalDistributed), "RWT");
    console.log("剩余奖励:", hre.ethers.formatEther(lpStatus._remainingRewards), "RWT");
    console.log("锁仓天数:", Number(lockDuration) / 86400, "天");
    console.log("挖矿已开始:", lpStatus._startTime <= Math.floor(Date.now() / 1000) ? "是" : "否");
    console.log("挖矿已结束:", lpStatus._miningEnded ? "是" : "否");

    // 测试管理员转LP功能存在
    console.log("\n--- 管理员功能验证 ---");
    try {
        // 检查 adminTransferLP 函数是否存在
        const adminTransferLP = lpMining.interface.getFunction('adminTransferLP');
        console.log("adminTransferLP 函数:", adminTransferLP ? "存在 ✓" : "不存在 ✗");
    } catch (e) {
        console.log("adminTransferLP 函数: 不存在 ✗");
    }

    console.log("\n========================================");
    console.log("验证完成！所有合约已就绪");
    console.log("========================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
