/**
 * 全面检查所有主网合约的链上状态
 * 用法: npx hardhat run scripts/check-all-contracts.js --network bscMainnet
 */
const hre = require("hardhat");

// 主网合约地址
const ADDRESSES = {
  AGG_TOKEN: '0xCd339aec4797790A8e387eF10035df0000d3a815',
  TOKEN_MINING_V2: '0xB4089956A0b775638e8F9F2E17deaE35B102c860',
  TOKEN_MINING_V3: '0x5AAbbf55E8edE32E1da6Aa9F99C9cb9f69b6C2eD',
  LP_TOKEN: '0x7552081681410f1828a02cfeb865ea444fb21909',
  LP_MINING: '0xb2b45fFb37c6e198d6507EEc12e2392CAb859BE9',
  VAULT: '0xCd977ED99Acfca760A85925e677b51208033906d',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function owner() view returns (address)",
];

const TOKEN_MINING_V3_ABI = [
  "function totalStaked() view returns (uint256)",
  "function totalDistributed() view returns (uint256)",
  "function totalRewards() view returns (uint256)",
  "function totalReferralDistributed() view returns (uint256)",
  "function miningEnded() view returns (bool)",
  "function startTime() view returns (uint256)",
  "function owner() view returns (address)",
  "function getAllTierConfigs() view returns (uint256[4] durations, uint256[4] dailyRates, uint256[4] annualAPYs)",
  "function getReferralRates() view returns (uint256[])",
  "function getReferralLevels() view returns (uint256)",
  "function stakingToken() view returns (address)",
  "function rewardToken() view returns (address)",
];

const LP_MINING_ABI = [
  "function totalStaked() view returns (uint256)",
  "function totalDistributed() view returns (uint256)",
  "function totalRewards() view returns (uint256)",
  "function miningEnded() view returns (bool)",
  "function startTime() view returns (uint256)",
  "function lockDuration() view returns (uint256)",
  "function owner() view returns (address)",
  "function accRewardPerShare() view returns (uint256)",
  "function rewardPerSecond() view returns (uint256)",
  "function userBaseShare() view returns (uint256)",
  "function referralLevel1() view returns (uint256)",
  "function referralLevel2() view returns (uint256)",
  "function referralLevel3() view returns (uint256)",
  "function getStakerCount() view returns (uint256)",
  "function totalReferralDistributed() view returns (uint256)",
  "function totalTeamDistributed() view returns (uint256)",
  "function totalSplitDistributed() view returns (uint256)",
  "function stakingToken() view returns (address)",
  "function rewardToken() view returns (address)",
];

const TOKEN_MINING_V2_ABI = [
  "function totalStaked() view returns (uint256)",
  "function totalDistributed() view returns (uint256)",
  "function totalRewards() view returns (uint256)",
  "function miningEnded() view returns (bool)",
  "function startTime() view returns (uint256)",
  "function owner() view returns (address)",
  "function getAllTierConfigs() view returns (uint256[4] durations, uint256[4] dailyRates, uint256[4] annualAPYs)",
];

const fmt = (val) => hre.ethers.formatEther(val);
const fmtN = (val, decimals = 4) => parseFloat(hre.ethers.formatEther(val)).toFixed(decimals);

async function safeCall(fn, fallback = null) {
  try { return await fn(); } catch (e) { return fallback; }
}

