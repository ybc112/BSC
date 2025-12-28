# BSC 主网上线完整指南

本指南将一步步教你如何将 DeFi 挖矿项目部署到 BSC 主网。

---

## 目录

1. [准备工作](#1-准备工作)
2. [部署代币](#2-部署代币)
3. [创建流动性池](#3-创建流动性池)
4. [部署挖矿合约](#4-部署挖矿合约)
5. [验证合约](#5-验证合约)
6. [转入奖励代币](#6-转入奖励代币)
7. [更新前端配置](#7-更新前端配置)
8. [部署前端](#8-部署前端)
9. [最终检查](#9-最终检查)

---

## 1. 准备工作

### 1.1 钱包准备

- [ ] 准备一个部署专用钱包（建议使用 MetaMask）
- [ ] 确保钱包中有足够的 BNB（建议至少 0.5 BNB）
- [ ] **备份好私钥！**

### 1.2 环境配置

在项目根目录创建 `.env` 文件（如果没有的话）：

```bash
# .env 文件内容
PRIVATE_KEY=你的钱包私钥（不要加0x前缀也可以）
BSCSCAN_API_KEY=你的BscScan API Key
```

**获取 BscScan API Key：**
1. 访问 https://bscscan.com/register 注册账号
2. 登录后访问 https://bscscan.com/myapikey
3. 点击 "Add" 创建新的 API Key

### 1.3 安装依赖

```bash
cd /mnt/e/dapp/BSC
npm install
```

### 1.4 编译合约

```bash
npx hardhat compile
```

---

## 2. 部署代币

### 情况 A：你已经有代币

如果你已经有 RWT 代币在主网上，跳到 [第 3 步](#3-创建流动性池)。

### 情况 B：需要部署新代币

运行以下命令部署代币：

```bash
npx hardhat run scripts/deploy-token.js --network bscMainnet
```

或者使用 Remix IDE 部署：
1. 访问 https://remix.ethereum.org
2. 创建新文件，粘贴 `contracts/MockToken.sol` 代码
3. 编译后连接 MetaMask 部署到 BSC 主网

**记录代币地址：** `___________________________`

---

## 3. 创建流动性池

### 3.1 添加流动性到 PancakeSwap

1. 打开 PancakeSwap: https://pancakeswap.finance/add

2. 点击 "Add Liquidity"

3. 选择代币对：
   - 代币 A：你的 RWT 代币地址
   - 代币 B：BNB 或 USDT（推荐 BNB）

4. 输入初始流动性数量：
   - 建议：至少放入 5-10 BNB 等值的流动性
   - 例如：1,000,000 RWT + 5 BNB

5. 点击 "Approve RWT" -> 确认交易

6. 点击 "Add Liquidity" -> 确认交易

### 3.2 获取 LP Token 地址

添加流动性后：

1. 访问 https://bscscan.com
2. 搜索你的钱包地址
3. 在 "Token" 标签页找到 "Cake-LP" 代币
4. 点击进入，复制合约地址

**记录 LP Token 地址：** `___________________________`

---

## 4. 部署挖矿合约

### 4.1 修改部署配置

编辑 `scripts/deploy-mainnet.js`，修改配置区域：

```javascript
const CONFIG = {
  // 已有代币地址
  EXISTING_TOKEN_ADDRESS: "你的RWT代币地址",

  // LP Token 地址（上一步获取的）
  LP_TOKEN_ADDRESS: "你的LP Token地址",

  // 挖矿开始时间（Unix时间戳）
  // 可以用这个网站转换：https://www.unixtimestamp.com/
  // 设为 0 表示部署后 5 分钟开始
  START_TIME: 0,

  DEPLOY_NEW_TOKEN: false,
  DEPLOY_TOKEN_MINING: true,
  DEPLOY_LP_MINING: true,
};
```

### 4.2 运行部署

```bash
npx hardhat run scripts/deploy-mainnet.js --network bscMainnet
```

部署成功后会显示：
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

**记录合约地址：**
- LP Mining: `___________________________`
- Token Mining: `___________________________`

---

## 5. 验证合约

在 BscScan 上验证合约代码，这样用户可以查看源码。

### 5.1 验证 LP Mining 合约

```bash
npx hardhat verify --network bscMainnet LP_MINING_ADDRESS REWARD_TOKEN_ADDRESS LP_TOKEN_ADDRESS START_TIME
```

示例：
```bash
npx hardhat verify --network bscMainnet 0x1234... 0xabcd... 0x5678... 1703980800
```

### 5.2 验证 Token Mining 合约

```bash
npx hardhat verify --network bscMainnet TOKEN_MINING_ADDRESS REWARD_TOKEN_ADDRESS REWARD_TOKEN_ADDRESS START_TIME
```

验证成功后，可以在 BscScan 上看到绿色的 "Contract" 标志。

---

## 6. 转入奖励代币

**重要：在挖矿开始前必须完成！**

### 6.1 向 LP Mining 合约转入代币

需要转入：**60,000,000 RWT**

1. 打开 MetaMask
2. 选择 RWT 代币
3. 点击 "Send"
4. 收款地址填入 **LP Mining 合约地址**
5. 数量填入 **60000000**
6. 确认交易

### 6.2 向 Token Mining 合约转入代币

需要转入：**30,000,000 RWT**

同样的步骤，收款地址填入 **Token Mining 合约地址**

### 6.3 验证余额

在 BscScan 上检查合约的代币余额：
- https://bscscan.com/address/LP_MINING_ADDRESS#tokentxns
- https://bscscan.com/address/TOKEN_MINING_ADDRESS#tokentxns

---

## 7. 更新前端配置

### 7.1 修改合约地址

编辑 `frontend/src/utils/constants.js`：

```javascript
// BSC 主网合约地址
export const CONTRACTS = {
  REWARD_TOKEN: '你的RWT代币地址',
  LP_TOKEN: '你的LP Token地址',
  LP_MINING: '你的LP Mining合约地址',
  TOKEN_MINING: '你的Token Mining合约地址',
};

// 切换到主网
export const CURRENT_NETWORK = NETWORKS.BSC_MAINNET;
```

### 7.2 测试前端

```bash
cd frontend
npm install
npm run dev
```

打开浏览器访问 http://localhost:5173，确保：
- [ ] 能正确连接到 BSC 主网
- [ ] 显示的合约数据正确
- [ ] 所有功能正常工作

---

## 8. 部署前端

### 8.1 构建前端

```bash
cd frontend
npm run build
```

### 8.2 部署选项

**选项 A：Vercel（推荐，免费）**

1. 访问 https://vercel.com
2. 使用 GitHub 登录
3. 导入你的项目仓库
4. 设置 Root Directory 为 `frontend`
5. 点击 Deploy

**选项 B：Netlify（免费）**

1. 访问 https://netlify.com
2. 拖拽 `frontend/dist` 文件夹到页面上
3. 自动部署完成

**选项 C：自己的服务器**

将 `frontend/dist` 文件夹上传到你的服务器。

---

## 9. 最终检查

### 部署完成检查清单

- [ ] 代币已部署并记录地址
- [ ] PancakeSwap 流动性池已创建
- [ ] LP Mining 合约已部署
- [ ] Token Mining 合约已部署
- [ ] 两个合约都已在 BscScan 上验证
- [ ] LP Mining 合约已收到 6000 万代币
- [ ] Token Mining 合约已收到 3000 万代币
- [ ] 前端配置已更新为主网地址
- [ ] 前端已部署上线
- [ ] 所有功能测试通过

### 合约地址汇总

| 合约 | 地址 | BscScan |
|------|------|---------|
| RWT Token | | [查看]() |
| LP Token | | [查看]() |
| LP Mining | | [查看]() |
| Token Mining | | [查看]() |

### 重要链接

- 前端网址：`___________________________`
- LP Mining 合约：`https://bscscan.com/address/___`
- Token Mining 合约：`https://bscscan.com/address/___`
- PancakeSwap 交易：`https://pancakeswap.finance/swap?outputCurrency=___`

---

## 常见问题

### Q: 部署失败 "insufficient funds"
A: 钱包 BNB 余额不足，需要充值更多 BNB。

### Q: 验证失败 "Already Verified"
A: 合约已经验证过了，无需重复验证。

### Q: 前端连接不到合约
A: 检查 constants.js 中的地址是否正确，网络是否切换到 BSC 主网。

### Q: 挖矿开始后没有收益
A: 检查合约中是否有足够的奖励代币，以及用户是否有质押。

---

## 安全提醒

1. **私钥安全**：永远不要在公共场合暴露私钥
2. **多签建议**：考虑使用 Gnosis Safe 多签钱包作为 Owner
3. **监控**：部署后持续监控合约状态
4. **备份**：保存好所有合约地址和部署信息

---

祝你上线顺利！ 🚀
