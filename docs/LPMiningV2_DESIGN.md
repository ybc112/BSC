# LPMiningV2 合约功能设计文档

## 概述

LPMiningV2 是 LP 质押挖矿合约的升级版本，主要特点：

- **灵活的收益分配**：支持多地址分流
- **三级推荐系统**：20%/10%/5% 佣金
- **团队极差奖励**：根据小区业绩享受差额奖励
- **锁仓机制**：可配置锁仓期，无上限限制
- **全参数可配置**：所有核心参数均可后台调整

---

## 核心参数配置

### 可配置参数一览

| 参数 | 默认值 | 管理员函数 | 说明 |
|------|--------|-----------|------|
| 总奖励 | 6000万代币 | `setMiningParams()` | 可随时调整 |
| 挖矿周期 | 3年 | `setMiningParams()` | 可随时调整 |
| 用户基础占比 | 65% | `setDistributionRates()` | 与分流占比之和=100% |
| 分流占比 | 35% | `setDistributionRates()` | 与用户占比之和=100% |
| 1代推荐比例 | 20% | `setReferralRates()` | 可调整 |
| 2代推荐比例 | 10% | `setReferralRates()` | 可调整 |
| 3代推荐比例 | 5% | `setReferralRates()` | 可调整 |
| 锁仓天数 | 30天 | `setLockDuration()` | **无上限** |
| 团队等级阈值 | 1000/5000/10000 LP | `setTeamLevels()` | 可调整 |
| 团队奖励比例 | 1%/1.5%/2% | `setTeamLevels()` | 可调整 |

### 固定常量（不可更改）

```solidity
DISTRIBUTION_BASE = 10000      // 比例基数
MAX_REFERRAL_DEPTH = 50        // 最大推荐深度
MAX_DIRECT_REFERRALS = 500     // 最大直推数
```

---

## 锁仓机制

### 功能说明

- 用户质押后进入锁仓期，锁仓期内不能提取 LP
- **锁仓天数无上限**，管理员可设置任意时长
- 每次质押都会重置锁仓期

### 管理员配置

```solidity
// 设置锁仓60天
setLockDuration(60 days);

// 设置锁仓1年
setLockDuration(365 days);

// 设置锁仓3年（无上限）
setLockDuration(3 * 365 days);
```

### 用户查询

```solidity
function getLockStatus(address _user) external view returns (
    uint256 unlockTime,      // 解锁时间戳
    uint256 remainingTime,   // 剩余锁仓秒数
    bool isLocked            // 是否在锁仓中
);
```

---

## 收益分配逻辑

### 分配流程图

```
100% 总收益
│
├── 用户基础部分（默认65%，可配置）
│   │
│   ├── 推荐预留（默认35%：20%+10%+5%）
│   │   ├── 有1代推荐人 → 分配20%
│   │   ├── 有2代推荐人 → 分配10%
│   │   ├── 有3代推荐人 → 分配5%
│   │   └── 没有推荐人 → 转入分流部分
│   │
│   ├── 团队预留（最高等级比例，默认2%）
│   │   ├── 根据小区业绩极差分配
│   │   └── 未分配部分 → 转入分流部分
│   │
│   └── 用户固定获得（65%-35%-2%=28%）
│
└── 分流部分（默认35%，可配置）
    │
    └── 原分流 + 未分配推荐 + 未分配团队
        │
        └── 按配置比例分配到多个地址
```

### 计算示例

```
假设用户总收益 = 1000 代币，配置为默认值

1. 基础部分 = 1000 × 65% = 650 代币
2. 分流部分 = 1000 × 35% = 350 代币

从基础部分预留：
- 推荐预留 = 650 × 35% = 227.5 代币
- 团队预留 = 650 × 2% = 13 代币
- 用户固定 = 650 - 227.5 - 13 = 409.5 代币

实际分配示例（假设只有1代推荐人，无团队奖励）：
- 推荐实际分配 = 650 × 20% = 130 代币（给1代）
- 团队实际分配 = 0 代币
- 未分配推荐 = 227.5 - 130 = 97.5 代币
- 未分配团队 = 13 - 0 = 13 代币

最终分配：
- 用户获得：409.5 代币
- 1代推荐人：130 代币
- 分流部分：350 + 97.5 + 13 = 460.5 代币
```

---

## 推荐奖励系统

### 奖励比例（可配置）

| 推荐层级 | 默认比例 | 说明 |
|----------|----------|------|
| 1代推荐人 | 20% | 直接推荐人 |
| 2代推荐人 | 10% | 推荐人的推荐人 |
| 3代推荐人 | 5% | 第三层推荐人 |