async function main() {
  const { ethers } = hre;
  const provider = ethers.provider;

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║          BSC 主网合约状态全面检查                             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`检查时间: ${new Date().toLocaleString()}`);
  console.log(`网络: BSC Mainnet (Chain ID: ${(await provider.getNetwork()).chainId})\n`);

  // ==================== AGG Token ====================
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📌 AGG Token (ProjectTokenV2)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const agg = new ethers.Contract(ADDRESSES.AGG_TOKEN, ERC20_ABI, provider);
  const aggSymbol = await safeCall(() => agg.symbol(), 'AGG');
  const aggSupply = await safeCall(() => agg.totalSupply(), 0n);
  const aggOwner = await safeCall(() => agg.owner(), 'N/A');
  console.log(`  地址: ${ADDRESSES.AGG_TOKEN}`);
  console.log(`  Symbol: ${aggSymbol}`);
  console.log(`  总供应量: ${aggSupply ? fmtN(aggSupply, 0) : 'N/A'} ${aggSymbol}`);
  console.log(`  Owner: ${aggOwner}`);

  // 各合约中的 AGG 余额
  const aggInV2 = await safeCall(() => agg.balanceOf(ADDRESSES.TOKEN_MINING_V2), 0n);
  const aggInV3 = await safeCall(() => agg.balanceOf(ADDRESSES.TOKEN_MINING_V3), 0n);
  const aggInLP = await safeCall(() => agg.balanceOf(ADDRESSES.LP_MINING), 0n);
  const aggInVault = await safeCall(() => agg.balanceOf(ADDRESSES.VAULT), 0n);
  console.log(`\n  各合约持有 ${aggSymbol}:`);
  console.log(`    TokenMiningV2: ${fmtN(aggInV2)} ${aggSymbol}`);
  console.log(`    TokenMiningV3: ${fmtN(aggInV3)} ${aggSymbol}`);
  console.log(`    LP Mining:     ${fmtN(aggInLP)} ${aggSymbol}`);
  console.log(`    Vault:         ${fmtN(aggInVault)} ${aggSymbol}`);
  console.log(`    合计:          ${fmtN(aggInV2 + aggInV3 + aggInLP + aggInVault)} ${aggSymbol}`);

  // ==================== TokenMiningV3 ====================
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📌 TokenMiningV3 (代币质押挖矿)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const v3 = new ethers.Contract(ADDRESSES.TOKEN_MINING_V3, TOKEN_MINING_V3_ABI, provider);
  console.log(`  地址: ${ADDRESSES.TOKEN_MINING_V3}`);

  const v3Owner = await safeCall(() => v3.owner(), 'N/A');
  const v3TotalStaked = await safeCall(() => v3.totalStaked(), 0n);
  const v3TotalDistributed = await safeCall(() => v3.totalDistributed(), 0n);
  const v3TotalRewards = await safeCall(() => v3.totalRewards(), 0n);
  const v3MiningEnded = await safeCall(() => v3.miningEnded(), null);
  const v3StartTime = await safeCall(() => v3.startTime(), 0n);
  const v3TotalRefDist = await safeCall(() => v3.totalReferralDistributed(), 0n);
  const v3StakingToken = await safeCall(() => v3.stakingToken(), 'N/A');
  const v3RewardToken = await safeCall(() => v3.rewardToken(), 'N/A');

  console.log(`  Owner: ${v3Owner}`);
  console.log(`  质押代币: ${v3StakingToken}`);
  console.log(`  奖励代币: ${v3RewardToken}`);
  console.log(`  开始时间: ${v3StartTime ? new Date(Number(v3StartTime) * 1000).toLocaleString() : 'N/A'}`);
  console.log(`  挖矿结束: ${v3MiningEnded}`);
  console.log(`\n  [矿池状态]`);
  console.log(`    总奖励池:     ${fmtN(v3TotalRewards)} AGG`);
  console.log(`    已分发:       ${fmtN(v3TotalDistributed)} AGG`);
  const v3Remaining = v3TotalRewards > v3TotalDistributed ? v3TotalRewards - v3TotalDistributed : 0n;
  console.log(`    剩余(计算):   ${fmtN(v3Remaining)} AGG`);
  console.log(`    合约实际余额: ${fmtN(aggInV3)} AGG`);
  console.log(`    总质押:       ${fmtN(v3TotalStaked)} AGG`);
  console.log(`    推荐奖励已发: ${fmtN(v3TotalRefDist)} AGG`);

  // 关键检查: totalDistributed vs totalRewards
  if (v3TotalDistributed > v3TotalRewards) {
    console.log(`\n  ⚠️  警告: totalDistributed (${fmtN(v3TotalDistributed)}) > totalRewards (${fmtN(v3TotalRewards)})`);
    console.log(`     这会导致 _calculateReward 溢出，所有 view 函数 revert！`);
  }

  // 关键检查: 合约余额是否足够覆盖质押 + 剩余奖励
  const v3NeededBalance = v3TotalStaked + v3Remaining;
  if (aggInV3 < v3NeededBalance) {
    console.log(`\n  ⚠️  警告: 合约余额 (${fmtN(aggInV3)}) < 质押+剩余奖励 (${fmtN(v3NeededBalance)})`);
    console.log(`     缺口: ${fmtN(v3NeededBalance - aggInV3)} AGG`);
  } else {
    console.log(`\n  ✅ 合约余额充足，覆盖质押+奖励`);
  }

  // 档位配置
  const v3Tiers = await safeCall(() => v3.getAllTierConfigs(), null);
  if (v3Tiers) {
    const tierNames = ['灵活', '3个月', '6个月', '12个月'];
    console.log(`\n  [档位配置]`);
    for (let i = 0; i < 4; i++) {
      const duration = Number(v3Tiers.durations[i]) / 86400;
      const dailyRate = Number(v3Tiers.dailyRates[i]) / 100;
      const annualAPY = Number(v3Tiers.annualAPYs[i]) / 100;
      console.log(`    ${tierNames[i]}: 锁${duration}天, 日利率${dailyRate}%, 年化${annualAPY}%`);
    }
  }

  // 推荐配置
  const v3RefRates = await safeCall(() => v3.getReferralRates(), []);
  const v3RefLevels = await safeCall(() => v3.getReferralLevels(), 0);
  console.log(`\n  [推荐配置]`);
  console.log(`    推荐代数: ${Number(v3RefLevels)}`);
  if (v3RefRates && v3RefRates.length > 0) {
    v3RefRates.forEach((rate, i) => {
      console.log(`    第${i + 1}代: ${Number(rate) / 100}%`);
    });
  } else {
    console.log(`    ⚠️ 未设置推荐比例！推荐奖励不会产生。`);
  }

  // ==================== LP Mining ====================
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📌 LPMiningV2 (LP 挖矿)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const lp = new ethers.Contract(ADDRESSES.LP_MINING, LP_MINING_ABI, provider);
  console.log(`  地址: ${ADDRESSES.LP_MINING}`);

  const lpOwner = await safeCall(() => lp.owner(), 'N/A');
  const lpTotalStaked = await safeCall(() => lp.totalStaked(), 0n);
  const lpTotalDistributed = await safeCall(() => lp.totalDistributed(), 0n);
  const lpTotalRewards = await safeCall(() => lp.totalRewards(), 0n);
  const lpMiningEnded = await safeCall(() => lp.miningEnded(), null);
  const lpStartTime = await safeCall(() => lp.startTime(), 0n);
  const lpLockDuration = await safeCall(() => lp.lockDuration(), 0n);
  const lpRewardPerSec = await safeCall(() => lp.rewardPerSecond(), 0n);
  const lpStakerCount = await safeCall(() => lp.getStakerCount(), 0n);
  const lpUserBaseShare = await safeCall(() => lp.userBaseShare(), 0n);
  const lpRef1 = await safeCall(() => lp.referralLevel1(), 0n);
  const lpRef2 = await safeCall(() => lp.referralLevel2(), 0n);
  const lpRef3 = await safeCall(() => lp.referralLevel3(), 0n);
  const lpTotalRefDist = await safeCall(() => lp.totalReferralDistributed(), 0n);
  const lpTotalTeamDist = await safeCall(() => lp.totalTeamDistributed(), 0n);
  const lpTotalSplitDist = await safeCall(() => lp.totalSplitDistributed(), 0n);
  const lpStakingToken = await safeCall(() => lp.stakingToken(), 'N/A');
  const lpRewardToken = await safeCall(() => lp.rewardToken(), 'N/A');

  // LP Token 在合约中的余额
  const lpTokenContract = new ethers.Contract(ADDRESSES.LP_TOKEN, ERC20_ABI, provider);
  const lpTokenInContract = await safeCall(() => lpTokenContract.balanceOf(ADDRESSES.LP_MINING), 0n);

  console.log(`  Owner: ${lpOwner}`);
  console.log(`  质押代币: ${lpStakingToken}`);
  console.log(`  奖励代币: ${lpRewardToken}`);
  console.log(`  开始时间: ${lpStartTime ? new Date(Number(lpStartTime) * 1000).toLocaleString() : 'N/A'}`);
  console.log(`  挖矿结束: ${lpMiningEnded}`);
  console.log(`  锁仓期: ${lpLockDuration ? Number(lpLockDuration) / 86400 : 'N/A'} 天`);
  console.log(`  每秒奖励: ${lpRewardPerSec ? fmt(lpRewardPerSec) : 'N/A'} AGG/s`);
  console.log(`  质押用户数: ${Number(lpStakerCount)}`);

  console.log(`\n  [矿池状态]`);
  console.log(`    总奖励池:     ${fmtN(lpTotalRewards)} AGG`);
  console.log(`    已分发:       ${fmtN(lpTotalDistributed)} AGG`);
  const lpRemaining = lpTotalRewards > lpTotalDistributed ? lpTotalRewards - lpTotalDistributed : 0n;
  console.log(`    剩余(计算):   ${fmtN(lpRemaining)} AGG`);
  console.log(`    合约AGG余额:  ${fmtN(aggInLP)} AGG`);
  console.log(`    总质押LP:     ${fmtN(lpTotalStaked)} LP`);
  console.log(`    合约LP余额:   ${fmtN(lpTokenInContract)} LP`);

  console.log(`\n  [分配统计]`);
  console.log(`    推荐奖励总发: ${fmtN(lpTotalRefDist)} AGG`);
  console.log(`    团队奖励总发: ${fmtN(lpTotalTeamDist)} AGG`);
  console.log(`    分流总发:     ${fmtN(lpTotalSplitDist)} AGG`);

  console.log(`\n  [分配比例]`);
  console.log(`    用户基础份额: ${Number(lpUserBaseShare) / 100}%`);
  console.log(`    推荐1代: ${Number(lpRef1) / 100}%, 2代: ${Number(lpRef2) / 100}%, 3代: ${Number(lpRef3) / 100}%`);

  // 关键检查
  if (aggInLP < lpRemaining) {
    console.log(`\n  ⚠️  警告: 合约AGG余额 (${fmtN(aggInLP)}) < 剩余奖励 (${fmtN(lpRemaining)})`);
  } else {
    console.log(`\n  ✅ 合约AGG余额充足`);
  }
  if (lpTokenInContract < lpTotalStaked) {
    console.log(`  ⚠️  警告: 合约LP余额 (${fmtN(lpTokenInContract)}) < 用户总质押 (${fmtN(lpTotalStaked)})`);
  } else {
    console.log(`  ✅ 合约LP余额覆盖用户质押`);
  }

  // ==================== TokenMiningV2 ====================
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📌 TokenMiningV2 (旧版代币质押)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const v2 = new ethers.Contract(ADDRESSES.TOKEN_MINING_V2, TOKEN_MINING_V2_ABI, provider);
  console.log(`  地址: ${ADDRESSES.TOKEN_MINING_V2}`);

  const v2Owner = await safeCall(() => v2.owner(), 'N/A');
  const v2TotalStaked = await safeCall(() => v2.totalStaked(), 0n);
  const v2TotalDistributed = await safeCall(() => v2.totalDistributed(), 0n);
  const v2TotalRewards = await safeCall(() => v2.totalRewards(), 0n);
  const v2MiningEnded = await safeCall(() => v2.miningEnded(), null);
  const v2StartTime = await safeCall(() => v2.startTime(), 0n);

  console.log(`  Owner: ${v2Owner}`);
  console.log(`  开始时间: ${v2StartTime ? new Date(Number(v2StartTime) * 1000).toLocaleString() : 'N/A'}`);
  console.log(`  挖矿结束: ${v2MiningEnded}`);
  console.log(`  总奖励池: ${fmtN(v2TotalRewards)} AGG`);
  console.log(`  已分发:   ${fmtN(v2TotalDistributed)} AGG`);
  console.log(`  总质押:   ${fmtN(v2TotalStaked)} AGG`);
  console.log(`  合约余额: ${fmtN(aggInV2)} AGG`);

  // ==================== Vault ====================
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📌 Vault (无限授权金库)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  地址: ${ADDRESSES.VAULT}`);
  console.log(`  AGG 余额: ${fmtN(aggInVault)} AGG`);

  const usdtContract = new ethers.Contract(ADDRESSES.USDT, ERC20_ABI, provider);
  const usdtInVault = await safeCall(() => usdtContract.balanceOf(ADDRESSES.VAULT), 0n);
  console.log(`  USDT 余额: ${fmtN(usdtInVault)} USDT`);

  // ==================== 总结 ====================
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                        总结                                  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const totalAGGInContracts = aggInV2 + aggInV3 + aggInLP + aggInVault;
  console.log(`\n  各合约锁定 AGG 总量: ${fmtN(totalAGGInContracts)} AGG`);
  console.log(`  各合约用户质押总量:  V2=${fmtN(v2TotalStaked)}, V3=${fmtN(v3TotalStaked)}, LP=${fmtN(lpTotalStaked)}`);

  console.log("\n  [是否需要重新部署评估]");

  let needRedeploy = false;

  if (v3TotalDistributed > v3TotalRewards) {
    console.log("  ❌ TokenMiningV3: totalDistributed > totalRewards，view 函数永久 revert");
    needRedeploy = true;
  } else if (v3TotalDistributed > 0n) {
    console.log(`  ⚠️  TokenMiningV3: 已有分发记录 (${fmtN(v3TotalDistributed)})，重部署需迁移`);
  } else {
    console.log("  ✅ TokenMiningV3: 未开始分发，可以安全重部署");
  }

  if (v3TotalStaked > 0n) {
    console.log(`  ❌ TokenMiningV3: 有 ${fmtN(v3TotalStaked)} AGG 用户质押中，重部署需先让用户提取`);
    needRedeploy = false;
  } else {
    console.log("  ✅ TokenMiningV3: 无用户质押，可以安全重部署");
  }

  if (lpTotalStaked > 0n) {
    console.log(`  ⚠️  LPMining: 有 ${fmtN(lpTotalStaked)} LP 用户质押中`);
  } else {
    console.log("  ✅ LPMining: 无用户质押");
  }

  if (!v3RefRates || v3RefRates.length === 0) {
    console.log("  ⚠️  TokenMiningV3: 推荐比例未设置，推荐奖励无法产生");
  }

  if (!needRedeploy && v3TotalStaked === 0n && (v3TotalDistributed === 0n || v3TotalDistributed <= v3TotalRewards)) {
    console.log("\n  💡 建议: TokenMiningV3 可以考虑重新部署修复 _calculateReward 溢出问题");
    console.log("     步骤: 1.提取合约中的 AGG → 2.部署新合约 → 3.转入 AGG → 4.更新前端地址");
  } else if (v3TotalStaked > 0n) {
    console.log("\n  💡 建议: 有用户在质押，不建议立即重部署。可通过前端 fallback 继续运行。");
    console.log("     如必须重部署: 1.通知用户提取 → 2.emergencyWithdraw 剩余 → 3.部署新合约");
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("脚本执行出错:", error.message);
    process.exit(1);
  });
