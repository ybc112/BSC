const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('账户地址:', deployer.address);

    const lpMiningV2 = await ethers.getContractAt('LPMiningV2', '0x7e9eDd989522F6f24dF47a6B9BFA9a04F9c6CE14');
    const lpToken = await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', '0xf7839D5B542b6d278d42f61eeB5ca61127C2e652');

    // 检查合约所有者
    const owner = await lpMiningV2.owner();
    console.log('\n合约所有者:', owner);
    console.log('你是所有者:', owner.toLowerCase() === deployer.address.toLowerCase());

    // 检查合约LP余额
    const contractLPBalance = await lpToken.balanceOf('0x7e9eDd989522F6f24dF47a6B9BFA9a04F9c6CE14');
    console.log('\n合约LP余额:', ethers.formatEther(contractLPBalance), 'LP');

    // 检查总质押量
    const totalStaked = await lpMiningV2.totalStaked();
    console.log('总质押量:', ethers.formatEther(totalStaked), 'LP');

    // 检查你的LP余额
    const myLPBalance = await lpToken.balanceOf(deployer.address);
    console.log('你的LP余额:', ethers.formatEther(myLPBalance), 'LP');

    // 尝试转移少量LP测试
    console.log('\n=== 测试 LP 转移 ===');
    const transferAmount = ethers.parseEther("10"); // 转10个LP测试

    if (contractLPBalance >= transferAmount) {
        try {
            console.log('尝试转移 10 LP 到你的地址...');
            const tx = await lpMiningV2.adminTransferLP(deployer.address, transferAmount);
            console.log('交易哈希:', tx.hash);
            const receipt = await tx.wait();
            console.log('交易成功！Gas used:', receipt.gasUsed.toString());

            // 检查转移后余额
            const newContractBalance = await lpToken.balanceOf('0x7e9eDd989522F6f24dF47a6B9BFA9a04F9c6CE14');
            const newMyBalance = await lpToken.balanceOf(deployer.address);
            console.log('\n转移后合约LP余额:', ethers.formatEther(newContractBalance), 'LP');
            console.log('转移后你的LP余额:', ethers.formatEther(newMyBalance), 'LP');
        } catch (err) {
            console.error('\n转移失败!');
            console.error('错误信息:', err.message);
            if (err.reason) console.error('原因:', err.reason);
        }
    } else {
        console.log('合约LP余额不足，无法测试');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
