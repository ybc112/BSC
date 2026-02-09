const { ethers } = require("hardhat");

/**
 * 批量发放LP挖矿奖励脚本
 *
 * 使用方法:
 *   npx hardhat run scripts/batch-distribute.js --network bscTestnet
 *   npx hardhat run scripts/batch-distribute.js --network bscMainnet
 *
 * 功能:
 *   - 自动获取所有质押用户
 *   - 分批调用 batchDistributeRewards 发放奖励
 *   - 适合设置为定时任务实现"每日自动到账"
 */

// 配置
const LP_MINING_ADDRESS = process.env.LP_MINING_ADDRESS || "0x97060F561D1890bFAc0714B373123448486F13f8";
const BATCH_SIZE = 50; // 每批处理用户数，建议不超过50

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("执行账户:", signer.address);
  console.log("LP Mining 合约:", LP_MINING_ADDRESS);
  console.log("---");

  // 获取合约实例
  const lpMining = await ethers.getContractAt("LPMiningV2", LP_MINING_ADDRESS);

  // 验证是否是 Owner
  const owner = await lpMining.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error("错误: 当前账户不是合约 Owner");
    console.error("合约 Owner:", owner);
    console.error("当前账户:", signer.address);
    process.exit(1);
  }

  // 获取质押用户数量
  const stakerCount = await lpMining.getStakerCount();
  console.log(`质押用户总数: ${stakerCount}`);

  if (stakerCount == 0) {
    console.log("没有质押用户，无需发放");
    return;
  }

  // 检查合约奖励代币余额
  const rewardToken = await lpMining.rewardToken();
  const token = await ethers.getContractAt("IERC20", rewardToken);
  const balance = await token.balanceOf(LP_MINING_ADDRESS);
  console.log(`合约奖励代币余额: ${ethers.formatEther(balance)} AGG`);

  if (balance == 0n) {
    console.error("警告: 合约没有奖励代币，无法发放");
    return;
  }

  // 分批发放
  let totalDistributed = 0n;
  let usersProcessed = 0;
  const batchCount = Math.ceil(Number(stakerCount) / BATCH_SIZE);

  console.log(`\n开始批量发放，共 ${batchCount} 批...`);
  console.log("---");

  for (let batch = 0; batch < batchCount; batch++) {
    const offset = batch * BATCH_SIZE;

    // 获取这一批用户
    const { result: users, total } = await lpMining.getStakersPaginated(offset, BATCH_SIZE);

    if (users.length === 0) {
      console.log(`批次 ${batch + 1}: 没有更多用户`);
      break;
    }

    console.log(`批次 ${batch + 1}/${batchCount}: 处理 ${users.length} 个用户`);

    try {
      // 估算 Gas
      const gasEstimate = await lpMining.batchDistributeRewards.estimateGas(users);
      console.log(`  预估 Gas: ${gasEstimate.toString()}`);

      // 执行批量发放
      const tx = await lpMining.batchDistributeRewards(users, {
        gasLimit: gasEstimate * 120n / 100n  // 增加 20% 余量
      });

      console.log(`  交易已提交: ${tx.hash}`);

      // 等待确认
      const receipt = await tx.wait();
      console.log(`  交易已确认，区块: ${receipt.blockNumber}`);

      // 解析事件获取发放金额
      const batchEvent = receipt.logs.find(log => {
        try {
          const parsed = lpMining.interface.parseLog(log);
          return parsed.name === "BatchDistribute";
        } catch {
          return false;
        }
      });

      if (batchEvent) {
        const parsed = lpMining.interface.parseLog(batchEvent);
        const amount = parsed.args.totalAmount;
        totalDistributed += amount;
        console.log(`  本批发放: ${ethers.formatEther(amount)} AGG`);
      }

      usersProcessed += users.length;

    } catch (error) {
      console.error(`  批次 ${batch + 1} 失败:`, error.message);
      // 继续处理下一批
    }

    // 批次间稍作等待，避免节点限制
    if (batch < batchCount - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log("\n---");
  console.log("发放完成!");
  console.log(`处理用户数: ${usersProcessed}`);
  console.log(`总发放金额: ${ethers.formatEther(totalDistributed)} AGG`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
