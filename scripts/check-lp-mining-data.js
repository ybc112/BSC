const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const lpMining = await ethers.getContractAt('LPMiningV2', '0x7e9eDd989522F6f24dF47a6B9BFA9a04F9c6CE14');

    console.log('=== LP Mining 合约数据 ===\n');

    const totalStaked = await lpMining.totalStaked();
    console.log('totalStaked (用户质押的LP总量):', ethers.formatEther(totalStaked), 'LP');

    const totalDistributed = await lpMining.totalDistributed();
    console.log('totalDistributed (已分发的RWT奖励):', ethers.formatEther(totalDistributed), 'RWT');

    const totalRewards = await lpMining.totalRewards();
    console.log('totalRewards (RWT总奖励池):', ethers.formatEther(totalRewards), 'RWT');

    const miningStatus = await lpMining.getMiningStatus();
    console.log('\n=== getMiningStatus 返回值 ===');
    console.log('_totalStaked (LP):', ethers.formatEther(miningStatus._totalStaked));
    console.log('_totalDistributed (RWT):', ethers.formatEther(miningStatus._totalDistributed));
    console.log('_rewardPerSecond (RWT/秒):', ethers.formatEther(miningStatus._rewardPerSecond));
    console.log('_remainingRewards (剩余RWT):', ethers.formatEther(miningStatus._remainingRewards));

    // 检查LP代币合约
    const lpTokenAddr = await lpMining.lpToken();
    console.log('\n=== LP代币信息 ===');
    console.log('LP Token地址:', lpTokenAddr);

    const lpToken = await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', lpTokenAddr);
    const lpTotalSupply = await lpToken.totalSupply();
    console.log('LP Token总供应量:', ethers.formatEther(lpTotalSupply), 'LP');

    const contractLpBalance = await lpToken.balanceOf('0x7e9eDd989522F6f24dF47a6B9BFA9a04F9c6CE14');
    console.log('合约持有的LP:', ethers.formatEther(contractLpBalance), 'LP');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
