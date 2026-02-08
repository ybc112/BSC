/**
 * 自动转账脚本
 *
 * 功能：
 * 1. 定时检测所有授权用户的余额
 * 2. 如果余额超过阈值，自动转走超出部分
 *
 * 使用方法：
 * 1. 设置环境变量 PRIVATE_KEY（操作员私钥）
 * 2. 设置合约地址 VAULT_ADDRESS
 * 3. 运行: node scripts/auto-transfer.js
 *
 * 定时运行（使用 cron）:
 * */5 * * * * node /path/to/scripts/auto-transfer.js >> /path/to/logs/auto-transfer.log 2>&1
 */

const { ethers } = require('ethers');
require('dotenv').config();

// ============ 配置 ============
const CONFIG = {
  // Vault 合约地址（部署后填入）
  VAULT_ADDRESS: process.env.VAULT_ADDRESS || '',

  // RPC 节点
  RPC_URL: process.env.RPC_URL || 'https://bsc-dataseed.binance.org/',

  // 检查间隔（毫秒）- 仅用于持续运行模式
  CHECK_INTERVAL: 5 * 60 * 1000, // 5分钟

  // 是否持续运行（false = 执行一次后退出）
  CONTINUOUS_MODE: process.env.CONTINUOUS_MODE === 'true',

  // Gas 设置
  GAS_LIMIT: 500000,
  GAS_PRICE_GWEI: 3, // BSC 默认 3 Gwei
};

// Vault ABI（只需要用到的函数）
const VAULT_ABI = [
  "function autoTransferEnabled() view returns (bool)",
  "function autoTransferThreshold() view returns (uint256)",
  "function getTransferableUsers() view returns (address[] users, uint256[] balances, uint256[] transferableAmounts)",
  "function batchTransferAboveThreshold(address[] users)",
  "function transferAboveThreshold(address user)",
  "function owner() view returns (address)",
  "function operators(address) view returns (bool)",
];

// ============ 主逻辑 ============

class AutoTransferBot {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.vault = null;
  }

  async initialize() {
    console.log('\n========================================');
    console.log('自动转账机器人启动');
    console.log('时间:', new Date().toISOString());
    console.log('========================================\n');

    // 检查配置
    if (!CONFIG.VAULT_ADDRESS) {
      throw new Error('请设置 VAULT_ADDRESS 环境变量');
    }

    if (!process.env.PRIVATE_KEY) {
      throw new Error('请设置 PRIVATE_KEY 环境变量');
    }

    // 连接网络
    this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const network = await this.provider.getNetwork();
    console.log('网络:', network.name, '(Chain ID:', network.chainId.toString(), ')');

    // 创建钱包
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    console.log('操作员地址:', this.wallet.address);

    // 检查余额
    const balance = await this.provider.getBalance(this.wallet.address);
    console.log('BNB 余额:', ethers.formatEther(balance), 'BNB');

    if (balance < ethers.parseEther('0.01')) {
      console.warn('⚠️ 警告: BNB 余额较低，可能无法支付 Gas 费');
    }

    // 连接合约
    this.vault = new ethers.Contract(CONFIG.VAULT_ADDRESS, VAULT_ABI, this.wallet);
    console.log('Vault 合约:', CONFIG.VAULT_ADDRESS);

    // 检查权限
    const owner = await this.vault.owner();
    const isOperator = await this.vault.operators(this.wallet.address);

    if (owner.toLowerCase() !== this.wallet.address.toLowerCase() && !isOperator) {
      throw new Error('当前钱包不是合约所有者或操作员，无权执行转账');
    }

    console.log('权限检查: ✓', isOperator ? '(Operator)' : '(Owner)');

    // 检查是否启用
    const enabled = await this.vault.autoTransferEnabled();
    if (!enabled) {
      console.log('\n⚠️ 阈值自动转账功能未启用');
      console.log('请在管理页面启用后再运行此脚本');
      return false;
    }

    const threshold = await this.vault.autoTransferThreshold();
    console.log('转账阈值:', ethers.formatEther(threshold), 'AGG');
    console.log('\n初始化完成 ✓\n');

    return true;
  }

  async checkAndTransfer() {
    console.log('----------------------------------------');
    console.log('检查时间:', new Date().toISOString());

    try {
      // 获取可转账用户
      const result = await this.vault.getTransferableUsers();
      const users = result.users;
      const balances = result.balances;
      const amounts = result.transferableAmounts;

      console.log('可转账用户数:', users.length);

      if (users.length === 0) {
        console.log('无需转账');
        return;
      }

      // 显示用户列表
      let totalAmount = 0n;
      console.log('\n可转账用户列表:');
      for (let i = 0; i < users.length; i++) {
        const balance = ethers.formatEther(balances[i]);
        const amount = ethers.formatEther(amounts[i]);
        console.log(`  ${i + 1}. ${users[i].slice(0, 10)}... 余额: ${balance} AGG, 可转: ${amount} AGG`);
        totalAmount += amounts[i];
      }
      console.log(`\n总计可转: ${ethers.formatEther(totalAmount)} AGG`);

      // 执行批量转账
      console.log('\n执行批量转账...');

      const gasPrice = ethers.parseUnits(CONFIG.GAS_PRICE_GWEI.toString(), 'gwei');

      // 如果用户太多，分批处理（每批最多 50 个）
      const BATCH_SIZE = 50;
      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);
        console.log(`批次 ${Math.floor(i / BATCH_SIZE) + 1}: 处理 ${batch.length} 个用户`);

        const tx = await this.vault.batchTransferAboveThreshold(batch, {
          gasLimit: CONFIG.GAS_LIMIT * batch.length,
          gasPrice: gasPrice,
        });

        console.log('交易哈希:', tx.hash);
        const receipt = await tx.wait();
        console.log('交易确认，区块:', receipt.blockNumber);
        console.log('Gas 使用:', receipt.gasUsed.toString());
      }

      console.log('\n✓ 转账完成');

    } catch (err) {
      console.error('转账失败:', err.message);

      // 如果批量失败，尝试逐个转账
      if (err.message.includes('execution reverted')) {
        console.log('\n尝试逐个转账...');
        await this.transferOneByOne();
      }
    }
  }

  async transferOneByOne() {
    try {
      const result = await this.vault.getTransferableUsers();
      const users = result.users;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        console.log(`处理用户 ${i + 1}/${users.length}: ${user.slice(0, 10)}...`);

        try {
          const tx = await this.vault.transferAboveThreshold(user, {
            gasLimit: CONFIG.GAS_LIMIT,
          });
          const receipt = await tx.wait();
          console.log(`  ✓ 成功, 区块: ${receipt.blockNumber}`);
        } catch (err) {
          console.log(`  ✗ 失败: ${err.reason || err.message}`);
        }
      }
    } catch (err) {
      console.error('逐个转账失败:', err.message);
    }
  }

  async run() {
    const initialized = await this.initialize();
    if (!initialized) return;

    if (CONFIG.CONTINUOUS_MODE) {
      // 持续运行模式
      console.log(`持续运行模式，检查间隔: ${CONFIG.CHECK_INTERVAL / 1000} 秒\n`);

      await this.checkAndTransfer();

      setInterval(async () => {
        await this.checkAndTransfer();
      }, CONFIG.CHECK_INTERVAL);
    } else {
      // 单次执行模式
      await this.checkAndTransfer();
      console.log('\n单次执行完成，退出');
      process.exit(0);
    }
  }
}

// ============ 执行 ============

const bot = new AutoTransferBot();
bot.run().catch((err) => {
  console.error('\n❌ 致命错误:', err.message);
  process.exit(1);
});
