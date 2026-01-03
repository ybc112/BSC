const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const contract = await ethers.getContractAt('TokenMiningV2', '0xC53B32D650ec48212b1a85c3FA8DB1505482A156');
    const account = '0xbe4aE94cb80780917132c4779d8bEa4E6804d792';

    console.log('测试 TokenMiningV2 合约函数...\n');

    try {
        const status = await contract.getMiningStatus();
        console.log('✅ getMiningStatus: OK');
        console.log('   totalStaked:', ethers.formatEther(status._totalStaked));
        console.log('   totalDistributed:', ethers.formatEther(status._totalDistributed));
    } catch(e) {
        console.log('❌ getMiningStatus ERROR:', e.message);
    }

    try {
        const configs = await contract.getAllTierConfigs();
        console.log('✅ getAllTierConfigs: OK');
        console.log('   durations:', configs.durations.map(d => Number(d)));
        console.log('   dailyRates:', configs.dailyRates.map(r => Number(r)));
    } catch(e) {
        console.log('❌ getAllTierConfigs ERROR:', e.message);
    }

    try {
        const info = await contract.getUserInfo(account);
        console.log('✅ getUserInfo: OK');
        console.log('   totalStaked:', ethers.formatEther(info.totalStaked));
        console.log('   totalClaimed:', ethers.formatEther(info.totalClaimed));
    } catch(e) {
        console.log('❌ getUserInfo ERROR:', e.message);
    }

    try {
        const stakes = await contract.getUserStakes(account);
        console.log('✅ getUserStakes: OK');
        console.log('   stakeIds:', stakes.stakeIds.map(id => Number(id)));
    } catch(e) {
        console.log('❌ getUserStakes ERROR:', e.message);
    }

    try {
        const pending = await contract.pendingRewardAll(account);
        console.log('✅ pendingRewardAll: OK');
        console.log('   pending:', ethers.formatEther(pending));
    } catch(e) {
        console.log('❌ pendingRewardAll ERROR:', e.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
