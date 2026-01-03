const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    // 使用正确的合约地址
    const lpMiningAddress = '0x7e9eDd989522F6f24dF47a6B9BFA9a04F9c6CE14';

    console.log('检查 LPMiningV2 合约...');
    console.log('合约地址:', lpMiningAddress);

    const lpMining = await ethers.getContractAt('LPMiningV2', lpMiningAddress);

    try {
        const owner = await lpMining.owner();
        console.log('\n✅ Owner:', owner);
    } catch(e) {
        console.log('❌ owner() ERROR:', e.message);
    }

    try {
        const totalStaked = await lpMining.totalStaked();
        console.log('✅ Total Staked:', ethers.formatEther(totalStaked), 'LP');
    } catch(e) {
        console.log('❌ totalStaked() ERROR:', e.message);
    }

    try {
        const lpTokenAddr = await lpMining.lpToken();
        console.log('✅ LP Token Address:', lpTokenAddr);

        // 检查合约的实际LP余额
        const lpToken = await ethers.getContractAt('IERC20', lpTokenAddr);
        const contractBalance = await lpToken.balanceOf(lpMiningAddress);
        console.log('✅ Contract LP Balance:', ethers.formatEther(contractBalance), 'LP');
    } catch(e) {
        console.log('❌ LP balance check ERROR:', e.message);
    }

    // 检查 adminTransferLP 函数
    console.log('\n检查 adminTransferLP 函数...');
    try {
        const funcFragment = lpMining.interface.getFunction('adminTransferLP');
        console.log('✅ adminTransferLP function exists');
        console.log('   Inputs:', funcFragment.inputs.map(i => `${i.name}: ${i.type}`).join(', '));
    } catch(e) {
        console.log('❌ adminTransferLP NOT found in contract ABI');
        console.log('   Error:', e.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