### 配置示例

```solidity
// 修改为 15%/8%/3%
setReferralRates(1500, 800, 300);

// 修改为 25%/15%/10%
setReferralRates(2500, 1500, 1000);
```

### 规则

1. 推荐人只能设置一次，不可更改
2. 推荐人必须是已质押用户或合约 Owner
3. 防止循环推荐（A推荐B，B不能推荐A）
4. 每个推荐人最多 500 个直推
5. 推荐链最大深度 50 层

---

## 团队极差奖励系统

### 等级配置（可调整）

| 等级 | 默认小区业绩要求 | 默认奖励比例 |
|------|-----------------|-------------|
| 1级 | ≥ 1,000 LP | 1% |
| 2级 | ≥ 5,000 LP | 1.5% |
| 3级 | ≥ 10,000 LP | 2% |

### 配置示例

```solidity
// 修改为 5 个等级
setTeamLevels(
    [500e18, 2000e18, 5000e18, 10000e18, 50000e18],  // 业绩阈值
    [50, 100, 150, 200, 300]                          // 0.5%, 1%, 1.5%, 2%, 3%
);
```

### 极差制原理

```
假设：
- A（3级，2%）推荐了 B（2级，1.5%）推荐了 C（1级，1%）推荐了 D（无等级）
- D 领取收益时：

分配过程：
1. C 等级1%，D 等级0%，差额1% → C 获得 1%
2. B 等级1.5%，C 等级1%，差额0.5% → B 获得 0.5%
3. A 等级2%，B 等级1.5%，差额0.5% → A 获得 0.5%

总分配：1% + 0.5% + 0.5% = 2%（等于最高等级比例）
```

---

## 分流系统

### 功能说明

分流部分可以配置到多个地址，按比例分配：

```solidity
struct SplitAddress {
    address addr;     // 接收地址
    uint256 rate;     // 比例（基数10000）
}
```

### 配置示例

```solidity
// 设置分流地址：运营50%，开发30%，市场20%
setSplitAddresses(
    [运营地址, 开发地址, 市场地址],
    [5000, 3000, 2000]
);
```

### 特殊情况

1. **未配置分流地址**：全部转给 Owner
2. **精度损失**：剩余部分转给最后一个地址
3. **最多支持 10 个分流地址**

---

## 管理员功能

### 1. 设置挖矿参数 `setMiningParams`

```solidity
function setMiningParams(
    uint256 _totalRewards,      // 总奖励数量
    uint256 _miningDuration     // 挖矿周期（秒）
) external onlyOwner;
```

**说明**：
- 修改后会重新计算 `rewardPerSecond` 和 `endTime`
- 挖矿结束后不可调用

**示例**：
```solidity
// 设置1亿奖励，5年周期
setMiningParams(100_000_000e18, 5 * 365 days);
```

### 2. 设置分配比例 `setDistributionRates`

```solidity
function setDistributionRates(
    uint256 _userBaseShare,     // 用户基础占比（基数10000）
    uint256 _splitShare         // 分流占比（基数10000）
) external onlyOwner;
```

**限制**：两者之和必须等于 10000

**示例**：
```solidity
// 用户70%，分流30%
setDistributionRates(7000, 3000);
```

### 3. 设置推荐比例 `setReferralRates`

```solidity
function setReferralRates(
    uint256 _level1,    // 1代比例
    uint256 _level2,    // 2代比例
    uint256 _level3     // 3代比例
) external onlyOwner;
```

**限制**：三级之和不能超过 10000

**示例**：
```solidity
// 设置 15%/8%/3%
setReferralRates(1500, 800, 300);
```

### 4. 设置锁仓时长 `setLockDuration`

```solidity
function setLockDuration(uint256 _duration) external onlyOwner;
```

**说明**：无上限限制

**示例**：
```solidity
// 设置90天锁仓
setLockDuration(90 days);

// 设置2年锁仓
setLockDuration(2 * 365 days);
```

### 5. 设置团队等级 `setTeamLevels`

```solidity
function setTeamLevels(
    uint256[] calldata _thresholds,  // 业绩阈值数组
    uint256[] calldata _rates        // 奖励比例数组
) external onlyOwner;
```

**限制**：
- 阈值必须递增
- 比例必须递增
- 比例最高不超过 10%（1000）

### 6. 设置分流地址 `setSplitAddresses`

```solidity
function setSplitAddresses(
    address[] calldata _addresses,  // 地址数组
    uint256[] calldata _rates       // 比例数组
) external onlyOwner;
```

**限制**：
- 地址不能为零地址
- 比例必须大于 0
- 最多 10 个地址

