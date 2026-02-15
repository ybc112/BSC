/**
 * BSC 迁移脚本 - V2 到 V3 资金迁移
 *
 * 执行步骤：
 * 1. 连接旧V2合约 0xB4089956A0b775638e8F9F2E17deaE35B102c860
 * 2. 查询V2当前状态（totalDistributed、合约AGG余额）
 * 3. 调用 emergencyWithdraw(AGG_TOKEN, 20000000e18) 取出2000万
 * 4. 调用V2的 setTotalRewards(totalDistributed + 剩余余额) 调整V2总量
 * 5. 打印摘要确认
 *
 * 注意：需由V2合约的Owner执行
 *
 * 使用方法：
 * npx hardhat run scripts/migrate-v2-to-v3.js --network bscMainnet
 */

const hre = require("hardhat");

// ============ 配置区域 ============
const CONFIG = {
    // AGG 代币地址
    AGG_TOKEN: "0xCd339aec4797790A8e387eF10035df0000d3a815",

    // 旧V2合约地址
    TOKEN_MINING_V2: "0xB4089956A0b775638e8F9F2E17deaE35B102c860",

    // 迁移金额
    MIGRATE_AMOUNT: "20000000", // 2000万 AGG
};

// 简化的V2 ABI（仅需要的函数）
const V2_ABI = [
    "function totalDistributed() view returns (uint256)",
    "function totalRewards() view returns (uint256)",
    "function totalStaked() view returns (uint256)",
    "function miningEnded() view returns (bool)",
    "function owner() view returns (address)",
    "function emergencyWithdraw(address token, uint256 amount)",
    "function setTotalRewards(uint256 _totalRewards)",
];

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const network = hre.network.name;

    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║         V2 → V3 资金迁移脚本                               ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("📍 网络:", network);
    console.log("📍 执行账户:", deployer.address);
    console.log("🪙 AGG代币:", CONFIG.AGG_TOKEN);
    console.log("📦 V2合约:", CONFIG.TOKEN_MINING_V2);
    console.log("💰 迁移金额:", CONFIG.MIGRATE_AMOUNT, "AGG");
    console.log("");

    // 连接合约
    const v2Contract = new hre.ethers.Contract(CONFIG.TOKEN_MINING_V2, V2_ABI, deployer);
    const aggToken = await hre.ethers.getContractAt("IERC20", CONFIG.AGG_TOKEN);

    // ============================================
    // 1. 查询V2当前状态
    // ============================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 [1/4] 查询V2当前状态...\n");

    const owner = await v2Contract.owner();
    const totalDistributed = await v2Contract.totalDistributed();
    const totalRewards = await v2Contract.totalRewards();
    const totalStaked = await v2Contract.totalStaked();
    const miningEnded = await v2Contract.miningEnded();
    const v2Balance = await aggToken.balanceOf(CONFIG.TOKEN_MINING_V2);

    console.log("   Owner:", owner);
    console.log("   总奖励:", hre.ethers.formatEther(totalRewards), "AGG");
    console.log("   已分发:", hre.ethers.formatEther(totalDistributed), "AGG");
    console.log("   合约AGG余额:", hre.ethers.formatEther(v2Balance), "AGG");
    console.log("   总质押:", hre.ethers.formatEther(totalStaked), "AGG");
    console.log("   挖矿状态:", miningEnded ? "已结束" : "进行中");

    // 验证Owner
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.log("\n❌ 错误：当前账户不是V2合约的Owner！");
        console.log("   当前账户:", deployer.address);
        console.log("   合约Owner:", owner);
        process.exit(1);
    }

    const migrateAmount = hre.ethers.parseEther(CONFIG.MIGRATE_AMOUNT);

    // 验证余额充足
    if (v2Balance < migrateAmount) {
        console.log("\n❌ 错误：V2合约AGG余额不足！");
        console.log("   需要:", CONFIG.MIGRATE_AMOUNT, "AGG");
        console.log("   余额:", hre.ethers.formatEther(v2Balance), "AGG");
        process.exit(1);
    }

    console.log("\n   ✅ 状态检查通过");

    // ============================================
    // 2. 从V2取出2000万AGG
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💸 [2/4] 从V2合约取出", CONFIG.MIGRATE_AMOUNT, "AGG...");

    const deployerBalanceBefore = await aggToken.balanceOf(deployer.address);

    let tx = await v2Contract.emergencyWithdraw(CONFIG.AGG_TOKEN, migrateAmount);
    await tx.wait();

    const deployerBalanceAfter = await aggToken.balanceOf(deployer.address);
    const received = deployerBalanceAfter - deployerBalanceBefore;

    console.log("   ✅ 已取出:", hre.ethers.formatEther(received), "AGG");
    console.log("   部署者AGG余额:", hre.ethers.formatEther(deployerBalanceAfter), "AGG");

    // ============================================
    // 3. 调整V2总奖励
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔧 [3/4] 调整V2总奖励...");

    const v2BalanceAfter = await aggToken.balanceOf(CONFIG.TOKEN_MINING_V2);
    // 新的 totalRewards = 已分发 + V2合约剩余AGG余额（扣除用户质押的部分，但totalRewards只控制奖励分发）
    const newTotalRewards = totalDistributed + v2BalanceAfter - totalStaked;

    console.log("   已分发:", hre.ethers.formatEther(totalDistributed), "AGG");
    console.log("   V2剩余余额:", hre.ethers.formatEther(v2BalanceAfter), "AGG");
    console.log("   用户质押:", hre.ethers.formatEther(totalStaked), "AGG");
    console.log("   新总奖励:", hre.ethers.formatEther(newTotalRewards), "AGG");

    tx = await v2Contract.setTotalRewards(newTotalRewards);
    await tx.wait();

    console.log("   ✅ V2总奖励已调整");

    // ============================================
    // 4. 打印摘要
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 [4/4] 迁移摘要\n");

    const v2FinalBalance = await aggToken.balanceOf(CONFIG.TOKEN_MINING_V2);
    const v2FinalTotalRewards = await v2Contract.totalRewards();

    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║                    🎉 迁移完成！                            ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("📊 V2 合约最终状态：");
    console.log("┌─────────────────────────────────────────────────────────────┐");
    console.log("│ 总奖励:     ", hre.ethers.formatEther(v2FinalTotalRewards), "AGG");
    console.log("│ 已分发:     ", hre.ethers.formatEther(totalDistributed), "AGG");
    console.log("│ 合约余额:   ", hre.ethers.formatEther(v2FinalBalance), "AGG");
    console.log("│ 用户质押:   ", hre.ethers.formatEther(totalStaked), "AGG");
    console.log("└─────────────────────────────────────────────────────────────┘");

    console.log("\n📊 部署者AGG余额:", hre.ethers.formatEther(deployerBalanceAfter), "AGG");
    console.log("   （可用于充值V3合约）");

    console.log("\n📝 下一步操作：");
    console.log("   1. 运行 deploy-token-mining-v3.js 部署V3合约");
    console.log("   2. 或手动将", CONFIG.MIGRATE_AMOUNT, "AGG 转入V3合约地址");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 迁移失败:", error);
        process.exit(1);
    });
