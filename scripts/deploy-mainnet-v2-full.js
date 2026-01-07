/**
 * BSC 主网完整部署脚本 - V2 版本
 *
 * 部署内容：
 * 1. ProjectTokenV2 (带滑点代币)
 * 2. TokenMiningV2 (多档锁仓挖矿)
 * 3. LPMiningV2 (LP质押挖矿)
 * 4. 自动设置白名单
 * 5. 自动充值奖励代币
 * 6. 转移 Owner 权限
 *
 * 使用方法：
 * npx hardhat run scripts/deploy-mainnet-v2-full.js --network bscMainnet
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ============ 配置区域 ============
const CONFIG = {
    // 代币信息
    TOKEN_NAME: "AGG",
    TOKEN_SYMBOL: "AGG",

    // Fee 接收地址（卖出滑点2.8%的接收地址）
    FEE_RECEIVER: "0x4277EF1F274D6146229D2501F2e2A6ecc26f2789",

    // 最终 Owner 地址（所有合约的管理权限将转移到此地址）
    FINAL_OWNER: "0x4277EF1F274D6146229D2501F2e2A6ecc26f2789",

    // LP Token 地址（如果已有，填入；如果还没创建流动性，留空）
    // 留空则跳过 LPMiningV2 部署，后续单独部署
    LP_TOKEN_ADDRESS: "",

    // 挖矿开始时间（0 = 部署后5分钟开始）
    START_TIME_DELAY: 300, // 秒，默认5分钟后

    // 奖励代币数量
    TOKEN_MINING_REWARDS: "30000000",  // 3000万
    LP_MINING_REWARDS: "60000000",     // 6000万

    // LP挖矿分流地址配置（35%部分的分配）
    SPLIT_ADDRESSES: [
        "0x4277EF1F274D6146229D2501F2e2A6ecc26f2789", // 地址1
    ],
    SPLIT_RATES: [10000], // 100% (基数10000)

    // 锁仓天数
    LP_LOCK_DAYS: 30,
};

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const network = hre.network.name;

    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║          BSC 主网部署脚本 - V2 完整版                        ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("📍 网络:", network);
    console.log("📍 部署账户:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 账户余额:", hre.ethers.formatEther(balance), "BNB");
    console.log("🎯 最终Owner:", CONFIG.FINAL_OWNER);
    console.log("");

    // 检查余额
    if (parseFloat(hre.ethers.formatEther(balance)) < 0.1) {
        console.log("⚠️  警告：余额可能不足，建议至少准备 0.1 BNB");
        console.log("   继续部署? 按 Ctrl+C 取消，或等待 5 秒继续...");
        await new Promise(r => setTimeout(r, 5000));
    }

    // 计算开始时间
    const startTime = Math.floor(Date.now() / 1000) + CONFIG.START_TIME_DELAY;
    console.log("⏰ 挖矿开始时间:", new Date(startTime * 1000).toLocaleString());
    console.log("");

    // 部署结果
    const deployment = {
        network: network,
        chainId: network === "bscMainnet" ? 56 : 97,
        deployer: deployer.address,
        finalOwner: CONFIG.FINAL_OWNER,
        deployTime: new Date().toISOString(),
        contracts: {},
    };

    // ============================================
    // 1. 部署 ProjectTokenV2
    // ============================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 [1/6] 部署 ProjectTokenV2 (带滑点代币)...");

    const ProjectTokenV2 = await hre.ethers.getContractFactory("ProjectTokenV2");
    const projectTokenV2 = await ProjectTokenV2.deploy(
        CONFIG.TOKEN_NAME,
        CONFIG.TOKEN_SYMBOL,
        CONFIG.FEE_RECEIVER
    );
    await projectTokenV2.waitForDeployment();
    const projectTokenV2Address = await projectTokenV2.getAddress();

    console.log("   ✅ ProjectTokenV2 地址:", projectTokenV2Address);
    console.log("   📊 名称:", CONFIG.TOKEN_NAME);
    console.log("   📊 符号:", CONFIG.TOKEN_SYMBOL);
    console.log("   📊 总量: 100,000,000");
    console.log("   📊 买入滑点: 0%");
    console.log("   📊 卖出滑点: 2.8%");
    console.log("   📊 Fee接收地址:", CONFIG.FEE_RECEIVER);

    deployment.contracts.projectTokenV2 = projectTokenV2Address;
    deployment.projectTokenV2Config = {
        name: CONFIG.TOKEN_NAME,
        symbol: CONFIG.TOKEN_SYMBOL,
        totalSupply: "100000000",
        buyFee: "0%",
        sellFee: "2.8%",
        feeReceiver: CONFIG.FEE_RECEIVER,
    };

    // ============================================
    // 2. 部署 TokenMiningV2
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 [2/6] 部署 TokenMiningV2 (多档锁仓挖矿)...");

    const TokenMiningV2 = await hre.ethers.getContractFactory("TokenMiningV2");
    const tokenMiningV2 = await TokenMiningV2.deploy(
        projectTokenV2Address,  // 质押代币
        projectTokenV2Address,  // 奖励代币
        startTime
    );
    await tokenMiningV2.waitForDeployment();
    const tokenMiningV2Address = await tokenMiningV2.getAddress();

    console.log("   ✅ TokenMiningV2 地址:", tokenMiningV2Address);
    console.log("   📊 质押/奖励代币:", projectTokenV2Address);
    console.log("   📊 开始时间:", new Date(startTime * 1000).toISOString());
    console.log("   📊 档位配置:");
    console.log("      - 随进随出: 0.4%/天 (APY 146%)");
    console.log("      - 3个月锁仓: 0.6%/天 (APY 219%)");
    console.log("      - 6个月锁仓: 0.8%/天 (APY 292%)");
    console.log("      - 12个月锁仓: 1.0%/天 (APY 365%)");

    deployment.contracts.tokenMiningV2 = tokenMiningV2Address;
    deployment.tokenMiningV2Config = {
        stakingToken: projectTokenV2Address,
        rewardToken: projectTokenV2Address,
        startTime: startTime,
        totalRewards: CONFIG.TOKEN_MINING_REWARDS,
    };

    // ============================================
    // 3. 部署 LPMiningV2（如果有LP Token）
    // ============================================
    let lpMiningV2Address = null;

    if (CONFIG.LP_TOKEN_ADDRESS) {
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📦 [3/6] 部署 LPMiningV2 (LP质押挖矿)...");

        const LPMiningV2 = await hre.ethers.getContractFactory("LPMiningV2");
        const lpMiningV2 = await LPMiningV2.deploy(
            projectTokenV2Address,     // 奖励代币
            CONFIG.LP_TOKEN_ADDRESS,   // LP代币
            startTime
        );
        await lpMiningV2.waitForDeployment();
        lpMiningV2Address = await lpMiningV2.getAddress();

        console.log("   ✅ LPMiningV2 地址:", lpMiningV2Address);
        console.log("   📊 奖励代币:", projectTokenV2Address);
        console.log("   📊 LP代币:", CONFIG.LP_TOKEN_ADDRESS);

        deployment.contracts.lpMiningV2 = lpMiningV2Address;
        deployment.lpMiningV2Config = {
            rewardToken: projectTokenV2Address,
            lpToken: CONFIG.LP_TOKEN_ADDRESS,
            startTime: startTime,
            totalRewards: CONFIG.LP_MINING_REWARDS,
            lockDays: CONFIG.LP_LOCK_DAYS,
        };
    } else {
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("⏭️  [3/6] 跳过 LPMiningV2 部署（未提供LP Token地址）");
        console.log("   📝 请先在 PancakeSwap 创建流动性池，然后单独部署 LPMiningV2");
    }

    // ============================================
    // 4. 设置白名单（免滑点）
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔧 [4/6] 设置白名单（免滑点）...");

    // TokenMiningV2 加入白名单
    let tx = await projectTokenV2.setExcludedFromFee(tokenMiningV2Address, true);
    await tx.wait();
    console.log("   ✅ TokenMiningV2 已加入白名单");

    // LPMiningV2 加入白名单（如果部署了）
    if (lpMiningV2Address) {
        tx = await projectTokenV2.setExcludedFromFee(lpMiningV2Address, true);
        await tx.wait();
        console.log("   ✅ LPMiningV2 已加入白名单");
    }

    // Final Owner 加入白名单
    tx = await projectTokenV2.setExcludedFromFee(CONFIG.FINAL_OWNER, true);
    await tx.wait();
    console.log("   ✅ Final Owner 已加入白名单");

    // ============================================
    // 5. 充值奖励代币
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💸 [5/6] 充值奖励代币...");

    const tokenMiningRewards = hre.ethers.parseEther(CONFIG.TOKEN_MINING_REWARDS);
    const deployerBalance = await projectTokenV2.balanceOf(deployer.address);
    console.log("   📊 部署者代币余额:", hre.ethers.formatEther(deployerBalance));

    // 充值 TokenMiningV2
    tx = await projectTokenV2.transfer(tokenMiningV2Address, tokenMiningRewards);
    await tx.wait();
    console.log("   ✅ 已转入", CONFIG.TOKEN_MINING_REWARDS, "代币到 TokenMiningV2");

    // 充值 LPMiningV2（如果部署了）
    if (lpMiningV2Address) {
        const lpMiningRewards = hre.ethers.parseEther(CONFIG.LP_MINING_REWARDS);
        tx = await projectTokenV2.transfer(lpMiningV2Address, lpMiningRewards);
        await tx.wait();
        console.log("   ✅ 已转入", CONFIG.LP_MINING_REWARDS, "代币到 LPMiningV2");

        // 设置分流地址
        if (CONFIG.SPLIT_ADDRESSES.length > 0) {
            const LPMiningV2 = await hre.ethers.getContractFactory("LPMiningV2");
            const lpMining = LPMiningV2.attach(lpMiningV2Address);
            tx = await lpMining.setSplitAddresses(CONFIG.SPLIT_ADDRESSES, CONFIG.SPLIT_RATES);
            await tx.wait();
            console.log("   ✅ 已设置分流地址");
        }
    }

    // ============================================
    // 6. 转移 Owner 权限
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔑 [6/6] 转移 Owner 权限到:", CONFIG.FINAL_OWNER);

    // 转移 ProjectTokenV2 Owner
    tx = await projectTokenV2.transferOwnership(CONFIG.FINAL_OWNER);
    await tx.wait();
    console.log("   ✅ ProjectTokenV2 Owner 已转移");

    // 转移 TokenMiningV2 Owner
    const TokenMiningV2Contract = await hre.ethers.getContractFactory("TokenMiningV2");
    const tokenMining = TokenMiningV2Contract.attach(tokenMiningV2Address);
    tx = await tokenMining.transferOwnership(CONFIG.FINAL_OWNER);
    await tx.wait();
    console.log("   ✅ TokenMiningV2 Owner 已转移");

    // 转移 LPMiningV2 Owner（如果部署了）
    if (lpMiningV2Address) {
        const LPMiningV2Contract = await hre.ethers.getContractFactory("LPMiningV2");
        const lpMining = LPMiningV2Contract.attach(lpMiningV2Address);
        tx = await lpMining.transferOwnership(CONFIG.FINAL_OWNER);
        await tx.wait();
        console.log("   ✅ LPMiningV2 Owner 已转移");
    }

    // ============================================
    // 保存部署信息
    // ============================================
    const deploymentPath = path.join(__dirname, "../deployments");
    fs.mkdirSync(deploymentPath, { recursive: true });

    const filename = network === "bscMainnet" ? "bscMainnet.json" : "bscTestnet-v2.json";
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

    console.log("📋 合约地址汇总：");
    console.log("┌─────────────────────────────────────────────────────────────┐");
    console.log("│ ProjectTokenV2: ", projectTokenV2Address);
    console.log("│ TokenMiningV2:  ", tokenMiningV2Address);
    if (lpMiningV2Address) {
        console.log("│ LPMiningV2:     ", lpMiningV2Address);
    }
    console.log("│ Final Owner:    ", CONFIG.FINAL_OWNER);
    console.log("└─────────────────────────────────────────────────────────────┘");

    console.log("\n⏰ 挖矿开始时间:", new Date(startTime * 1000).toLocaleString());
    console.log("📁 部署信息已保存到: ./deployments/" + filename);

    // BscScan 链接
    const explorer = network === "bscMainnet" ? "https://bscscan.com" : "https://testnet.bscscan.com";
    console.log("\n🔗 区块浏览器链接：");
    console.log(`   ProjectTokenV2: ${explorer}/address/${projectTokenV2Address}`);
    console.log(`   TokenMiningV2:  ${explorer}/address/${tokenMiningV2Address}`);
    if (lpMiningV2Address) {
        console.log(`   LPMiningV2:     ${explorer}/address/${lpMiningV2Address}`);
    }

    // 验证命令
    console.log("\n📝 合约验证命令：");
    console.log(`npx hardhat verify --network ${network} ${projectTokenV2Address} "${CONFIG.TOKEN_NAME}" "${CONFIG.TOKEN_SYMBOL}" "${CONFIG.FEE_RECEIVER}"`);
    console.log(`npx hardhat verify --network ${network} ${tokenMiningV2Address} ${projectTokenV2Address} ${projectTokenV2Address} ${startTime}`);
    if (lpMiningV2Address) {
        console.log(`npx hardhat verify --network ${network} ${lpMiningV2Address} ${projectTokenV2Address} ${CONFIG.LP_TOKEN_ADDRESS} ${startTime}`);
    }

    // 下一步
    if (!CONFIG.LP_TOKEN_ADDRESS) {
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📌 下一步操作：");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("1. 在 PancakeSwap 创建流动性池：");
        console.log("   https://pancakeswap.finance/add");
        console.log(`   - 代币: ${projectTokenV2Address}`);
        console.log("   - 配对: WBNB 或 USDT");
        console.log("");
        console.log("2. 获取 LP Token 地址后，用新 Owner 账户调用:");
        console.log(`   projectTokenV2.setPair(LP地址, true)`);
        console.log("");
        console.log("3. 单独部署 LPMiningV2 合约");
    }

    console.log("\n✅ 所有合约 Owner 已转移到:", CONFIG.FINAL_OWNER);
    console.log("   请使用该地址进行后续管理操作！\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 部署失败:", error);
        process.exit(1);
    });
