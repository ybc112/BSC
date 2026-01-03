const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('账户地址:', deployer.address);
    console.log('BNB余额:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'BNB');

    // 检查合约状态
    const lpMiningV2 = await ethers.getContractAt('LPMiningV2', '0x7e9eDd989522F6f24dF47a6B9BFA9a04F9c6CE14');
    const tokenMiningV2 = await ethers.getContractAt('TokenMiningV2', '0x7011554695A29faa12eB4FA1437180D412326F4c');
    const rewardToken = await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', '0x57E9cBF035776321F2A0d4AE74785FB56bD48e1B');
    const lpToken = await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', '0xf7839D5B542b6d278d42f61eeB5ca61127C2e652');
    const projectTokenV2 = await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', '0xa3C9744b4a3C986E01d81009134589FF67748435');

    console.log('\n=== LP Mining V2 状态 ===');
    const lpStatus = await lpMiningV2.getMiningStatus();
    console.log('总质押:', ethers.formatEther(lpStatus._totalStaked), 'LP');
    console.log('已分发:', ethers.formatEther(lpStatus._totalDistributed), 'RWT');
    console.log('剩余奖励:', ethers.formatEther(lpStatus._remainingRewards), 'RWT');
    console.log('挖矿结束:', lpStatus._miningEnded);

    const lockDuration = await lpMiningV2.lockDuration();
    console.log('锁仓期:', Number(lockDuration) / 86400, '天');

    // 获取用户信息
    console.log('\n=== 你在 LP Mining 的状态 ===');
    const userInfo = await lpMiningV2.getUserInfo(deployer.address);
    console.log('质押数量:', ethers.formatEther(userInfo.stakedAmount), 'LP');
    console.log('待领取收益:', ethers.formatEther(userInfo.pendingRewards), 'RWT');
    console.log('推荐奖励:', ethers.formatEther(userInfo.referralRewards), 'RWT');
    console.log('团队奖励:', ethers.formatEther(userInfo.teamRewards), 'RWT');
    console.log('累计已领取:', ethers.formatEther(userInfo.totalClaimed), 'RWT');

    // 获取分配统计
    const distStats = await lpMiningV2.getDistributionStats();
    console.log('\n=== 分配统计 ===');
    console.log('推荐分发总量:', ethers.formatEther(distStats._totalReferralDistributed), 'RWT');
    console.log('团队分发总量:', ethers.formatEther(distStats._totalTeamDistributed), 'RWT');
    console.log('分流分发总量:', ethers.formatEther(distStats._totalSplitDistributed), 'RWT');

    console.log('\n=== 合约代币余额 ===');
    const lpMiningBalance = await rewardToken.balanceOf('0x7e9eDd989522F6f24dF47a6B9BFA9a04F9c6CE14');
    console.log('LPMiningV2 奖励代币余额:', ethers.formatEther(lpMiningBalance), 'RWT');

    console.log('\n=== 你的代币余额 ===');
    console.log('LP Token:', ethers.formatEther(await lpToken.balanceOf(deployer.address)), 'LP');
    console.log('Reward Token (RWT):', ethers.formatEther(await rewardToken.balanceOf(deployer.address)), 'RWT');
    console.log('ProjectTokenV2:', ethers.formatEther(await projectTokenV2.balanceOf(deployer.address)), 'PTV2');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
