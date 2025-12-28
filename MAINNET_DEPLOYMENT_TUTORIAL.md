# BSC 主网部署完整教学

本教程将手把手教你如何将 DeFi 质押挖矿项目部署到 BSC 主网。

---

## 目录

1. [部署前准备](#一部署前准备)
2. [部署流程总览](#二部署流程总览)
3. [详细操作步骤](#三详细操作步骤)
4. [前端部署](#四前端部署)
5. [上线后维护](#五上线后维护)
6. [常见问题](#六常见问题)

---

## 一、部署前准备

### 1.1 准备清单

在开始之前，请确保你已准备好以下内容：

| 准备项 | 说明 | 状态 |
|--------|------|------|
| 部署钱包 | 一个专用于部署的 MetaMask 钱包 | [ ] |
| BNB 余额 | 钱包中至少 0.5 BNB（用于 Gas 费） | [ ] |
| 私钥备份 | 确保私钥已安全备份 | [ ] |
| BscScan API Key | 用于验证合约代码 | [ ] |
| 代币准备 | 决定是部署新代币还是使用已有代币 | [ ] |

### 1.2 获取 BscScan API Key

1. 访问 https://bscscan.com/register 注册账号
2. 登录后访问 https://bscscan.com/myapikey
3. 点击 **"Add"** 创建新的 API Key
4. 复制 API Key 备用

### 1.3 配置环境变量

编辑项目根目录的 `.env` 文件：

```bash
# 你的部署钱包私钥（不要泄露！）
PRIVATE_KEY=你的私钥（不需要0x前缀）

# BscScan API Key
BSCSCAN_API_KEY=你的BscScan_API_Key
```

> ⚠️ **安全警告**: 永远不要将 `.env` 文件提交到 Git 或分享给他人！

### 1.4 安装依赖

```bash
cd /mnt/e/dapp/BSC
npm install
```

### 1.5 编译合约

```bash
npx hardhat compile
```

确保编译成功，没有错误。

---

## 二、部署流程总览

```
┌─────────────────────────────────────────────────────────────┐
│                    BSC 主网部署流程                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  步骤1: 部署代币                                             │
│    ↓                                                        │
│  步骤2: 在 PancakeSwap 创建流动性池 → 获取 LP Token 地址      │
│    ↓                                                        │
│  步骤3: 部署 LP Mining 合约                                  │
│    ↓                                                        │
│  步骤4: 部署 Token Mining 合约                               │
│    ↓                                                        │
│  步骤5: 验证所有合约代码                                      │
│    ↓                                                        │
│  步骤6: 转入奖励代币到合约                                    │
│    ↓                                                        │
│  步骤7: 更新前端配置                                         │
│    ↓                                                        │
│  步骤8: 部署前端                                             │
│    ↓                                                        │
│  步骤9: 测试验证                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、详细操作步骤

### 步骤 1: 部署代币

#### 方式 A: 使用脚本部署新代币

如果你需要部署一个新的 ERC20 代币：

```bash
npx hardhat run scripts/deploy-token.js --network bscMainnet
```

部署成功后会显示代币地址，记录下来。

#### 方式 B: 使用已有代币

如果你已经有代币在主网上，直接跳到步骤 2，记下你的代币合约地址。

---

### 步骤 2: 在 PancakeSwap 创建流动性池

这是最重要的一步，创建 LP 代币。

#### 2.1 打开 PancakeSwap

访问: https://pancakeswap.finance/add

#### 2.2 添加流动性

1. 点击 **"Add Liquidity"**
2. 选择代币对：
   - **代币 A**: 你的项目代币地址
   - **代币 B**: BNB 或 USDT（推荐 BNB，交易量大）

3. 输入初始流动性数量：
   ```
   建议配比（示例）：
   - 1,000,000 代币 + 10 BNB
   - 或等值 USDT
   ```

4. 点击 **"Approve [你的代币]"** → 确认 MetaMask 交易
5. 点击 **"Add Liquidity"** → 确认交易

#### 2.3 获取 LP Token 地址

添加流动性后，需要找到 LP Token 的合约地址：

**方法 1: 通过 BscScan 查找**
1. 访问 https://bscscan.com
2. 搜索你的钱包地址
3. 点击 **"Token"** 标签
4. 找到 **"Pancake LPs"** 或 **"Cake-LP"** 代币
5. 点击进入，复制合约地址

**方法 2: 通过 PancakeSwap 查找**
1. 在 PancakeSwap 的 Liquidity 页面
2. 找到你的流动性仓位
3. 点击查看详情，获取 LP 地址

**记录 LP Token 地址**: `_______________________________________`

---

### 步骤 3: 部署 LP Mining 合约

#### 3.1 修改部署配置

编辑 `scripts/deploy-mainnet.js`，修改配置：

```javascript
const CONFIG = {
  // 设为 false，使用已有代币
  DEPLOY_NEW_TOKEN: false,

  // 填入你的代币地址
  EXISTING_TOKEN_ADDRESS: "0x你的代币地址",

  // 填入步骤2获取的 LP Token 地址
  LP_TOKEN_ADDRESS: "0x你的LP_Token地址",

  // 挖矿开始时间（Unix时间戳）
  // 设为 0 表示部署后 5 分钟开始
  // 或使用 https://www.unixtimestamp.com/ 转换指定时间
  START_TIME: 0,

  DEPLOY_TOKEN_MINING: true,
  DEPLOY_LP_MINING: true,
};
```

#### 3.2 执行部署

```bash
npx hardhat run scripts/deploy-mainnet.js --network bscMainnet
```

部署成功后会输出：
```
========================================
部署完成！
========================================
代币地址: 0x...
LP Mining: 0x...
Token Mining: 0x...
开始时间: 2025-xx-xx
========================================
```

**记录合约地址**:
- LP Mining: `_______________________________________`
- Token Mining: `_______________________________________`

---

### 步骤 4: 验证合约代码

在 BscScan 上验证合约，让用户可以查看源码。

#### 4.1 验证 LP Mining 合约

```bash
npx hardhat verify --network bscMainnet \
  LP_MINING_ADDRESS \
  REWARD_TOKEN_ADDRESS \
  LP_TOKEN_ADDRESS \
  START_TIME
```

**示例**:
```bash
npx hardhat verify --network bscMainnet \
  0x1234567890123456789012345678901234567890 \
  0xabcdef1234567890abcdef1234567890abcdef12 \
  0x5678901234567890567890123456789012345678 \
  1703980800
```

#### 4.2 验证 Token Mining 合约

```bash
npx hardhat verify --network bscMainnet \
  TOKEN_MINING_ADDRESS \
  REWARD_TOKEN_ADDRESS \
  REWARD_TOKEN_ADDRESS \
  START_TIME
```

> 注意: Token Mining 的质押代币和奖励代币是同一个地址

验证成功后，在 BscScan 上会显示绿色的 **"Contract"** 标志。

---

### 步骤 5: 转入奖励代币

**这一步非常重要！挖矿开始前必须完成！**

#### 5.1 向 LP Mining 合约转入代币

需要转入: **60,000,000 代币**

1. 打开 MetaMask
2. 选择你的项目代币
3. 点击 **"Send"**
4. 收款地址: **LP Mining 合约地址**
5. 数量: **60000000**
6. 确认交易

#### 5.2 向 Token Mining 合约转入代币

需要转入: **30,000,000 代币**

同样的步骤，收款地址填入 **Token Mining 合约地址**

#### 5.3 验证余额

在 BscScan 上检查合约的代币余额是否正确：
- LP Mining: https://bscscan.com/address/LP_MINING_ADDRESS#tokentxns
- Token Mining: https://bscscan.com/address/TOKEN_MINING_ADDRESS#tokentxns

---

### 步骤 6: 更新前端配置

#### 6.1 修改合约地址

编辑 `frontend/src/utils/constants.js`:

```javascript
// BSC 主网合约地址
export const CONTRACTS = {
  REWARD_TOKEN: '你的代币地址',
  LP_TOKEN: '你的LP_Token地址',
  LP_MINING: '你的LP_Mining合约地址',
  TOKEN_MINING: '你的Token_Mining合约地址',
};

// 切换到主网
export const CURRENT_NETWORK = NETWORKS.BSC_MAINNET;
```

#### 6.2 本地测试

```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173，确保：
- [ ] 能连接到 BSC 主网
- [ ] 显示的合约数据正确
- [ ] 所有功能正常工作

---

## 四、前端部署

### 方式 A: 部署到 Vercel（推荐，免费）

1. 将代码推送到 GitHub
2. 访问 https://vercel.com
3. 使用 GitHub 登录
4. 点击 **"Import Project"**
5. 选择你的仓库
6. 设置:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
7. 点击 **"Deploy"**

部署完成后会获得一个域名，如: `https://your-project.vercel.app`

### 方式 B: 部署到 Netlify（免费）

1. 在本地构建前端:
   ```bash
   cd frontend
   npm run build
   ```

2. 访问 https://netlify.com
3. 将 `frontend/dist` 文件夹拖拽到页面上
4. 自动部署完成

### 方式 C: 部署到自己的服务器

1. 构建前端:
   ```bash
   cd frontend
   npm run build
   ```

2. 将 `frontend/dist` 目录上传到服务器

3. 配置 Nginx:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       root /path/to/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

---

## 五、上线后维护

### 5.1 监控清单

| 监控项 | 方法 | 频率 |
|--------|------|------|
| 合约余额 | BscScan 查看 | 每日 |
| 用户质押量 | 前端/BscScan | 每日 |
| 异常交易 | 设置 BscScan 告警 | 实时 |
| 前端可用性 | 访问测试 | 每日 |

### 5.2 重要操作记录

建议创建一个私密文档记录：

```
项目上线记录
============

部署时间: YYYY-MM-DD HH:MM
部署账户: 0x...
挖矿开始时间: YYYY-MM-DD HH:MM

合约地址:
- 代币: 0x...
- LP Token: 0x...
- LP Mining: 0x...
- Token Mining: 0x...

前端地址: https://...

备注:
...
```

### 5.3 紧急情况处理

如果发现问题，你有以下管理员功能可用：

| 函数 | 用途 | 何时使用 |
|------|------|----------|
| `emergencyWithdraw()` | 紧急提取代币 | 发现严重漏洞时 |
| `adminTransferLP()` | 转移 LP 代币 | 需要迁移时 |
| `setTeamLevels()` | 修改团队等级 | 调整激励参数 |

---

## 六、常见问题

### Q1: 部署失败 "insufficient funds"
**A**: 钱包 BNB 余额不足，需要充值更多 BNB。建议至少准备 0.5 BNB。

### Q2: 验证失败 "Already Verified"
**A**: 合约已经验证过了，无需重复验证。

### Q3: 验证失败 "Bytecode mismatch"
**A**: 构造函数参数不匹配。确保验证命令中的参数与部署时完全一致。

### Q4: 前端连接不到合约
**A**:
1. 检查 `constants.js` 中的地址是否正确
2. 确认 MetaMask 已切换到 BSC 主网
3. 清除浏览器缓存重试

### Q5: 挖矿开始后用户没有收益
**A**:
1. 检查合约中是否有足够的奖励代币
2. 确认挖矿开始时间已过
3. 确认用户已成功质押

### Q6: Gas 费过高怎么办
**A**:
1. 选择网络不拥堵的时间部署
2. 可以在 hardhat.config.js 中设置 gasPrice
3. BSC 的 Gas 费通常很低（约 5 Gwei）

---

## 费用估算

### 部署费用（一次性）

| 操作 | 预估 Gas | 预估费用 (BNB) |
|------|----------|----------------|
| 部署代币 | ~1,500,000 | ~0.0075 |
| 部署 LP Mining | ~2,700,000 | ~0.0135 |
| 部署 Token Mining | ~900,000 | ~0.0045 |
| 转入奖励代币 x2 | ~100,000 | ~0.0005 |
| 验证合约 | 免费 | 0 |
| **总计** | | **~0.03 BNB** |

*按 5 Gwei Gas Price 估算

### 用户操作费用

| 操作 | 预估费用 (BNB) | 预估费用 (USD)* |
|------|----------------|-----------------|
| 质押 | ~0.0008 | ~$0.48 |
| 解押 | ~0.0007 | ~$0.42 |
| 领取收益 | ~0.0011 | ~$0.66 |

*按 BNB = $600 估算

---

## 安全建议

### 部署前
- [ ] 在测试网充分测试
- [ ] 代码经过审计（建议）
- [ ] 私钥安全存储

### 部署后
- [ ] 考虑使用多签钱包管理 Owner 权限
- [ ] 设置合约事件监控告警
- [ ] 保存所有部署信息的备份

### 长期运营
- [ ] 定期检查合约状态
- [ ] 关注 BSC 网络公告
- [ ] 准备应急预案

---

## 快速命令参考

```bash
# 编译合约
npx hardhat compile

# 部署到测试网（先测试）
npx hardhat run scripts/deploy-testnet-full.js --network bscTestnet

# 部署到主网
npx hardhat run scripts/deploy-mainnet.js --network bscMainnet

# 验证合约
npx hardhat verify --network bscMainnet CONTRACT_ADDRESS ARGS...

# 运行测试
npm test

# 查看测试覆盖率
npm run coverage

# 启动前端开发服务器
cd frontend && npm run dev

# 构建前端
cd frontend && npm run build
```

---

祝你上线顺利！如有问题，随时查阅本文档。
