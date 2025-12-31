# BSC DeFi 质押挖矿项目 - 合约功能报告

**项目名称**: BSC LP 质押挖矿系统
**报告日期**: 2025年12月30日
**合约版本**: V2
**网络**: BSC (Binance Smart Chain)

---

## 目录

1. [项目概述](#一项目概述)
2. [ProjectTokenV2 - 带滑点代币](#二projecttokenv2---带滑点代币合约)
3. [TokenMiningV2 - 多档锁仓挖矿](#三tokenminingv2---多档锁仓挖矿合约)
4. [LPMiningV2 - LP质押挖矿](#四lpminingv2---lp质押挖矿合约)
5. [合约地址](#五合约地址bsc-testnet)
6. [架构图](#六合约架构图)
7. [安全特性](#七安全特性)
8. [部署指南](#八部署步骤)
9. [版本历史](#九版本历史)

---

## 一、项目概述

本项目是一个基于 BSC 链的 DeFi 质押挖矿协议，提供 LP 流动性挖矿和代币质押挖矿两种方式。

### 1.1 合约列表

| 合约 | 文件 | 功能 | 状态 |
|------|------|------|------|
| **ProjectTokenV2** | `ProjectTokenV2.sol` | 带买卖滑点的ERC20代币 | ✅ 已完成 |
| **TokenMiningV2** | `TokenMiningV2.sol` | 多档锁仓代币质押挖矿 | ✅ 已完成 |
| **LPMiningV2** | `LPMiningV2.sol` | LP质押挖矿+推荐+团队 | ✅ 已部署 |
| ProjectToken | `ProjectToken.sol` | 基础ERC20代币 (V1) | 已部署 |
| TokenMining | `TokenMining.sol` | 固定收益代币挖矿 (V1) | 已部署 |
| LPMining | `LPMining.sol` | LP质押挖矿 (V1) | 已废弃 |

### 1.2 代币分配

| 用途 | 数量 | 占比 |
|------|------|------|
| LP 流动性挖矿 | 6,000 万 | 60% |
| 代币质押挖矿 | 3,000 万 | 30% |
| 团队/流动性 | 1,000 万 | 10% |
| **总量** | **1 亿** | **100%** |

### 1.3 核心特性总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        项目核心特性                              │
├─────────────────────────────────────────────────────────────────┤
│  代币 (ProjectTokenV2)                                          │
│  ├── 买入滑点: 0%                                               │
│  └── 卖出滑点: 2.8%                                             │
├─────────────────────────────────────────────────────────────────┤
│  代币挖矿 (TokenMiningV2)                                       │
│  ├── 随进随出: 0.4%/天 (年化 146%)                              │
│  ├── 3个月锁仓: 0.6%/天 (年化 219%)                             │
│  ├── 6个月锁仓: 0.8%/天 (年化 292%)                             │
│  └── 12个月锁仓: 1.0%/天 (年化 365%)                            │
├─────────────────────────────────────────────────────────────────┤
│  LP挖矿 (LPMiningV2)                                            │
│  ├── 用户收益: 65%                                              │
│  ├── 分流地址: 35%                                              │
│  ├── 推荐奖励: 20%/10%/5% (三级)                                │
│  └── 团队极差: 1%/1.5%/2% (三级)                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、ProjectTokenV2 - 带滑点代币合约

### 2.1 合约信息

| 属性 | 值 |
|------|-----|
| 文件 | `contracts/ProjectTokenV2.sol` |
| 继承 | ERC20, Ownable |
| 总量 | 1 亿 (100,000,000 × 10^18) |
| 精度 | 18 位小数 |

### 2.2 滑点机制

#### 滑点配置

| 交易类型 | 滑点比例 | 代码值 | 说明 |
|---------|---------|--------|------|
| **买入** | 0% | `buyFee = 0` | 从DEX购买代币无手续费 |
| **卖出** | 2.8% | `sellFee = 280` | 向DEX出售代币扣除2.8% |

#### 滑点判断逻辑

```solidity
function _handleFee(address from, address to, uint256 amount) internal returns (uint256) {
    // 白名单地址免滑点
    if (isExcludedFromFee[from] || isExcludedFromFee[to]) {
        return amount;
    }

    uint256 feeAmount = 0;

    if (isPair[from]) {
        // from 是交易对 → 用户买入 → 收取买入滑点 (0%)
        feeAmount = amount * buyFee / 10000;
    } else if (isPair[to]) {
        // to 是交易对 → 用户卖出 → 收取卖出滑点 (2.8%)
        feeAmount = amount * sellFee / 10000;
    }

    // 扣除滑点转给 feeReceiver
    if (feeAmount > 0) {
        _transfer(from, feeReceiver, feeAmount);
        return amount - feeAmount;
    }

    return amount;
}
```

#### 交易示例

**用户卖出 1000 代币：**

| 步骤 | 说明 | 金额 |
|------|------|------|
| 1 | 用户发起卖出 | 1000 |
| 2 | 计算滑点 (2.8%) | 28 |
| 3 | 滑点转入 feeReceiver | 28 |
| 4 | 实际进入交易对 | 972 |

**用户买入（花费 1000 代币价值的 BNB）：**

| 步骤 | 说明 | 金额 |
|------|------|------|
| 1 | 用户发起买入 | 1000 |
| 2 | 计算滑点 (0%) | 0 |
| 3 | 实际到账 | 1000 |

### 2.3 白名单机制

以下地址免除滑点：

| 地址类型 | 自动添加 | 说明 |
|---------|---------|------|
| 合约部署者 | ✅ | 构造函数自动添加 |
| feeReceiver | ✅ | 构造函数自动添加 |
| 挖矿合约 | ❌ | 需手动添加 |
| 其他地址 | ❌ | 需手动添加 |

### 2.4 核心函数

#### 用户函数

| 函数 | 功能 | 参数 |
|------|------|------|
| `transfer(to, amount)` | 转账 (自动处理滑点) | 接收地址, 金额 |
| `approve(spender, amount)` | 授权 | 授权地址, 金额 |
| `burn(amount)` | 销毁代币 | 销毁数量 |

#### 管理员函数

| 函数 | 功能 | 参数 | 示例 |
|------|------|------|------|
| `setPair(addr, status)` | 设置DEX交易对 | 地址, 布尔值 | `setPair(0x123..., true)` |
| `setPairsBatch(addrs, status)` | 批量设置交易对 | 地址数组, 布尔值 | |
| `setFees(buy, sell)` | 设置滑点比例 | 买入, 卖出 (基数10000) | `setFees(0, 280)` |
| `setFeeReceiver(addr)` | 设置滑点接收地址 | 新地址 | |
| `setExcludedFromFee(addr, status)` | 设置白名单 | 地址, 布尔值 | |
| `setExcludedFromFeeBatch(addrs, status)` | 批量设置白名单 | 地址数组, 布尔值 | |

#### 查询函数

| 函数 | 返回值 |
|------|--------|
| `getFeeConfig()` | 买入滑点, 卖出滑点, 接收地址 |
| `calculateSellAmount(amount)` | 卖出滑点金额, 实际到账金额 |
| `calculateBuyAmount(amount)` | 买入滑点金额, 实际到账金额 |
| `isPair(addr)` | 是否为交易对 |
| `isExcludedFromFee(addr)` | 是否在白名单 |

### 2.5 事件

```solidity
event PairUpdated(address indexed pair, bool status);
event FeeReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);
event FeesUpdated(uint256 buyFee, uint256 sellFee);
event ExcludedFromFee(address indexed account, bool status);
event FeeCollected(address indexed from, address indexed to, uint256 amount, bool isSell);
```

---

## 三、TokenMiningV2 - 多档锁仓挖矿合约

### 3.1 合约信息

| 属性 | 值 |
|------|-----|
| 文件 | `contracts/TokenMiningV2.sol` |
| 继承 | Ownable, ReentrancyGuard |
| 总奖励 | 3,000 万代币 |
| 挖矿方式 | 挖完为止 |

### 3.2 锁仓档位配置

| 档位 | 枚举值 | 锁仓时长 | 日收益率 | 年化收益 (APY) | 代码值 |
|------|--------|---------|---------|---------------|--------|
| **随进随出** | `FLEXIBLE (0)` | 0 天 | **0.4%** | 146% | `dailyRate: 40` |
| **3个月** | `THREE_MONTHS (1)` | 90 天 | **0.6%** | 219% | `dailyRate: 60` |
| **6个月** | `SIX_MONTHS (2)` | 180 天 | **0.8%** | 292% | `dailyRate: 80` |
| **12个月** | `TWELVE_MONTHS (3)` | 365 天 | **1.0%** | 365% | `dailyRate: 100` |

### 3.3 质押机制

#### 多笔独立质押

```
用户 A 的质押记录：
├── StakeRecord #0: 10000 代币, 随进随出, 可随时提取
├── StakeRecord #1: 50000 代币, 3个月锁仓, 2025-03-30 解锁
├── StakeRecord #2: 30000 代币, 6个月锁仓, 2025-06-30 解锁
└── StakeRecord #3: 20000 代币, 12个月锁仓, 2025-12-30 解锁
```

#### 质押记录结构

```solidity
struct StakeRecord {
    uint256 amount;           // 质押数量
    uint256 lastUpdateTime;   // 上次更新时间
    uint256 pendingRewards;   // 待领取奖励
    uint256 unlockTime;       // 解锁时间
    LockTier tier;            // 锁仓档位 (0-3)
    bool active;              // 是否有效
}
```

### 3.4 收益计算

#### 计算公式

```solidity
收益 = 质押数量 × 日收益率 × 质押秒数 / (10000 × 86400)
```

#### 收益示例

| 档位 | 质押数量 | 质押天数 | 日收益率 | 收益计算 | 收益 |
|------|---------|---------|---------|----------|------|
| 随进随出 | 10,000 | 30 | 0.4% | 10000 × 0.4% × 30 | **1,200** |
| 3个月 | 10,000 | 30 | 0.6% | 10000 × 0.6% × 30 | **1,800** |
| 6个月 | 10,000 | 30 | 0.8% | 10000 × 0.8% × 30 | **2,400** |
| 12个月 | 10,000 | 30 | 1.0% | 10000 × 1.0% × 30 | **3,000** |

#### 年化收益对比

| 档位 | 日收益率 | 月收益 | 年收益 | APY |
|------|---------|--------|--------|-----|
| 随进随出 | 0.4% | 12% | 146% | **146%** |
| 3个月 | 0.6% | 18% | 219% | **219%** |
| 6个月 | 0.8% | 24% | 292% | **292%** |
| 12个月 | 1.0% | 30% | 365% | **365%** |

### 3.5 用户操作流程

```
┌─────────────────────────────────────────────────────────────────┐
│                       用户操作流程                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 授权代币                                                    │
│     └── token.approve(miningContract, amount)                   │
│                                                                 │
│  2. 选择档位质押                                                │
│     └── deposit(amount, tier)                                   │
│         ├── tier = 0: 随进随出 (0.4%/天, 随时可提)              │
│         ├── tier = 1: 3个月锁仓 (0.6%/天)                       │
│         ├── tier = 2: 6个月锁仓 (0.8%/天)                       │
│         └── tier = 3: 12个月锁仓 (1.0%/天)                      │
│                                                                 │
│  3. 随时领取收益                                                │
│     ├── claim(stakeId)     // 领取单笔                         │
│     └── claimAll()         // 领取全部                          │
│                                                                 │
│  4. 锁仓到期后提取                                              │
│     └── withdraw(stakeId)  // 提取本金 + 剩余收益               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.6 核心函数

#### 用户函数

| 函数 | 功能 | 参数 | 说明 |
|------|------|------|------|
| `deposit(amount, tier)` | 质押代币 | 数量, 档位(0-3) | 创建新质押记录 |
| `withdraw(stakeId)` | 提取本金+收益 | 质押ID | 需解锁后调用 |
| `claim(stakeId)` | 领取单笔收益 | 质押ID | 随时可调用 |
| `claimAll()` | 领取所有收益 | - | 一次性领取全部 |

#### 查询函数

| 函数 | 返回值 | 说明 |
|------|--------|------|
| `pendingReward(user, stakeId)` | 待领取收益 | 单笔质押 |
| `pendingRewardAll(user)` | 所有待领取收益 | 累计所有 |
| `getUserStakes(user)` | 所有质押记录详情 | 包含全部字段 |
| `getStakeRecord(user, stakeId)` | 单笔质押详情 | 指定ID |
| `getUserInfo(user)` | 用户汇总信息 | 总质押/总领取/记录数 |
| `getUserActiveStakeCount(user)` | 活跃质押数量 | 有效记录数 |
| `getTierConfig(tier)` | 档位配置 | 时长/日收益/年化 |
| `getAllTierConfigs()` | 所有档位配置 | 4个档位数组 |
| `getMiningStatus()` | 挖矿状态 | 总质押/已分发/剩余 |

#### 管理员函数

| 函数 | 功能 | 参数 |
|------|------|------|
| `setTierConfig(tier, duration, dailyRate)` | 修改档位配置 | 档位, 时长(秒), 日收益率 |
| `setTotalRewards(amount)` | 设置总奖励 | 新总量 |
| `emergencyWithdraw(token, amount)` | 紧急提取 | 代币地址, 数量 |

### 3.7 事件

```solidity
event Deposit(address indexed user, uint256 indexed stakeId, uint256 amount, LockTier tier, uint256 unlockTime);
event Withdraw(address indexed user, uint256 indexed stakeId, uint256 amount);
event Claim(address indexed user, uint256 indexed stakeId, uint256 amount);
event ClaimAll(address indexed user, uint256 amount);
event TierConfigUpdated(LockTier tier, uint256 duration, uint256 dailyRate);
event MiningEnded(uint256 totalDistributed);
```

---

## 四、LPMiningV2 - LP质押挖矿合约

### 4.1 合约信息

| 属性 | 值 |
|------|-----|
| 文件 | `contracts/LPMiningV2.sol` |
| 继承 | Ownable, ReentrancyGuard |
| 总奖励 | 6,000 万代币 |
| 挖矿周期 | 3 年 (1095 天) |
| 释放方式 | 线性释放 |

### 4.2 基础挖矿

#### 释放速率

```
每秒释放 = 60,000,000 / (3 × 365 × 24 × 3600) ≈ 0.634 代币/秒
每日释放 = 0.634 × 86400 ≈ 54,795 代币/天
```

#### 用户收益计算

```solidity
用户收益 = (用户质押量 / 总质押量) × 时间段释放量
```

### 4.3 收益分配机制

#### 分配结构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    100% 总挖矿收益                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────── 65% 基础部分 ───────────────┐                 │
│  │                                            │                 │
│  │  ┌── 35% 推荐预留 ──┐                      │                 │
│  │  │ • 1代: 20%       │ 无推荐人             │                 │
│  │  │ • 2代: 10%       │────────┐             │                 │
│  │  │ • 3代: 5%        │        │             │                 │
│  │  └──────────────────┘        │             │                 │
│  │                              │             │                 │
│  │  ┌── 2% 团队预留 ───┐        │             │                 │
│  │  │ • 极差制分配     │ 未分配 │             │                 │
│  │  │ • 最高2%         │────────┤             │                 │
│  │  └──────────────────┘        │             │                 │
│  │                              │             │                 │
│  │  ┌── 28% 用户固定 ──┐        │             │                 │
│  │  │ • 用户直接获得   │        │             │                 │
│  │  └──────────────────┘        │             │                 │
│  │                              │             │                 │
│  └──────────────────────────────│─────────────┘                 │
│                                 │                               │
│  ┌─────────── 35% 分流部分 ─────│─────────────┐                 │
│  │                              │             │                 │
│  │  原35% + 未分配推荐 + 未分配团队◄──────────┘                 │
│  │           │                                │                 │
│  │           ▼                                │                 │
│  │  按配置比例分配到多个地址                   │                 │
│  │                                            │                 │
│  └────────────────────────────────────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 收益计算示例

假设用户领取 **1000 代币** 奖励：

| 项目 | 计算公式 | 金额 |
|------|----------|------|
| 总奖励 | - | 1000 |
| 65% 基础部分 | 1000 × 65% | 650 |
| 35% 分流部分 | 1000 × 35% | 350 |
| 推荐预留 (从65%扣) | 650 × 35% | 227.5 |
| 团队预留 (从65%扣) | 650 × 2% | 13 |
| **用户实得** | 650 - 227.5 - 13 | **409.5** |

### 4.4 三级推荐奖励

#### 推荐比例

| 层级 | 关系 | 比例 | 从65%中扣除 |
|------|------|------|------------|
| 1代 | 直接推荐人 | 20% | 13% |
| 2代 | 推荐人的推荐人 | 10% | 6.5% |
| 3代 | 第三层推荐人 | 5% | 3.25% |
| **合计** | - | **35%** | **22.75%** |

#### 推荐规则

| 规则 | 说明 |
|------|------|
| 设置次数 | 只能设置一次，不可更改 |
| 推荐人要求 | 必须是已质押用户或合约 Owner |
| 循环检测 | 禁止 A→B→A 循环推荐 |
| 直推上限 | 每人最多 500 个直推 |
| 链深度 | 最大 50 层 |

#### 推荐关系示例

```
                    Owner (顶级)
                       │
           ┌───────────┼───────────┐
           │           │           │
        用户A        用户B        用户C
           │           │
     ┌─────┴─────┐     │
     │           │     │
   用户D       用户E  用户F
     │
   用户G

当用户G领取奖励时：
├── 用户D (1代) 获得 20%
├── 用户A (2代) 获得 10%
└── Owner (3代) 获得 5%
```

### 4.5 团队极差奖励

#### 等级配置

| 等级 | 小区业绩要求 | 奖励比例 |
|------|-------------|----------|
| 无等级 | < 1,000 LP | 0% |
| 1级 | ≥ 1,000 LP | 1% |
| 2级 | ≥ 5,000 LP | 1.5% |
| 3级 | ≥ 10,000 LP | 2% |

#### 小区业绩计算

```
小区业绩 = 团队总业绩 - 最大分支业绩 (大区)

示例：
用户A的团队：
├── 分支1 (用户B): 8000 LP  ← 大区
├── 分支2 (用户C): 3000 LP
└── 分支3 (用户D): 2000 LP

团队总业绩 = 8000 + 3000 + 2000 = 13000 LP
大区业绩 = 8000 LP
小区业绩 = 13000 - 8000 = 5000 LP → 2级 (1.5%)
```

#### 极差制原理

```
上级只能获得与下级的【等级差额】奖励

示例链路：用户C → 用户B → 用户A

用户A: 3级 (2%)
用户B: 2级 (1.5%)
用户C: 1级 (1%)

当用户C领取奖励时：
├── 用户B 获得: 1.5% - 1% = 0.5% (与C的差额)
└── 用户A 获得: 2% - 1.5% = 0.5% (与B的差额)

如果用户B也是3级：
├── 用户B 获得: 2% - 1% = 1% (与C的差额)
└── 用户A 获得: 2% - 2% = 0% (无差额，不获得)
```

### 4.6 锁仓机制

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 锁仓期 | 30 天 | 可由管理员调整 |
| 重置规则 | 每次质押重置 | 新质押会延长锁仓期 |
| 提取限制 | 锁仓期内禁止 | 到期后可自由提取 |

### 4.7 核心函数

#### 用户函数

| 函数 | 功能 | 参数 |
|------|------|------|
| `setReferrer(address)` | 设置推荐人 | 推荐人地址 |
| `deposit(amount)` | 质押 LP | 质押数量 |
| `withdraw(amount)` | 提取 LP | 提取数量 |
| `claim()` | 领取挖矿收益 | - |
| `claimReferralRewards()` | 领取推荐奖励 | - |
| `claimTeamRewards()` | 领取团队奖励 | - |

#### 查询函数

| 函数 | 返回值 |
|------|--------|
| `pendingReward(user)` | 待领取挖矿收益 |
| `getUserInfo(user)` | 完整用户信息 |
| `getLockStatus(user)` | 锁仓状态 |
| `getReferrals(user)` | 直推列表 |
| `getTeamLevelConfig()` | 团队等级配置 |
| `getSplitConfig()` | 分流地址配置 |
| `getMiningStatus()` | 挖矿状态 |
| `getDistributionStats()` | 分发统计 |

#### 管理员函数

| 函数 | 功能 |
|------|------|
| `setLockDuration(duration)` | 设置锁仓时长 |
| `setMiningParams(rewards, duration)` | 设置挖矿参数 |
| `setDistributionRates(userShare, splitShare)` | 设置分配比例 |
| `setReferralRates(l1, l2, l3)` | 设置推荐比例 |
| `setTeamLevels(thresholds, rates)` | 设置团队等级 |
| `setSplitAddresses(addrs, rates)` | 设置分流地址 |
| `adminTransferLP(to, amount)` | 管理员转移LP |
| `emergencyWithdraw(token, amount)` | 紧急提取 |

### 4.8 事件

```solidity
event Deposit(address indexed user, uint256 amount, uint256 unlockTime);
event Withdraw(address indexed user, uint256 amount);
event Claim(address indexed user, uint256 userAmount, uint256 splitAmount);
event ReferrerSet(address indexed user, address indexed referrer);
event ReferralReward(address indexed user, address indexed referrer, uint256 level, uint256 amount);
event TeamReward(address indexed user, uint256 amount);
event SplitDistributed(address indexed to, uint256 amount);
event LockDurationUpdated(uint256 oldDuration, uint256 newDuration);
event MiningParamsUpdated(uint256 totalRewards, uint256 miningDuration, uint256 rewardPerSecond);
```

---

## 五、合约地址（BSC Testnet）

| 合约 | 地址 | 状态 |
|------|------|------|
| ProjectToken (V1) | `0x57E9cBF035776321F2A0d4AE74785FB56bD48e1B` | ✅ 已部署 |
| LP Token | `0xf7839D5B542b6d278d42f61eeB5ca61127C2e652` | ✅ 已部署 |
| LPMiningV2 | `0x26BdE5cAcfe2b6Ad5084b690B2D9cF98CB426852` | ✅ 已部署 |
| TokenMining (V1) | `0x01e2F695b7fF307A07bD20F29Bc08f565dF2199A` | ✅ 已部署 |
| **ProjectTokenV2** | `0xa3C9744b4a3C986E01d81009134589FF67748435` | ✅ 已部署 |
| **TokenMiningV2** | `0x985E09F19DCCEe529a259ae4DD08D641399F4ea7` | ✅ 已部署 |

---

## 六、合约架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BSC DeFi 质押系统架构                        │
└─────────────────────────────────────────────────────────────────────┘

                        ┌─────────────────────┐
                        │   ProjectTokenV2    │
                        │                     │
                        │  • 总量: 1亿        │
                        │  • 买入滑点: 0%     │
                        │  • 卖出滑点: 2.8%   │
                        └──────────┬──────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   LPMiningV2    │     │ TokenMiningV2   │     │   PancakeSwap   │
│                 │     │                 │     │                 │
│ • 6000万奖励    │     │ • 3000万奖励    │     │ • LP Token      │
│ • 3年线性释放   │     │ • 多档锁仓      │     │ • 交易对        │
│ • 65%/35%分配   │     │                 │     │                 │
│                 │     │ 随进随出: 0.4%  │     │ 买入: 0% 滑点   │
│ 推荐: 20/10/5%  │     │ 3个月: 0.6%     │     │ 卖出: 2.8% 滑点 │
│ 团队: 1/1.5/2%  │     │ 6个月: 0.8%     │     │                 │
│ 锁仓: 30天      │     │ 12个月: 1.0%    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                         │
         │    ┌────────────────────┘
         │    │
         ▼    ▼
┌─────────────────┐
│     用户        │
│                 │
│ • 质押 LP/代币  │
│ • 领取收益      │
│ • 推荐好友      │
└─────────────────┘
```

---

## 七、安全特性

| 特性 | 合约 | 说明 |
|------|------|------|
| **ReentrancyGuard** | 全部 | 防止重入攻击 |
| **SafeERC20** | 全部 | 安全的代币转账 |
| **Ownable** | 全部 | 管理员权限控制 |
| **循环推荐检测** | LPMiningV2 | 防止 A→B→A 循环 |
| **深度限制** | LPMiningV2 | 推荐链最大 50 层 |
| **人数限制** | LPMiningV2 | 每人最多 500 直推 |
| **滑点上限** | ProjectTokenV2 | 最高 10% |
| **收益率上限** | TokenMiningV2 | 日收益最高 10% |

---

## 八、部署步骤

### 8.1 部署 V2 合约

```bash
# 编译合约
npx hardhat compile

# 部署到测试网
npx hardhat run scripts/deploy-v2-contracts.js --network bscTestnet

# 部署到主网
npx hardhat run scripts/deploy-v2-contracts.js --network bscMainnet
```

### 8.2 充值奖励代币

```bash
npx hardhat run scripts/fund-tokenMiningV2.js --network bscTestnet
```

### 8.3 配置 DEX 交易对

```javascript
// 创建流动性池后，设置交易对地址
await tokenV2.setPair("<LP_PAIR_ADDRESS>", true);

// 将挖矿合约加入白名单
await tokenV2.setExcludedFromFee(tokenMiningV2Address, true);
await tokenV2.setExcludedFromFee(lpMiningV2Address, true);
```

### 8.4 验证合约

```bash
# 验证 ProjectTokenV2
npx hardhat verify --network bscTestnet <TOKEN_ADDRESS> "Project Token V2" "PTKV2" "<FEE_RECEIVER>"

# 验证 TokenMiningV2
npx hardhat verify --network bscTestnet <MINING_ADDRESS> <STAKING_TOKEN> <REWARD_TOKEN> <START_TIME>
```

---

## 九、版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| V1.0 | 2025-12-29 | 初始版本：LPMining + TokenMining + ProjectToken |
| V2.0 | 2025-12-30 | **TokenMiningV2**: 多档锁仓 (0.4%/0.6%/0.8%/1.0%) |
| | | **ProjectTokenV2**: 买卖滑点 (买0%/卖2.8%) |
| | | 文档更新：完整功能说明 |

---

## 附录：快速参考

### A. 滑点配置速查

| 操作 | 滑点 | 代码值 |
|------|------|--------|
| 买入 | 0% | `buyFee = 0` |
| 卖出 | 2.8% | `sellFee = 280` |

### B. 锁仓收益速查

| 档位 | 时长 | 日收益 | 年化 |
|------|------|--------|------|
| 随进随出 | 0天 | 0.4% | 146% |
| 3个月 | 90天 | 0.6% | 219% |
| 6个月 | 180天 | 0.8% | 292% |
| 12个月 | 365天 | 1.0% | 365% |

### C. LP挖矿分配速查

| 类型 | 比例 |
|------|------|
| 用户基础 | 65% (扣除推荐和团队后约28%) |
| 分流地址 | 35% + 未分配部分 |
| 1代推荐 | 20% (从65%扣) |
| 2代推荐 | 10% (从65%扣) |
| 3代推荐 | 5% (从65%扣) |
| 团队极差 | 最高2% (从65%扣) |
