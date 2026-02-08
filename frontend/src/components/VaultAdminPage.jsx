import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import {
  FiUsers,
  FiSettings,
  FiDollarSign,
  FiSend,
  FiRefreshCw,
  FiAlertTriangle,
  FiCheck,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiZap,
  FiTarget,
  FiList,
  FiSearch,
  FiCopy
} from 'react-icons/fi';
import { formatNumber, formatAddress, parseContractError } from '../utils/constants';

export default function VaultAdminPage({ account, contracts, onRefresh }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  // 配置状态
  const [autoConfig, setAutoConfig] = useState({
    threshold: '0',
    receiver: '',
    enabled: false
  });

  // 用户列表
  const [users, setUsers] = useState([]);
  const [userDetails, setUserDetails] = useState({});
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20;

  // 可转账用户
  const [transferableUsers, setTransferableUsers] = useState([]);

  // 表单状态
  const [thresholdInput, setThresholdInput] = useState('');
  const [receiverInput, setReceiverInput] = useState('');
  const [enabledInput, setEnabledInput] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // 手动转账
  const [manualTransfer, setManualTransfer] = useState({
    user: '',
    to: '',
    amount: ''
  });
  const [isTransferring, setIsTransferring] = useState(false);

  // 批量转账
  const [isBatchTransferring, setIsBatchTransferring] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // 展开面板
  const [showConfig, setShowConfig] = useState(true);
  const [showUsers, setShowUsers] = useState(true);
  const [showTransferable, setShowTransferable] = useState(true);
  const [showManualTransfer, setShowManualTransfer] = useState(true);

  // 搜索
  const [searchAddress, setSearchAddress] = useState('');
  const [searchResult, setSearchResult] = useState(null);

  // 检查是否是管理员
  useEffect(() => {
    const checkOwner = async () => {
      if (!contracts?.vault || !account) {
        setIsOwner(false);
        return;
      }
      try {
        const owner = await contracts.vault.owner();
        const isOp = await contracts.vault.operators(account);
        setIsOwner(owner.toLowerCase() === account.toLowerCase() || isOp);
      } catch (err) {
        console.error('Check owner error:', err);
        setIsOwner(false);
      }
    };
    checkOwner();
  }, [contracts?.vault, account]);

  // 加载数据
  const loadData = useCallback(async () => {
    if (!contracts?.vault) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 加载配置
      const config = await contracts.vault.getAutoTransferConfig();
      setAutoConfig({
        threshold: ethers.formatEther(config.threshold),
        receiver: config.receiver,
        enabled: config.enabled
      });
      setThresholdInput(ethers.formatEther(config.threshold));
      setReceiverInput(config.receiver);
      setEnabledInput(config.enabled);

      // 加载用户列表
      const result = await contracts.vault.getAuthorizedUsers(currentPage * pageSize, pageSize);
      setUsers(result.users);
      setTotalUsers(Number(result.total));

      // 加载用户详情
      if (result.users.length > 0) {
        const details = await contracts.vault.batchGetUserDetails(result.users);
        const detailsMap = {};
        for (let i = 0; i < result.users.length; i++) {
          detailsMap[result.users[i]] = {
            enabled: details.enabledList[i],
            balance: ethers.formatEther(details.balances[i]),
            allowance: ethers.formatEther(details.allowances[i]),
            totalTransferred: ethers.formatEther(details.totalTransferredList[i])
          };
        }
        setUserDetails(detailsMap);
      }

      // 加载可转账用户
      const transferable = await contracts.vault.getTransferableUsers();
      const transferableList = [];
      for (let i = 0; i < transferable.users.length; i++) {
        transferableList.push({
          address: transferable.users[i],
          balance: ethers.formatEther(transferable.balances[i]),
          transferableAmount: ethers.formatEther(transferable.transferableAmounts[i])
        });
      }
      setTransferableUsers(transferableList);

    } catch (err) {
      console.error('Load data error:', err);
      toast.error('加载数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [contracts?.vault, currentPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 保存配置
  const handleSaveConfig = async () => {
    if (!contracts?.vault) return;

    setIsSavingConfig(true);
    try {
      const threshold = ethers.parseEther(thresholdInput || '0');
      const receiver = receiverInput || account;

      const tx = await contracts.vault.setAutoTransferConfig(threshold, receiver, enabledInput);
      toast.loading('保存配置中...', { id: 'saveConfig' });
      await tx.wait();
      toast.success('配置已保存', { id: 'saveConfig' });
      loadData();
    } catch (err) {
      console.error('Save config error:', err);
      toast.error(parseContractError(err), { id: 'saveConfig' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // 手动转账
  const handleManualTransfer = async () => {
    if (!contracts?.vault || !manualTransfer.user || !manualTransfer.amount) return;

    setIsTransferring(true);
    try {
      const amount = ethers.parseEther(manualTransfer.amount);
      const to = manualTransfer.to || account;

      const tx = await contracts.vault.transferFromUser(manualTransfer.user, to, amount, false);
      toast.loading('转账中...', { id: 'transfer' });
      await tx.wait();
      toast.success('转账成功', { id: 'transfer' });
      setManualTransfer({ user: '', to: '', amount: '' });
      loadData();
    } catch (err) {
      console.error('Transfer error:', err);
      toast.error(parseContractError(err), { id: 'transfer' });
    } finally {
      setIsTransferring(false);
    }
  };

  // 单个用户阈值转账
  const handleThresholdTransfer = async (user) => {
    if (!contracts?.vault) return;

    try {
      const tx = await contracts.vault.transferAboveThreshold(user);
      toast.loading('转账中...', { id: `transfer-${user}` });
      await tx.wait();
      toast.success('转账成功', { id: `transfer-${user}` });
      loadData();
    } catch (err) {
      console.error('Threshold transfer error:', err);
      toast.error(parseContractError(err), { id: `transfer-${user}` });
    }
  };

  // 批量阈值转账
  const handleBatchTransfer = async () => {
    if (!contracts?.vault || transferableUsers.length === 0) return;

    setIsBatchTransferring(true);
    try {
      const usersToTransfer = selectedUsers.length > 0
        ? selectedUsers
        : transferableUsers.map(u => u.address);

      const tx = await contracts.vault.batchTransferAboveThreshold(usersToTransfer);
      toast.loading('批量转账中...', { id: 'batchTransfer' });
      await tx.wait();
      toast.success(`已转账 ${usersToTransfer.length} 个用户`, { id: 'batchTransfer' });
      setSelectedUsers([]);
      loadData();
    } catch (err) {
      console.error('Batch transfer error:', err);
      toast.error(parseContractError(err), { id: 'batchTransfer' });
    } finally {
      setIsBatchTransferring(false);
    }
  };

  // 搜索用户
  const handleSearch = async () => {
    if (!contracts?.vault || !searchAddress) return;

    try {
      if (!ethers.isAddress(searchAddress)) {
        toast.error('无效的地址');
        return;
      }
      const details = await contracts.vault.getUserDetails(searchAddress);
      setSearchResult({
        address: searchAddress,
        enabled: details.enabled,
        perTxLimit: ethers.formatEther(details.perTxLimit),
        dailyLimit: ethers.formatEther(details.dailyLimit),
        spentToday: ethers.formatEther(details.spentToday),
        totalTransferred: ethers.formatEther(details.totalTransferred),
        tokenBalance: ethers.formatEther(details.tokenBalance),
        allowance: ethers.formatEther(details.allowance),
        canTransfer: details.canTransfer
      });
    } catch (err) {
      console.error('Search error:', err);
      toast.error('查询失败');
    }
  };

  // 复制地址
  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    toast.success('已复制地址');
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedUsers.length === transferableUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(transferableUsers.map(u => u.address));
    }
  };

  // 切换选择
  const toggleSelect = (address) => {
    if (selectedUsers.includes(address)) {
      setSelectedUsers(selectedUsers.filter(a => a !== address));
    } else {
      setSelectedUsers([...selectedUsers, address]);
    }
  };

  if (!account) {
    return (
      <div className="glass-premium p-8 text-center">
        <FiAlertTriangle className="w-12 h-12 text-[#FFB800] mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">请先连接钱包</h3>
      </div>
    );
  }

  if (!isOwner && !isLoading) {
    return (
      <div className="glass-premium p-8 text-center">
        <FiAlertTriangle className="w-12 h-12 text-[#FF6B6B] mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">无权限访问</h3>
        <p className="text-white/50">只有合约管理员或操作员可以访问此页面</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6B6B] to-[#FF8A00] flex items-center justify-center shadow-lg">
            <FiUsers className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Vault 管理后台</h1>
            <p className="text-white/50">管理用户授权和自动转账</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={loadData}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl bg-white/10 text-white flex items-center gap-2 hover:bg-white/20 disabled:opacity-50"
        >
          <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          刷新数据
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card-premium">
          <div className="flex items-center gap-2 mb-3 text-[#00D9A5]">
            <FiUsers className="w-5 h-5" />
            <span className="text-white/40 text-sm">授权用户数</span>
          </div>
          <div className="text-2xl font-bold text-white">{totalUsers}</div>
        </div>
        <div className="stat-card-premium">
          <div className="flex items-center gap-2 mb-3 text-[#FFB800]">
            <FiTarget className="w-5 h-5" />
            <span className="text-white/40 text-sm">转账阈值</span>
          </div>
          <div className="text-2xl font-bold text-white">{formatNumber(autoConfig.threshold)} USDT</div>
        </div>
        <div className="stat-card-premium">
          <div className="flex items-center gap-2 mb-3 text-[#00D9A5]">
            <FiZap className="w-5 h-5" />
            <span className="text-white/40 text-sm">可转账用户</span>
          </div>
          <div className="text-2xl font-bold text-white">{transferableUsers.length}</div>
        </div>
        <div className="stat-card-premium">
          <div className="flex items-center gap-2 mb-3 text-[#FFB800]">
            <FiSettings className="w-5 h-5" />
            <span className="text-white/40 text-sm">自动转账</span>
          </div>
          <div className={`text-2xl font-bold ${autoConfig.enabled ? 'text-[#00D9A5]' : 'text-[#FF6B6B]'}`}>
            {autoConfig.enabled ? '已启用' : '未启用'}
          </div>
        </div>
      </div>

      {/* 阈值配置 */}
      <motion.div className="glass-premium overflow-hidden">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <span className="font-semibold flex items-center gap-2 text-[#FFB800]">
            <FiTarget className="w-5 h-5" />
            阈值自动转账配置
          </span>
          {showConfig ? <FiChevronUp /> : <FiChevronDown />}
        </button>

        {showConfig && (
          <div className="p-5 pt-0 space-y-4">
            <div className="divider-glow" />

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">
                  余额阈值（超过此值自动转走）
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    placeholder="例如: 100"
                    className="input-premium pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50">USDT</span>
                </div>
                <p className="mt-1 text-xs text-white/40">用户余额超过此值时，超出部分将被转走</p>
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-2">
                  接收地址
                </label>
                <input
                  type="text"
                  value={receiverInput}
                  onChange={(e) => setReceiverInput(e.target.value)}
                  placeholder="留空则使用当前账户"
                  className="input-premium"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
              <div>
                <div className="font-medium text-white">启用阈值自动转账</div>
                <div className="text-sm text-white/50">启用后可执行阈值转账操作</div>
              </div>
              <button
                onClick={() => setEnabledInput(!enabledInput)}
                className={`w-14 h-8 rounded-full transition-colors ${enabledInput ? 'bg-[#00D9A5]' : 'bg-white/20'}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform ${enabledInput ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="w-full btn-premium disabled:opacity-50"
            >
              {isSavingConfig ? '保存中...' : '保存配置'}
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* 搜索用户 */}
      <div className="glass-premium p-5">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <FiSearch className="w-5 h-5 text-[#00D9A5]" />
          搜索用户
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            placeholder="输入用户钱包地址"
            className="input-premium flex-1"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSearch}
            className="px-6 py-3 rounded-xl bg-[#00D9A5]/20 text-[#00D9A5] font-medium hover:bg-[#00D9A5]/30"
          >
            查询
          </motion.button>
        </div>

        {searchResult && (
          <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-white">{formatAddress(searchResult.address)}</span>
                <button onClick={() => copyAddress(searchResult.address)} className="text-white/40 hover:text-white">
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${searchResult.enabled ? 'bg-[#00D9A5]/20 text-[#00D9A5]' : 'bg-[#FF6B6B]/20 text-[#FF6B6B]'}`}>
                {searchResult.enabled ? '已启用' : '未启用'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-white/50">代币余额</div>
                <div className="font-medium text-white">{formatNumber(searchResult.tokenBalance)} USDT</div>
              </div>
              <div>
                <div className="text-white/50">授权额度</div>
                <div className="font-medium text-white">{formatNumber(searchResult.allowance)} USDT</div>
              </div>
              <div>
                <div className="text-white/50">累计转出</div>
                <div className="font-medium text-[#FFB800]">{formatNumber(searchResult.totalTransferred)} USDT</div>
              </div>
              <div>
                <div className="text-white/50">可转账</div>
                <div className={`font-medium ${searchResult.canTransfer ? 'text-[#00D9A5]' : 'text-[#FF6B6B]'}`}>
                  {searchResult.canTransfer ? '是' : '否'}
                </div>
              </div>
            </div>
            {searchResult.canTransfer && parseFloat(searchResult.tokenBalance) > parseFloat(autoConfig.threshold) && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleThresholdTransfer(searchResult.address)}
                  className="px-4 py-2 rounded-lg bg-[#FF6B6B]/20 text-[#FF6B6B] text-sm font-medium hover:bg-[#FF6B6B]/30"
                >
                  转走全部 ({formatNumber(searchResult.tokenBalance)} USDT)
                </motion.button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 可转账用户列表 */}
      <motion.div className="glass-premium overflow-hidden">
        <button
          onClick={() => setShowTransferable(!showTransferable)}
          className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <span className="font-semibold flex items-center gap-2 text-[#FF6B6B]">
            <FiZap className="w-5 h-5" />
            可转账用户 ({transferableUsers.length})
          </span>
          {showTransferable ? <FiChevronUp /> : <FiChevronDown />}
        </button>

        {showTransferable && (
          <div className="p-5 pt-0">
            <div className="divider-glow mb-4" />

            {transferableUsers.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                暂无可转账用户（余额都低于阈值）
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleSelectAll}
                      className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20"
                    >
                      {selectedUsers.length === transferableUsers.length ? '取消全选' : '全选'}
                    </button>
                    <span className="text-white/50 text-sm">已选 {selectedUsers.length} 个</span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleBatchTransfer}
                    disabled={isBatchTransferring || (selectedUsers.length === 0 && transferableUsers.length === 0)}
                    className="px-4 py-2 rounded-lg bg-[#FF6B6B] text-white text-sm font-medium hover:bg-[#FF6B6B]/80 disabled:opacity-50"
                  >
                    {isBatchTransferring ? '转账中...' : `批量转账 (${selectedUsers.length || transferableUsers.length} 个)`}
                  </motion.button>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {transferableUsers.map((user) => (
                    <div
                      key={user.address}
                      className={`p-4 rounded-xl border transition-colors ${
                        selectedUsers.includes(user.address)
                          ? 'bg-[#FF6B6B]/10 border-[#FF6B6B]/30'
                          : 'bg-white/5 border-white/10 hover:bg-white/8'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.address)}
                            onChange={() => toggleSelect(user.address)}
                            className="w-4 h-4 rounded border-white/30 bg-white/10 text-[#FF6B6B] focus:ring-[#FF6B6B]"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-white">{formatAddress(user.address)}</span>
                              <button onClick={() => copyAddress(user.address)} className="text-white/40 hover:text-white">
                                <FiCopy className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-sm text-white/50">
                              余额: <span className="text-white">{formatNumber(user.balance)}</span> USDT
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[#FF6B6B] font-medium">
                            可转 {formatNumber(user.transferableAmount)} USDT
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleThresholdTransfer(user.address)}
                            className="mt-1 px-3 py-1 rounded-lg bg-[#FF6B6B]/20 text-[#FF6B6B] text-xs hover:bg-[#FF6B6B]/30"
                          >
                            转账
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>

      {/* 手动转账 */}
      <motion.div className="glass-premium overflow-hidden">
        <button
          onClick={() => setShowManualTransfer(!showManualTransfer)}
          className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <span className="font-semibold flex items-center gap-2 text-[#00D9A5]">
            <FiSend className="w-5 h-5" />
            手动转账
          </span>
          {showManualTransfer ? <FiChevronUp /> : <FiChevronDown />}
        </button>

        {showManualTransfer && (
          <div className="p-5 pt-0 space-y-4">
            <div className="divider-glow" />

            <div className="p-4 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/30">
              <div className="flex items-start gap-2">
                <FiAlertTriangle className="w-5 h-5 text-[#FFB800] mt-0.5" />
                <div className="text-sm text-white/70">
                  <p className="font-medium text-[#FFB800]">注意事项</p>
                  <ul className="mt-1 space-y-1 text-white/50">
                    <li>• 用户必须已启用自动转账</li>
                    <li>• 用户必须有足够的授权额度</li>
                    <li>• 用户钱包必须有足够的代币余额</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">用户地址 *</label>
                <input
                  type="text"
                  value={manualTransfer.user}
                  onChange={(e) => setManualTransfer(prev => ({ ...prev, user: e.target.value }))}
                  placeholder="0x..."
                  className="input-premium"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">接收地址（留空则转到当前账户）</label>
                <input
                  type="text"
                  value={manualTransfer.to}
                  onChange={(e) => setManualTransfer(prev => ({ ...prev, to: e.target.value }))}
                  placeholder="0x..."
                  className="input-premium"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">转账金额 *</label>
                <div className="relative">
                  <input
                    type="number"
                    value={manualTransfer.amount}
                    onChange={(e) => setManualTransfer(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="输入金额"
                    className="input-premium pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50">USDT</span>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleManualTransfer}
              disabled={isTransferring || !manualTransfer.user || !manualTransfer.amount}
              className="w-full btn-premium disabled:opacity-50"
            >
              {isTransferring ? '转账中...' : '执行转账'}
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* 所有授权用户 */}
      <motion.div className="glass-premium overflow-hidden">
        <button
          onClick={() => setShowUsers(!showUsers)}
          className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <span className="font-semibold flex items-center gap-2 text-white">
            <FiList className="w-5 h-5" />
            所有授权用户 ({totalUsers})
          </span>
          {showUsers ? <FiChevronUp /> : <FiChevronDown />}
        </button>

        {showUsers && (
          <div className="p-5 pt-0">
            <div className="divider-glow mb-4" />

            {users.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                暂无授权用户
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/50 border-b border-white/10">
                        <th className="text-left py-3 px-2">地址</th>
                        <th className="text-right py-3 px-2">状态</th>
                        <th className="text-right py-3 px-2">余额</th>
                        <th className="text-right py-3 px-2">授权额度</th>
                        <th className="text-right py-3 px-2">累计转出</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => {
                        const details = userDetails[user] || {};
                        return (
                          <tr key={user} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-white">{formatAddress(user)}</span>
                                <button onClick={() => copyAddress(user)} className="text-white/40 hover:text-white">
                                  <FiCopy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="text-right py-3 px-2">
                              <span className={`px-2 py-1 rounded text-xs ${details.enabled ? 'bg-[#00D9A5]/20 text-[#00D9A5]' : 'bg-white/10 text-white/50'}`}>
                                {details.enabled ? '启用' : '禁用'}
                              </span>
                            </td>
                            <td className="text-right py-3 px-2 text-white">{formatNumber(details.balance)} USDT</td>
                            <td className="text-right py-3 px-2 text-white/70">{formatNumber(details.allowance)} USDT</td>
                            <td className="text-right py-3 px-2 text-[#FFB800]">{formatNumber(details.totalTransferred)} USDT</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 分页 */}
                {totalUsers > pageSize && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                    <span className="text-white/50 text-sm">
                      显示 {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, totalUsers)} / {totalUsers}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                        className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20 disabled:opacity-50"
                      >
                        上一页
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={(currentPage + 1) * pageSize >= totalUsers}
                        className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20 disabled:opacity-50"
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
