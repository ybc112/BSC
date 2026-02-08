import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import {
  FiSettings,
  FiUsers,
  FiSearch,
  FiDollarSign,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiShield,
  FiClock,
  FiCheck,
  FiX,
  FiAlertTriangle,
} from 'react-icons/fi';
import { formatNumber, formatAddress, parseContractError } from '../utils/constants';
import { useLanguage } from '../contexts/LanguageContext';

export default function AdminPage({ account, contracts, onRefresh }) {
  const { t } = useLanguage();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [activeTab, setActiveTab] = useState('withdrawals');

  // Withdrawal management
  const [withdrawals, setWithdrawals] = useState([]);
  const [isLoadingWithdrawals, setIsLoadingWithdrawals] = useState(false);
  const [isApproving, setIsApproving] = useState({});
  const [isRejecting, setIsRejecting] = useState({});

  // User search
  const [searchAddress, setSearchAddress] = useState('');
  const [searchedUser, setSearchedUser] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingCount: 0,
    totalWithdrawn: '0',
  });

  // Check admin status
  useEffect(() => {
    checkAdminStatus();
  }, [account, contracts.vault]);

  const checkAdminStatus = async () => {
    if (!contracts.vault || !account) {
      setIsCheckingAdmin(false);
      return;
    }

    try {
      const owner = await contracts.vault.owner();
      const isOp = await contracts.vault.operators(account);
      setIsAdmin(
        owner.toLowerCase() === account.toLowerCase() || isOp
      );
    } catch (err) {
      console.error('Check admin error:', err);
      setIsAdmin(false);
    } finally {
      setIsCheckingAdmin(false);
    }
  };

  // Load data
  useEffect(() => {
    if (isAdmin) {
      loadWithdrawals();
      loadStats();
    }
  }, [isAdmin]);

  const loadStats = async () => {
    if (!contracts.vault) return;
    try {
      const [userCount, pendingCount, totalWithdrawn] = await Promise.all([
        contracts.vault.getUserCount(),
        contracts.vault.getPendingCount(),
        contracts.vault.getTotalWithdrawn(),
      ]);
      setStats({
        totalUsers: Number(userCount),
        pendingCount: Number(pendingCount),
        totalWithdrawn: ethers.formatEther(totalWithdrawn),
      });
    } catch (err) {
      console.error('Load stats error:', err);
    }
  };

  const loadWithdrawals = async () => {
    if (!contracts.vault) return;
    setIsLoadingWithdrawals(true);
    try {
      const [pendingList, total] = await contracts.vault.getPendingWithdrawals(0, 100);

      const formattedWithdrawals = pendingList.map((req) => ({
        id: Number(req.id),
        user: req.user,
        userShort: formatAddress(req.user),
        amount: ethers.formatEther(req.amount),
        fee: ethers.formatEther(req.fee),
        status: Number(req.status),
        requestTime: new Date(Number(req.requestTime) * 1000).toLocaleString(),
      }));

      setWithdrawals(formattedWithdrawals);
    } catch (err) {
      console.error('Load withdrawals error:', err);
    } finally {
      setIsLoadingWithdrawals(false);
    }
  };

  // Approve withdrawal
  const handleApprove = async (id) => {
    if (!contracts.vault) return;

    setIsApproving(prev => ({ ...prev, [id]: true }));
    try {
      const tx = await contracts.vault.approveWithdrawal(id);
      toast.loading(t('admin.approving'), { id: `approve-${id}` });
      await tx.wait();
      toast.success(t('admin.approved'), { id: `approve-${id}` });
      loadWithdrawals();
      loadStats();
    } catch (err) {
      console.error('Approve error:', err);
      toast.error(parseContractError(err), { id: `approve-${id}` });
    } finally {
      setIsApproving(prev => ({ ...prev, [id]: false }));
    }
  };

  // Reject withdrawal
  const handleReject = async (id) => {
    if (!contracts.vault) return;

    setIsRejecting(prev => ({ ...prev, [id]: true }));
    try {
      const tx = await contracts.vault.rejectWithdrawal(id);
      toast.loading(t('admin.rejecting'), { id: `reject-${id}` });
      await tx.wait();
      toast.success(t('admin.rejected'), { id: `reject-${id}` });
      loadWithdrawals();
      loadStats();
    } catch (err) {
      console.error('Reject error:', err);
      toast.error(parseContractError(err), { id: `reject-${id}` });
    } finally {
      setIsRejecting(prev => ({ ...prev, [id]: false }));
    }
  };

  // Search user
  const handleSearch = async () => {
    if (!contracts.vault || !searchAddress) return;

    setIsSearching(true);
    try {
      if (!ethers.isAddress(searchAddress)) {
        toast.error(t('toast.invalidAddress'));
        return;
      }

      const info = await contracts.vault.getUserInfo(searchAddress);
      setSearchedUser({
        address: searchAddress,
        enabled: info.enabled,
        referrer: info.referrer,
        totalWithdrawn: ethers.formatEther(info.totalWithdrawn),
        totalFeePaid: ethers.formatEther(info.totalFeePaid),
        referralRewards: ethers.formatEther(info.referralRewards),
        directReferrals: Number(info.directReferrals),
        usdtBalance: ethers.formatEther(info.usdtBalance),
        allowance: ethers.formatEther(info.allowance),
      });
    } catch (err) {
      console.error('Search error:', err);
      toast.error(t('toast.searchFailed'));
    } finally {
      setIsSearching(false);
    }
  };

  if (!account) {
    return (
      <div className="glass-card text-center py-12">
        <FiAlertTriangle className="w-16 h-16 text-secondary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">{t('admin.connectWallet')}</h3>
        <p className="text-white/50">{t('admin.connectDesc')}</p>
      </div>
    );
  }

  if (isCheckingAdmin) {
    return (
      <div className="glass-card text-center py-12">
        <FiRefreshCw className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
        <p className="text-white/50">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="glass-card text-center py-12">
        <FiAlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">{t('admin.accessDenied')}</h3>
        <p className="text-white/50">{t('admin.accessDeniedDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg">
            <FiSettings className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{t('admin.title')}</h1>
            <p className="text-white/50">{t('admin.subtitle')}</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { loadWithdrawals(); loadStats(); }}
          disabled={isLoadingWithdrawals}
          className="p-3 rounded-xl bg-white/10 text-white/70 hover:bg-white/20"
        >
          <FiRefreshCw className={`w-5 h-5 ${isLoadingWithdrawals ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <FiUsers className="w-5 h-5" />
            <span className="text-white/40 text-sm">{t('admin.totalUsers')}</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2 text-secondary">
            <FiClock className="w-5 h-5" />
            <span className="text-white/40 text-sm">{t('admin.pendingCount')}</span>
          </div>
          <div className="text-2xl font-bold text-secondary">{stats.pendingCount}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <FiDollarSign className="w-5 h-5" />
            <span className="text-white/40 text-sm">{t('admin.totalWithdrawn')}</span>
          </div>
          <div className="text-2xl font-bold text-white">{formatNumber(stats.totalWithdrawn)} USDT</div>
        </div>
      </div>

      {/* Search User */}
      <div className="glass-card">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FiSearch className="w-5 h-5 text-primary" />
          {t('admin.searchUser')}
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            placeholder={t('admin.enterAddress')}
            className="input-field flex-1"
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSearch}
            disabled={isSearching}
            className="btn-primary"
          >
            {isSearching ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : t('admin.search')}
          </motion.button>
        </div>

        {searchedUser && (
          <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-white text-sm">{formatAddress(searchedUser.address)}</span>
              <span className={`badge ${searchedUser.enabled ? 'badge-success' : 'badge-warning'}`}>
                {searchedUser.enabled ? t('admin.enabled') : t('admin.disabled')}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-white/50">{t('admin.balance')}</div>
                <div className="font-medium text-white">{formatNumber(searchedUser.usdtBalance)} USDT</div>
              </div>
              <div>
                <div className="text-white/50">{t('admin.totalWithdrawn')}</div>
                <div className="font-medium text-primary">{formatNumber(searchedUser.totalWithdrawn)} USDT</div>
              </div>
              <div>
                <div className="text-white/50">{t('admin.totalFee')}</div>
                <div className="font-medium text-secondary">{formatNumber(searchedUser.totalFeePaid)} USDT</div>
              </div>
              <div>
                <div className="text-white/50">{t('admin.referrals')}</div>
                <div className="font-medium text-white">{searchedUser.directReferrals}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pending Withdrawals */}
      <div className="glass-card">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FiClock className="w-5 h-5 text-secondary" />
          {t('admin.pendingWithdrawals')} ({withdrawals.length})
        </h3>

        {withdrawals.length === 0 ? (
          <div className="text-center py-8 text-white/40">
            {t('admin.noPending')}
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {withdrawals.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-white/50 text-sm">#{item.id}</span>
                    <span className="font-mono text-white text-sm">{item.userShort}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-white">
                      {t('admin.amount')}: <span className="font-bold text-primary">{formatNumber(item.amount)} USDT</span>
                    </span>
                    <span className="text-white/50">
                      {t('admin.fee')}: {formatNumber(item.fee)} USDT
                    </span>
                  </div>
                  <div className="text-xs text-white/40 mt-1">{item.requestTime}</div>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleApprove(item.id)}
                    disabled={isApproving[item.id]}
                    className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-50"
                  >
                    {isApproving[item.id] ? (
                      <FiRefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <FiCheck className="w-5 h-5" />
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleReject(item.id)}
                    disabled={isRejecting[item.id]}
                    className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                  >
                    {isRejecting[item.id] ? (
                      <FiRefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <FiX className="w-5 h-5" />
                    )}
                  </motion.button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
