/**
 * BSC 部署脚本 - TokenMiningV3 (代币质押挖矿 + 推荐奖励)
 *
 * 部署内容：
 * 1. TokenMiningV3 (多档锁仓挖矿 + 推荐奖励)
 * 2. 设置推荐奖励代数和比例
 * 3. 充值奖励代币
 * 4. 转移 Owner 权限
 *
 * 使用方法：
 * npx hardhat run scripts/deploy-token-mining-v3.js --network bscMainnet
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ============ 配置区域 ============
const CONFIG = {
    // AGG 代币地址（已部署）
    AGG_TOKEN: "0xCd339aec4797790A8e387eF10035df0000d3a815",

    // 最终 Owner 地址
    FINAL_OWNER: "0x4277EF1F274D6146229D2501F2e2A6ecc26f2789",

    // 挖矿开始时间（0 = 部署后5分钟开始）
    START_TIME_DELAY: 300,

    // 奖励代币数量
    TOKEN_MINING_REWARDS: "20000000",  // 2000万（从V2迁移）

    // 推荐奖励配置（基数10000）
    // 示例：3代推荐 10%, 8%, 5%
    // 可配置最多20代
    REFERRAL_RATES: [1000, 800, 500],  // 1代10%, 2代8%, 3代5%
};

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const network = hre.network.name;

    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║       TokenMiningV3 部署脚本 (质押挖矿 + 推荐奖励)          ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("📍 网络:", network);
    console.log("📍 部署账户:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 账户余额:", hre.ethers.formatEther(balance), "BNB");
    console.log("🎯 最终Owner:", CONFIG.FINAL_OWNER);
    console.log("🪙 AGG代币:", CONFIG.AGG_TOKEN);
    console.log("");

    if (parseFloat(hre.ethers.formatEther(balance)) < 0.05) {
        console.log("⚠️  警告：余额可能不足，建议至少准备 0.05 BNB");
        console.log("   继续部署? 按 Ctrl+C 取消，或等待 5 秒继续...");
        await new Promise(r => setTimeout(r, 5000));
    }

    const startTime = Math.floor(Date.now() / 1000) + CONFIG.START_TIME_DELAY;
    console.log("⏰ 挖矿开始时间:", new Date(startTime * 1000).toLocaleString());
    console.log("");

    const deployment = {
        network: network,
        chainId: network === "bscMainnet" ? 56 : 97,
        deployer: deployer.address,
        finalOwner: CONFIG.FINAL_OWNER,
        deployTime: new Date().toISOString(),
        contracts: {},
    };

    // ============================================
    // 1. 部署 TokenMiningV3
    // ============================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 [1/4] 部署 TokenMiningV3...");

    const TokenMiningV3 = await hre.ethers.getContractFactory("TokenMiningV3");
    const tokenMiningV3 = await TokenMiningV3.deploy(
        CONFIG.AGG_TOKEN,  // 质押代币
        CONFIG.AGG_TOKEN,  // 奖励代币
        startTime
    );
    await tokenMiningV3.waitForDeployment();
    const tokenMiningV3Address = await tokenMiningV3.getAddress();

    console.log("   ✅ TokenMiningV3 地址:", tokenMiningV3Address);
    console.log("   📊 质押/奖励代币:", CONFIG.AGG_TOKEN);
    console.log("   📊 开始时间:", new Date(startTime * 1000).toISOString());
    console.log("   📊 档位配置:");
    console.log("      - 随进随出: 0.4%/天");
    console.log("      - 3个月锁仓: 0.6%/天");
    console.log("      - 6个月锁仓: 0.8%/天");
    console.log("      - 12个月锁仓: 1.0%/天");

    deployment.contracts.tokenMiningV3 = tokenMiningV3Address;

    // ============================================
    // 2. 设置推荐奖励比例
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔧 [2/4] 设置推荐奖励比例...");

    let tx = await tokenMiningV3.setReferralRates(CONFIG.REFERRAL_RATES);
    await tx.wait();

    console.log("   ✅ 推荐奖励已配置:");
    for (let i = 0; i < CONFIG.REFERRAL_RATES.length; i++) {
        const pct = (CONFIG.REFERRAL_RATES[i] / 100).toFixed(1);
        console.log(`      - ${i + 1}代推荐: ${pct}%`);
    }

    deployment.referralConfig = {
        levels: CONFIG.REFERRAL_RATES.length,
        rates: CONFIG.REFERRAL_RATES,
    };

    // ============================================
    // 2.5 设置总奖励为2000万（合约构造函数硬编码了3000万）
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔧 [2.5] 设置总奖励为2000万...");

    const newTotalRewards = hre.ethers.parseEther("20000000");
    tx = await tokenMiningV3.setTotalRewards(newTotalRewards);
    await tx.wait();
    console.log("   ✅ 总奖励已设置为 20,000,000 AGG");

    // ============================================
    // 3. 充值奖励代币
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💸 [3/4] 充值奖励代币...");

    const aggToken = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", CONFIG.AGG_TOKEN);
    const deployerBalance = await aggToken.balanceOf(deployer.address);
    console.log("   📊 部署者AGG余额:", hre.ethers.formatEther(deployerBalance));

    const tokenMiningRewards = hre.ethers.parseEther(CONFIG.TOKEN_MINING_REWARDS);
    if (deployerBalance >= tokenMiningRewards) {
        tx = await aggToken.transfer(tokenMiningV3Address, tokenMiningRewards);
        await tx.wait();
        console.log("   ✅ 已转入", CONFIG.TOKEN_MINING_REWARDS, "AGG到 TokenMiningV3");
    } else {
        console.log("   ⚠️  AGG余额不足，请手动充值", CONFIG.TOKEN_MINING_REWARDS, "AGG到合约");
        console.log("   📍 合约地址:", tokenMiningV3Address);
    }

    // ============================================
    // 4. 转移 Owner 权限
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔑 [4/4] 转移 Owner 权限到:", CONFIG.FINAL_OWNER);

    tx = await tokenMiningV3.transferOwnership(CONFIG.FINAL_OWNER);
    await tx.wait();
    console.log("   ✅ TokenMiningV3 Owner 已转移");

    // ============================================
    // 保存部署信息
    // ============================================
    const deploymentPath = path.join(__dirname, "../deployments");
    fs.mkdirSync(deploymentPath, { recursive: true });

    const chainId = network === "bscMainnet" ? 56 : 97;
    const filename = `tokenMiningV3-${chainId}.json`;
    fs.writeFileSync(
        path.join(deploymentPath, filename),
        JSON.stringify(deployment, null, 2)
    );

    // ============================================
    // 输出总结
    // ============================================
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║                    🎉 部署完成！                            ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("📋 合约地址：");
    console.log("┌─────────────────────────────────────────────────────────────┐");
    console.log("│ TokenMiningV3: ", tokenMiningV3Address);
    console.log("│ AGG Token:     ", CONFIG.AGG_TOKEN);
    console.log("│ Final Owner:   ", CONFIG.FINAL_OWNER);
    console.log("└─────────────────────────────────────────────────────────────┘");

    console.log("\n⏰ 挖矿开始时间:", new Date(startTime * 1000).toLocaleString());
    console.log("📁 部署信息已保存到: ./deployments/" + filename);

    const explorer = network === "bscMainnet" ? "https://bscscan.com" : "https://testnet.bscscan.com";
    console.log(`\n🔗 区块浏览器: ${explorer}/address/${tokenMiningV3Address}`);

    console.log("\n📝 合约验证命令：");
    console.log(`npx hardhat verify --network ${network} ${tokenMiningV3Address} ${CONFIG.AGG_TOKEN} ${CONFIG.AGG_TOKEN} ${startTime}`);

    console.log("\n📝 白名单设置（需要用ProjectTokenV2 Owner执行）：");
    console.log(`   projectTokenV2.setExcludedFromFee("${tokenMiningV3Address}", true)`);

    console.log("\n✅ Owner 已转移到:", CONFIG.FINAL_OWNER);
    console.log("   后续可通过 Owner 调用 setReferralRates() 修改推荐奖励配置\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 部署失败:", error);
        process.exit(1);
    });
