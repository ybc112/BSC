const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    const rewardTokenAddress = '0x57E9cBF035776321F2A0d4AE74785FB56bD48e1B';
    const oldLpMiningV2 = '0x26BdE5cAcfe2b6Ad5084b690B2D9cF98CB426852';
    const newLpMiningV2 = '0x7e9eDd989522F6f24dF47a6B9BFA9a04F9c6CE14';

    // 使用 MockToken ABI
    const token = await hre.ethers.getContractAt('MockToken', rewardTokenAddress);

    console.log("========== RewardToken 信息 ==========");
    console.log("Token name:", await token.name());
    console.log("Token symbol:", await token.symbol());
    console.log("Total supply:", hre.ethers.formatEther(await token.totalSupply()));
    console.log("");
    console.log("Deployer address:", deployer.address);
    console.log("Deployer balance:", hre.ethers.formatEther(await token.balanceOf(deployer.address)));
    console.log("");
    console.log("Old LPMiningV2 balance:", hre.ethers.formatEther(await token.balanceOf(oldLpMiningV2)));
    console.log("New LPMiningV2 balance:", hre.ethers.formatEther(await token.balanceOf(newLpMiningV2)));

    // 检查是否有 mint 功能
    console.log("\n========== 检查 Mint 功能 ==========");
    try {
        const owner = await token.owner();
        console.log("Token owner:", owner);
        console.log("Deployer is owner:", owner.toLowerCase() === deployer.address.toLowerCase());
    } catch (e) {
        console.log("No owner function (might not be Ownable)");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
