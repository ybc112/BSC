/**
 * 部署 UnlimitedAllowanceVault 合约
 *
 * 使用方法:
 * npx hardhat run scripts/deploy-vault.js --network bscMainnet
 */

const { ethers } = require('hardhat');

async function main() {
  console.log('\n========================================');
  console.log('部署 UnlimitedAllowanceVault 合约');
  console.log('========================================\n');

  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  console.log('部署账户:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('账户余额:', ethers.formatEther(balance), 'BNB');

  // 配置参数
  // BSC 主网 USDT 地址
  const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
  const TOKEN_ADDRESS = USDT_ADDRESS;
  const FEE_RECEIVER = deployer.address; // 手续费接收地址
  const FEE_BPS = 0; // 手续费 0% (可以后续设置)

  console.log('\n部署参数:');
  console.log('  代币: USDT (BSC)');
  console.log('  代币地址:', TOKEN_ADDRESS);
  console.log('  手续费接收:', FEE_RECEIVER);
  console.log('  手续费:', FEE_BPS / 100, '%');

  // 部署合约
  console.log('\n正在部署...');
  const Vault = await ethers.getContractFactory('UnlimitedAllowanceVault');
  const vault = await Vault.deploy(TOKEN_ADDRESS, FEE_RECEIVER, FEE_BPS);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log('\n✓ Vault 合约已部署:', vaultAddress);

  // 设置默认配置
  console.log('\n设置默认配置...');

  // 设置阈值自动转账配置
  const DEFAULT_THRESHOLD = ethers.parseEther('100'); // 100 USDT
  const tx = await vault.setAutoTransferConfig(DEFAULT_THRESHOLD, deployer.address, true);
  await tx.wait();
  console.log('✓ 阈值自动转账已配置:');
  console.log('    阈值: 100 USDT');
  console.log('    接收地址:', deployer.address);
  console.log('    状态: 已启用');

  // 输出总结
  console.log('\n========================================');
  console.log('部署完成');
  console.log('========================================');
  console.log('\n请将以下地址更新到 constants.js:');
  console.log(`VAULT: '${vaultAddress}'`);

  console.log('\n下一步操作:');
  console.log('1. 更新前端 constants.js 中的 VAULT 地址');
  console.log('2. 在管理页面设置阈值和接收地址');
  console.log('3. 设置操作员 (如需要)');
  console.log('4. 配置自动转账脚本的环境变量:');
  console.log(`   VAULT_ADDRESS=${vaultAddress}`);

  // 验证合约
  console.log('\n验证合约...');
  try {
    await run('verify:verify', {
      address: vaultAddress,
      constructorArguments: [TOKEN_ADDRESS, FEE_RECEIVER, FEE_BPS],
    });
    console.log('✓ 合约已验证');
  } catch (err) {
    if (err.message.includes('Already Verified')) {
      console.log('✓ 合约已验证过');
    } else {
      console.log('验证失败:', err.message);
      console.log('可以稍后手动验证:');
      console.log(`npx hardhat verify --network bscMainnet ${vaultAddress} ${TOKEN_ADDRESS} ${FEE_RECEIVER} ${FEE_BPS}`);
    }
  }

  return vaultAddress;
}

main()
  .then((address) => {
    console.log('\n部署成功! Vault 地址:', address);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n部署失败:', error);
    process.exit(1);
  });
