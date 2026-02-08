import { motion } from 'framer-motion';
import { FiHome, FiUsers, FiSettings, FiGlobe } from 'react-icons/fi';
import { formatAddress } from '../utils/constants';
import { useLanguage } from '../contexts/LanguageContext';

export default function Header({
  account,
  isConnecting,
  isCorrectNetwork,
  onConnect,
  onSwitchNetwork,
  currentPage,
  onPageChange,
  isAdmin,
}) {
  const { language, toggleLanguage, t } = useLanguage();

  const navItems = [
    { id: 'home', label: t('nav.airdrop'), icon: <FiHome /> },
    { id: 'referral', label: t('nav.referral'), icon: <FiUsers /> },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: t('nav.admin'), icon: <FiSettings /> });
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-green-600 flex items-center justify-center">
              <span className="text-dark font-bold text-lg">A</span>
            </div>
            <span className="font-bold text-xl text-white hidden sm:block">Airdrop</span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  currentPage === item.id
                    ? 'bg-primary/20 text-primary'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 text-white/70 text-sm font-medium hover:bg-white/10 border border-white/10"
            >
              <FiGlobe className="w-4 h-4" />
              <span>{language === 'en' ? 'EN' : '中'}</span>
            </motion.button>

            {/* Network Switch */}
            {!isCorrectNetwork && account && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onSwitchNetwork}
                className="px-3 py-2 rounded-xl bg-secondary/20 text-secondary text-sm font-medium"
              >
                {t('header.switchNetwork')}
              </motion.button>
            )}

            {/* Wallet */}
            {account ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-white text-sm font-medium">
                  {formatAddress(account)}
                </span>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onConnect}
                disabled={isConnecting}
                className="btn-primary text-sm"
              >
                {isConnecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-dark/30 border-t-dark rounded-full animate-spin" />
                    {t('header.connecting')}
                  </>
                ) : (
                  t('header.connectWallet')
                )}
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
