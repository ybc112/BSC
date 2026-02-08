/**
 * 部署 AirdropVault 到 BSC 主网
 *
 * 使用方法：
 * npx hardhat run scripts/deploy-airdrop-vault.js --network bscMainnet
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  // BSC 主网 USDT
  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  // 手续费 0%
  FEE_BPS: 0,
  // 阈值 100 USDT
  AUTO_TRANSFER_THRESHOLD: ethers.parseEther('100'),
};

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('BSC 主网 AirdropVault 部署');
  console.log('='.repeat(60) + '\n');

  const [deployer] = await ethers.getSigners();
  console.log('部署账户:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('BNB 余额:', ethers.formatEther(balance), 'BNB');

  if (balance < ethers.parseEther('0.02')) {
    throw new Error('BNB 余额不足');
  }

  // 部署 AirdropVault
  console.log('\n' + '-'.repeat(40));
  console.log('部署 AirdropVault');
  console.log('-'.repeat(40));

  const AirdropVault = await ethers.getContractFactory('AirdropVault');
  const vault = await AirdropVault.deploy(
    CONFIG.USDT_ADDRESS,
    deployer.address, // feeReceiver
    CONFIG.FEE_BPS
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log('✓ AirdropVault 部署成功:', vaultAddress);

  // 设置阈值
  const tx = await vault.setAutoTransferConfig(
    CONFIG.AUTO_TRANSFER_THRESHOLD,
    deployer.address,
    true
  );
  await tx.wait();
  console.log('✓ 阈值设置: 100 USDT');
  console.log('  接收地址:', deployer.address);

  // 保存部署记录
  const deployment = {
    network: 'bscMainnet',
    chainId: 56,
    deployer: deployer.address,
    deployTime: new Date().toISOString(),
    contracts: {
      airdropVault: vaultAddress,
    },
    config: {
      token: 'USDT',
      tokenAddress: CONFIG.USDT_ADDRESS,
      threshold: '100',
      receiver: deployer.address,
      feeBps: CONFIG.FEE_BPS,
      referralRates: {
        level1: '20%',
        level2: '10%',
        level3: '5%',
      },
    },
  };

  const deploymentPath = path.join(__dirname, '../deployments/airdropVault.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log('\n✓ 部署记录已保存到:', deploymentPath);

  console.log('\n' + '='.repeat(60));
  console.log('部署完成！');
  console.log('='.repeat(60));
  console.log('\nAirdropVault:', vaultAddress);
  console.log('\n请更新前端 constants.js:');
  console.log(`AIRDROP_VAULT: '${vaultAddress}',`);

  return { airdropVault: vaultAddress };
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
