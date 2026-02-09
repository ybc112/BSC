# LPMiningV2 合约升级说明

## 一、升级内容

### 1. 推荐关系改进 (V2.1)
**原功能**：推荐人必须已在LP矿池中质押，或者是合约Owner
**新功能**：任何有效地址都可以作为推荐人，无需质押

修改位置：`setReferrer()` 函数
```solidity
// V2.1: 移除了推荐人必须质押的限制
// require(userInfo[_referrer].amount > 0 || _referrer == owner(), "Referrer must be staker or owner");
```

### 2. 批量发放奖励功能 (V2.1)
新增管理员批量发放奖励功能，支持"每日自动到账"的需求。

新增函数：
- `batchDistributeRewards(address[] _users)` - 批量发放奖励
- `getStakerCount()` - 获取质押用户数量
- `getStakersPaginated(offset, limit)` - 分页获取质押用户列表

新增事件：
- `BatchDistribute(uint256 userCount, uint256 totalAmount)`

---

## 二、重新部署步骤

### 步骤 1：准备环境
确保 `.env` 文件中有正确的私钥和网络配置：
```
PRIVATE_KEY=你的私钥
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545/
BSC_MAINNET_RPC=https://bsc-dataseed.binance.org/
```

### 步骤 2：编译合约
```bash
npx hardhat clean
npx hardhat compile
```

### 步骤 3：部署新合约

**测试网部署**：
```bash
npx hardhat run scripts/deploy-lpmining-v2.js --network bscTestnet
```

**主网部署**（正式环境）：
```bash
npx hardhat run scripts/deploy-lpmining-v2.js --network bscMainnet
```

### 步骤 4：记录新合约地址
部署成功后，记录新的合约地址，例如：
```
LPMiningV2 deployed to: 0x新地址...
```

### 步骤 5：配置合约
部署后需要进行以下配置：

1. **转入奖励代币**
   ```
   向新合约地址转入 AGG 代币作为挖矿奖励
   ```

2. **设置分流地址**（如需要）
   ```javascript
   // 调用 setSplitAddresses 设置 35% 分流地址
   await lpMining.setSplitAddresses(
     [地址1, 地址2],
     [5000, 5000]  // 各 50%
   );
   ```

3. **设置团队等级**（如需要修改默认值）
   ```javascript
   // 调用 setTeamLevels 设置团队等级
   await lpMining.setTeamLevels(
     [1000e18, 5000e18, 10000e18],  // 阈值
     [100, 150, 200]                 // 比例 1%, 1.5%, 2%
   );
   ```

### 步骤 6：更新前端配置
修改 `frontend/src/utils/constants.js`：
```javascript
export const CONTRACTS = {
  LP_MINING: '0x新合约地址',  // 更新为新地址
  // ... 其他地址保持不变
};
```

---

## 三、批量发放奖励使用说明

### 功能说明
管理员可以调用 `batchDistributeRewards` 函数，批量为用户发放挖矿奖励，实现"自动到账"功能。

### 使用方法

#### 方法一：手动调用（通过脚本）
创建脚本 `scripts/batch-distribute.js`：
```javascript
const { ethers } = require("hardhat");

async function main() {
  const lpMining = await ethers.getContractAt(
    "LPMiningV2",
    "0x合约地址"
  );

  // 获取质押用户列表
  const count = await lpMining.getStakerCount();
  console.log(`总质押用户: ${count}`);

  // 分批发放（每批最多50人，防止Gas超限）
  const batchSize = 50;
  for (let i = 0; i < count; i += batchSize) {
    const { result: users } = await lpMining.getStakersPaginated(i, batchSize);

    if (users.length > 0) {
      console.log(`发放第 ${i/batchSize + 1} 批，用户数: ${users.length}`);
      const tx = await lpMining.batchDistributeRewards(users);
      await tx.wait();
      console.log(`批次完成，TX: ${tx.hash}`);
    }
  }

  console.log("所有用户奖励发放完成！");
}

main().catch(console.error);
```

运行：
```bash
npx hardhat run scripts/batch-distribute.js --network bscTestnet
```

#### 方法二：定时任务（每日自动执行）
使用服务器 cron 任务或 Chainlink Automation 实现每日自动执行。

**Linux Cron 示例**：
```bash
# 每天凌晨 2:00 执行
0 2 * * * cd /path/to/project && npx hardhat run scripts/batch-distribute.js --network bscMainnet
```

### 注意事项
1. **Gas 消耗**：每批建议不超过 50 个用户，否则可能超出 Gas 限制
2. **合约余额**：确保合约有足够的 AGG 代币支付奖励
3. **权限**：只有合约 Owner 可以调用此函数

---

## 四、迁移用户数据

**重要提醒**：新部署的合约是全新的，原有合约中的：
- 用户质押数据
- 推荐关系
- 未领取奖励

**都不会自动迁移**！

如果需要迁移用户数据，可以：
1. 让用户从旧合约提取LP，重新质押到新合约
2. 或者编写数据迁移脚本（复杂，需要管理员操作）

---

## 五、验证清单

部署完成后，请检查：

- [ ] 新合约已部署成功
- [ ] 合约 Owner 已设置正确
- [ ] 已转入足够的 AGG 奖励代币
- [ ] 分流地址已配置
- [ ] 前端已更新新合约地址
- [ ] 测试：设置推荐人（无需质押）
- [ ] 测试：质押LP
- [ ] 测试：批量发放奖励
- [ ] 测试：用户领取奖励

---

## 六、合约对比

| 功能 | 旧版本 | V2.1 |
|------|--------|------|
| 推荐人要求 | 必须已质押或是Owner | 无限制 |
| 批量发放 | 不支持 | 支持 |
| 质押用户追踪 | 不支持 | 支持 |

---

## 七、部署脚本示例

创建 `scripts/deploy-lpmining-v2.js`：
```javascript
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);

  // 配置参数
  const rewardToken = "0xAGG代币地址";  // AGG 代币
  const lpToken = "0xLP代币地址";       // LP 代币
  const startTime = Math.floor(Date.now() / 1000) + 60; // 1分钟后开始

  // 部署
  const LPMiningV2 = await ethers.getContractFactory("LPMiningV2");
  const lpMining = await LPMiningV2.deploy(
    rewardToken,
    lpToken,
    startTime
  );

  await lpMining.waitForDeployment();
  const address = await lpMining.getAddress();

  console.log("LPMiningV2 V2.1 deployed to:", address);
  console.log("开始时间:", new Date(startTime * 1000).toLocaleString());

  // 可选：转移 Owner 到客户钱包
  // const customerWallet = "0x客户钱包地址";
  // await lpMining.transferOwnership(customerWallet);
  // console.log("Owner 已转移到:", customerWallet);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

如有问题，请联系开发团队。
