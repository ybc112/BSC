const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const lpMining = await ethers.getContractAt('LPMiningV2', '0x7e9eDd989522F6f24dF47a6B9BFA9a04F9c6CE14');

    console.log('=== LP Mining 收益分配比例 ===\n');

    const userBaseShare = await lpMining.userBaseShare();
    const splitShare = await lpMining.splitShare();
    const ref1 = await lpMining.referralLevel1();
    const ref2 = await lpMining.referralLevel2();
    const ref3 = await lpMining.referralLevel3();

    const userPct = Number(userBaseShare) / 100;
    const splitPct = Number(splitShare) / 100;

    console.log('用户基础收益占比 (userBaseShare):', userPct, '%');
    console.log('分流占比 (splitShare):', splitPct, '%');
    console.log('');
    console.log('推荐奖励比例 (从用户收益中扣除):');
    console.log('  1代:', Number(ref1) / 100, '%');
    console.log('  2代:', Number(ref2) / 100, '%');
    console.log('  3代:', Number(ref3) / 100, '%');

    // 获取分流配置
    try {
        const splitConfig = await lpMining.getSplitConfig();
        console.log('\n分流地址配置:');
        for (let i = 0; i < splitConfig.addresses.length; i++) {
            console.log('  地址', i + 1, ':', splitConfig.addresses[i], '-', Number(splitConfig.rates[i]) / 100, '%');
        }
    } catch (e) {
        console.log('\n分流地址: 未配置');
    }

    console.log('\n========================================');
    console.log('=== 用户实际到手计算示例 ===');
    console.log('========================================');
    console.log('\n假设用户挖矿产出 100 RWT:');
    console.log('');
    console.log('1. 用户直接到手: ' + userPct + ' RWT (' + userPct + '%)');
    console.log('2. 分流出去: ' + splitPct + ' RWT (' + splitPct + '%)');
    console.log('');
    console.log('如果用户有推荐人，推荐奖励从用户的 ' + userPct + ' RWT 中额外分配:');
    console.log('  - 1代推荐人获得: ' + (userPct * Number(ref1) / 10000).toFixed(2) + ' RWT');
    console.log('  - 2代推荐人获得: ' + (userPct * Number(ref2) / 10000).toFixed(2) + ' RWT');
    console.log('  - 3代推荐人获得: ' + (userPct * Number(ref3) / 10000).toFixed(2) + ' RWT');
    console.log('');
    console.log('注意: 推荐奖励是额外发放的，不从用户收益中扣除');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