### 7. 管理员转移 LP `adminTransferLP`

```solidity
function adminTransferLP(address _to, uint256 _amount) external onlyOwner;
```

### 8. 紧急提取 `emergencyWithdraw`

```solidity
function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner;
```

---

## 用户功能

### 1. 设置推荐人 `setReferrer`

```solidity
function setReferrer(address _referrer) external;
```

### 2. 质押 LP `deposit`

```solidity
function deposit(uint256 _amount) external;
```

**注意**：每次质押都会重置锁仓期

### 3. 解除质押 `withdraw`

```solidity
function withdraw(uint256 _amount) external;
```

**要求**：必须在锁仓期结束后

### 4. 领取收益 `claim`

```solidity
function claim() external;
```

领取基础挖矿收益，同时触发：
- 推荐奖励分配
- 团队奖励分配
- 分流分配

### 5. 领取推荐奖励 `claimReferralRewards`

```solidity
function claimReferralRewards() external;
```

### 6. 领取团队奖励 `claimTeamRewards`

```solidity
function claimTeamRewards() external;
```

---

## 查询功能

| 函数 | 返回值 |
|------|--------|
| `pendingReward(address)` | 待领取收益 |
| `getUserInfo(address)` | 用户完整信息 |
| `getLockStatus(address)` | 锁仓状态 |
| `getReferrals(address)` | 直推列表 |
| `getReferralsPaginated(address, offset, limit)` | 分页直推列表 |
| `getTeamLevelConfig()` | 团队等级配置 |
| `getSplitConfig()` | 分流地址配置 |
| `getMiningStatus()` | 挖矿状态 |
| `getDistributionStats()` | 分发统计 |

---

## 事件

```solidity
event Deposit(address indexed user, uint256 amount, uint256 unlockTime);
event Withdraw(address indexed user, uint256 amount);
event Claim(address indexed user, uint256 userAmount, uint256 splitAmount);
event ReferrerSet(address indexed user, address indexed referrer);
event ReferralReward(address indexed user, address indexed referrer, uint256 level, uint256 amount);
event TeamReward(address indexed user, uint256 amount);
event TeamLevelUpdated(uint256[] thresholds, uint256[] rates);
event SplitAddressUpdated(address[] addresses, uint256[] rates);
event SplitDistributed(address indexed to, uint256 amount);
event AdminTransferLP(address indexed to, uint256 amount);
event MiningEnded(uint256 totalDistributed);
event LockDurationUpdated(uint256 oldDuration, uint256 newDuration);
event MiningParamsUpdated(uint256 totalRewards, uint256 miningDuration, uint256 rewardPerSecond);
event DistributionRatesUpdated(uint256 userBaseShare, uint256 splitShare);
event ReferralRatesUpdated(uint256 level1, uint256 level2, uint256 level3);
```

---

## 安全特性

1. **重入保护**：所有资金操作使用 `ReentrancyGuard`
2. **安全转账**：使用 OpenZeppelin `SafeERC20`
3. **权限控制**：管理功能仅 Owner 可调用
4. **循环推荐防护**：防止 A→B→A 的循环
5. **Gas 限制**：推荐链最大深度 50，直推最多 500

---

## 部署参数

构造函数参数：

```solidity
constructor(
    address _rewardToken,    // 奖励代币地址
    address _lpToken,        // LP 代币地址
    uint256 _startTime       // 挖矿开始时间（Unix时间戳）
)
```

部署后需要：
1. 转入奖励代币（默认6000万，可通过 `setMiningParams` 调整）
2. 调用 `setSplitAddresses` 配置分流地址
3. （可选）调用其他 setter 函数调整参数

---

## 默认配置汇总

```solidity
// 挖矿参数
totalRewards = 60,000,000 代币     // 可配置
miningDuration = 3 年              // 可配置
lockDuration = 30 天               // 可配置，无上限

// 分配比例
userBaseShare = 65%                // 可配置
splitShare = 35%                   // 可配置

// 推荐比例
referralLevel1 = 20%               // 可配置
referralLevel2 = 10%               // 可配置
referralLevel3 = 5%                // 可配置

// 团队等级
teamLevelThresholds = [1000, 5000, 10000] LP
teamLevelRates = [1%, 1.5%, 2%]

// 固定常量
MAX_REFERRAL_DEPTH = 50
MAX_DIRECT_REFERRALS = 500
```

---

## 版本信息

- **合约名称**: LPMiningV2
- **Solidity 版本**: ^0.8.20
- **OpenZeppelin 版本**: 5.4.0
- **更新日期**: 2025年12月
- **主要更新**: 全参数可配置、锁仓无上限
