/**
 * 预估主网部署 Gas 费用
 */

const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║              BSC 主网部署 Gas 费用预估                       ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("📍 部署账户:", deployer.address);

    // 获取当前 Gas 价格
    const feeData = await hre.ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    console.log("⛽ 当前 Gas 价格:", hre.ethers.formatUnits(gasPrice, "gwei"), "Gwei\n");

    // 预估各合约部署 Gas
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 合约部署 Gas 预估：");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    let totalGas = 0n;

    // 1. ProjectTokenV2
    try {
        const ProjectTokenV2 = await hre.ethers.getContractFactory("ProjectTokenV2");
        const deployTx1 = await ProjectTokenV2.getDeployTransaction(
            "AGG",
            "AGG",
            "0x4277EF1F274D6146229D2501F2e2A6ecc26f2789"
        );
        const gas1 = await hre.ethers.provider.estimateGas({
            ...deployTx1,
            from: deployer.address
        });
        const cost1 = gas1 * gasPrice;
        totalGas += gas1;
        console.log("1. ProjectTokenV2 (AGG代币)");
        console.log("   Gas:", gas1.toString());
        console.log("   费用:", hre.ethers.formatEther(cost1), "BNB\n");
    } catch (e) {
        console.log("1. ProjectTokenV2: 预估失败 -", e.message, "\n");
    }

    // 2. TokenMiningV2
    try {
        const TokenMiningV2 = await hre.ethers.getContractFactory("TokenMiningV2");
        const startTime = Math.floor(Date.now() / 1000) + 300;
        const dummyToken = "0x0000000000000000000000000000000000000001";
        const deployTx2 = await TokenMiningV2.getDeployTransaction(
            dummyToken,
            dummyToken,
            startTime
        );
        const gas2 = await hre.ethers.provider.estimateGas({
            ...deployTx2,
            from: deployer.address
        });
        const cost2 = gas2 * gasPrice;
        totalGas += gas2;
        console.log("2. TokenMiningV2 (代币挖矿)");
        console.log("   Gas:", gas2.toString());
        console.log("   费用:", hre.ethers.formatEther(cost2), "BNB\n");
    } catch (e) {
        console.log("2. TokenMiningV2: 预估失败 -", e.message, "\n");
    }

    // 3. LPMiningV2
    try {
        const LPMiningV2 = await hre.ethers.getContractFactory("LPMiningV2");
        const startTime = Math.floor(Date.now() / 1000) + 300;
        const dummyToken = "0x0000000000000000000000000000000000000001";
        const deployTx3 = await LPMiningV2.getDeployTransaction(
            dummyToken,
            dummyToken,
            startTime
        );
        const gas3 = await hre.ethers.provider.estimateGas({
            ...deployTx3,
            from: deployer.address
        });
        const cost3 = gas3 * gasPrice;
        totalGas += gas3;
        console.log("3. LPMiningV2 (LP挖矿) [本次不部署]");
        console.log("   Gas:", gas3.toString());
        console.log("   费用:", hre.ethers.formatEther(cost3), "BNB\n");
    } catch (e) {
        console.log("3. LPMiningV2: 预估失败 -", e.message, "\n");
    }

    // 额外操作预估
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔧 额外操作 Gas 预估（固定值）：");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const extraOps = [
        { name: "setExcludedFromFee (白名单)", gas: 50000n },
        { name: "transfer (充值奖励)", gas: 65000n },
        { name: "transferOwnership (转移权限)", gas: 30000n },
    ];

    let extraGas = 0n;
    extraOps.forEach(op => {
        // 每个操作可能执行多次
        const times = op.name.includes("transfer") ? 2n : 3n;
        const totalOpGas = op.gas * times;
        extraGas += totalOpGas;
        console.log(`${op.name} x${times}`);
        console.log("   Gas:", totalOpGas.toString());
        console.log("   费用:", hre.ethers.formatEther(totalOpGas * gasPrice), "BNB\n");
    });

    // 汇总
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 费用汇总：");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // 本次部署（不含 LPMiningV2）
    const deployGasWithoutLP = totalGas - (totalGas / 3n); // 大约去掉 LP 部分
    const totalGasThisTime = deployGasWithoutLP + extraGas;
    const totalCostThisTime = totalGasThisTime * gasPrice;

    console.log("本次部署（ProjectTokenV2 + TokenMiningV2 + 配置操作）:");
    console.log("   总 Gas:", totalGasThisTime.toString());
    console.log("   总费用:", hre.ethers.formatEther(totalCostThisTime), "BNB");
    console.log("   建议准备:", hre.ethers.formatEther(totalCostThisTime * 15n / 10n), "BNB (1.5倍余量)\n");

    // 全部部署
    const totalGasAll = totalGas + extraGas;
    const totalCostAll = totalGasAll * gasPrice;

    console.log("全部部署（含 LPMiningV2）:");
    console.log("   总 Gas:", totalGasAll.toString());
    console.log("   总费用:", hre.ethers.formatEther(totalCostAll), "BNB");
    console.log("   建议准备:", hre.ethers.formatEther(totalCostAll * 15n / 10n), "BNB (1.5倍余量)\n");

    // 当前余额
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💰 当前钱包余额:", hre.ethers.formatEther(balance), "BNB");

    if (balance >= totalCostThisTime * 15n / 10n) {
        console.log("✅ 余额充足，可以部署！");
    } else {
        const needed = totalCostThisTime * 15n / 10n - balance;
        console.log("⚠️  余额不足！还需充值:", hre.ethers.formatEther(needed), "BNB");
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("预估失败:", error);
        process.exit(1);
    });
