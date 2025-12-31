import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX, FiExternalLink, FiShield } from 'react-icons/fi';
import { formatAddress } from '../utils/constants';

// 新的 Logo 组件 - 金融科技风格
function Logo({ onClick }) {
  return (
    <motion.div
      className="flex items-center gap-3 cursor-pointer group"
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
    >
      {/* Logo 图标 - 抽象的钱币/增长图形 */}
      <div className="relative">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#00D9A5] to-[#00B88A] flex items-center justify-center shadow-lg shadow-[#00D9A5]/30 group-hover:shadow-[#00D9A5]/50 transition-shadow">
          {/* 内部图案 - 类似增长曲线 */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 17L9 11L13 15L21 7"
              stroke="#0B1120"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M17 7H21V11"
              stroke="#0B1120"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="9" cy="11" r="2" fill="#FFB800" />
          </svg>
        </div>
        {/* 装饰性光环 */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#00D9A5] to-[#FFB800] opacity-0 group-hover:opacity-20 blur-xl transition-opacity" />
      </div>

      {/* 文字部分 */}
      <div className="hidden sm:block">
        <h1 className="text-xl font-bold">
          <span className="text-white">Yield</span>
          <span className="text-[#00D9A5]">Vault</span>
        </h1>
        <p className="text-xs text-white/50 tracking-wide">BSC DeFi Protocol</p>
      </div>
    </motion.div>
  );
}

export default function Header({ account, isConnecting, isCorrectNetwork, onConnect, onSwitchNetwork, currentPage, onPageChange, isAdmin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 基础导航项
  const baseNavItems = [
    { id: 'home', label: '首页' },
    { id: 'lp-mining', label: 'LP挖矿' },
    { id: 'token-mining', label: '代币挖矿' },
    { id: 'referral', label: '推荐奖励' },
  ];

  // 只有管理员才能看到管理菜单
  const navItems = isAdmin
    ? [...baseNavItems, { id: 'admin', label: '管理', icon: <FiShield className="w-4 h-4" /> }]
    : baseNavItems;

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Logo onClick={() => onPageChange('home')} />

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                  className={`flex items-center gap-1.5 ${currentPage === item.id ? 'nav-link-active' : 'nav-link'}`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Wallet Connection */}
            <div className="flex items-center gap-3">
              {account ? (
                <div className="flex items-center gap-2">
                  {!isCorrectNetwork && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onSwitchNetwork}
                      className="px-4 py-2 bg-[#FF6B6B]/20 border border-[#FF6B6B]/50 rounded-xl text-[#FF6B6B] text-sm font-medium hover:bg-[#FF6B6B]/30 transition-colors"
                    >
                      切换网络
                    </motion.button>
                  )}
                  <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A2332] border border-white/5">
                    <div className="w-2 h-2 rounded-full bg-[#00D9A5] animate-pulse" />
                    <span className="text-sm font-medium text-white/90">{formatAddress(account)}</span>
                    <a
                      href={`https://testnet.bscscan.com/address/${account}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/40 hover:text-[#00D9A5] transition-colors"
                    >
                      <FiExternalLink size={14} />
                    </a>
                  </div>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onConnect}
                  disabled={isConnecting}
                  className="btn-primary text-sm"
                >
                  {isConnecting ? '连接中...' : '连接钱包'}
                </motion.button>
              )}

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2 rounded-xl hover:bg-white/5 text-white/70 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-b border-white/5"
          >
            <nav className="px-4 py-4 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onPageChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left flex items-center gap-2 ${currentPage === item.id ? 'nav-link-active' : 'nav-link'}`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
              {account && (
                <div className="pt-3 mt-3 border-t border-white/5">
                  <div className="flex items-center gap-2 px-4 py-2">
                    <div className="w-2 h-2 rounded-full bg-[#00D9A5]" />
                    <span className="text-sm text-white/70">{formatAddress(account)}</span>
                  </div>
                </div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
