import { motion } from 'framer-motion';
import { FiTrendingUp, FiUsers, FiDollarSign, FiZap, FiArrowRight, FiShield, FiAward, FiActivity, FiCheckCircle } from 'react-icons/fi';
import { formatNumber, MINING_CONFIG } from '../utils/constants';

export default function HomePage({ onPageChange, lpMiningData, tokenMiningData }) {
  const stats = [
    {
      label: 'LP 矿池总质押',
      value: lpMiningData?.miningStatus?.totalStaked || '0',
      suffix: 'LP',
      icon: <FiTrendingUp className="w-5 h-5" />,
      color: 'primary',
    },
    {
      label: '代币矿池质押',
      value: tokenMiningData?.miningStatus?.totalStaked || '0',
      suffix: 'RWT',
      icon: <FiDollarSign className="w-5 h-5" />,
      color: 'gold',
    },
    {
      label: 'LP 已分发奖励',
      value: lpMiningData?.miningStatus?.totalDistributed || '0',
      suffix: 'RWT',
      icon: <FiZap className="w-5 h-5" />,
      color: 'primary',
    },
    {
      label: '代币年化收益',
      value: tokenMiningData?.apy || MINING_CONFIG.TOKEN_MINING.APY,
      suffix: '%',
      icon: <FiActivity className="w-5 h-5" />,
      color: 'gold',
    },
  ];

  const features = [
    {
      icon: <FiTrendingUp className="w-7 h-7" />,
      title: 'LP 质押挖矿',
      subtitle: '60% 代币分配',
      description: '质押 LP 代币参与挖矿，享受 65% 收益直接到账，3年线性释放',
      stats: '6000万 RWT',
      color: 'from-[#00D9A5] to-[#00B88A]',
      page: 'lp-mining',
    },
    {
      icon: <FiDollarSign className="w-7 h-7" />,
      title: '代币质押挖矿',
      subtitle: '30% 代币分配',
      description: '质押 RWT 代币，每日固定 0.5% 收益率，年化高达 182.5%',
      stats: '3000万 RWT',
      color: 'from-[#FFB800] to-[#FF8A00]',
      page: 'token-mining',
    },
    {
      icon: <FiUsers className="w-7 h-7" />,
      title: '三级推荐奖励',
      subtitle: '最高 35% 额外收益',
      description: '邀请好友参与挖矿，1代20%、2代10%、3代5% 推荐奖励',
      stats: '无限邀请',
      color: 'from-[#00D9A5] to-[#FFB800]',
      page: 'referral',
    },
    {
      icon: <FiAward className="w-7 h-7" />,
      title: '团队极差奖励',
      subtitle: '最高 2% 网体收益',
      description: '根据团队小区业绩获得极差奖励，等级越高收益越多',
      stats: '3级等级',
      color: 'from-[#FFB800] to-[#FF8A00]',
      page: 'referral',
    },
  ];

  const getColorClass = (color) => {
    return color === 'primary' ? 'text-[#00D9A5]' : 'text-[#FFB800]';
  };

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative pt-8 pb-12">
        {/* 装饰性光球 */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00D9A5]/10 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#FFB800]/10 rounded-full blur-[100px] animate-float" style={{ animationDelay: '3s' }} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-block mb-8"
          >
            <span className="badge-glow">
              <FiCheckCircle className="w-4 h-4 mr-2" />
              BSC 链上 DeFi 协议 · 安全可靠
            </span>
          </motion.div>

          {/* Main Title */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="text-white">质押挖矿</span>
            <br />
            <span className="text-gradient-premium text-glow">轻松赚取收益</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-white/50 max-w-3xl mx-auto mb-10 leading-relaxed">
            LP 挖矿 + 代币挖矿 + 推荐奖励 + 团队奖励
            <br />
            <span className="text-white/70">总计 9000 万代币奖励</span>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onPageChange('lp-mining')}
              className="btn-premium"
            >
              <span className="flex items-center gap-2">
                开始挖矿 <FiArrowRight className="w-5 h-5" />
              </span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onPageChange('referral')}
              className="btn-ghost"
            >
              <span className="flex items-center gap-2">
                <FiUsers className="w-5 h-5" /> 邀请好友
              </span>
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="stat-card-premium group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`${getColorClass(stat.color)} opacity-60 group-hover:opacity-100 transition-opacity`}>
                  {stat.icon}
                </span>
                <div className={`w-2 h-2 rounded-full ${stat.color === 'primary' ? 'bg-[#00D9A5]' : 'bg-[#FFB800]'} animate-pulse`} />
              </div>
              <div className="number-display">
                <span className="text-3xl md:text-4xl font-bold text-white">
                  {formatNumber(stat.value)}
                </span>
                <span className="text-white/40 text-sm ml-2">{stat.suffix}</span>
              </div>
              <div className="text-white/40 text-sm mt-2">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            选择你的<span className="text-gradient-premium">挖矿方式</span>
          </h2>
          <p className="text-white/50">多种收益渠道，灵活组合，最大化你的收益</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              onClick={() => onPageChange(feature.page)}
              className="group relative rounded-2xl p-[1px] cursor-pointer overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${feature.color.includes('00D9A5') ? 'rgba(0, 217, 165, 0.3)' : 'rgba(255, 184, 0, 0.3)'}, transparent)`,
              }}
            >
              {/* 内部卡片 */}
              <div className="relative rounded-2xl p-6 bg-[#0F1629] h-full overflow-hidden transition-all duration-300 group-hover:bg-[#131B2E]">
                {/* 背景光效 */}
                <div className={`absolute top-0 right-0 w-40 h-40 rounded-full bg-gradient-to-br ${feature.color} opacity-5 blur-3xl group-hover:opacity-10 transition-opacity`} />

                <div className="relative">
                  {/* 头部：图标 + 标签 */}
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                      <span className="text-[#0B1120]">{feature.icon}</span>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r ${feature.color} text-[#0B1120]`}>
                      {feature.stats}
                    </span>
                  </div>

                  {/* 标题和副标题 */}
                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-[#00D9A5] transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-white/40 mb-3">{feature.subtitle}</p>

                  {/* 描述 */}
                  <p className="text-white/50 text-sm leading-relaxed mb-5">
                    {feature.description}
                  </p>

                  {/* 底部操作 */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center text-white/60 group-hover:text-[#00D9A5] transition-colors">
                      <span className="text-sm font-medium">了解详情</span>
                      <FiArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
                    </div>
                    {/* 装饰性点 */}
                    <div className="flex gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${index % 2 === 0 ? 'bg-[#00D9A5]' : 'bg-[#FFB800]'}`} />
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Token Distribution */}
      <section className="neon-card">
        <div className="neon-card-inner">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center text-white">
            代币分配方案
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { percent: 60, label: 'LP 质押挖矿', amount: '6000 万', color: 'primary' },
              { percent: 30, label: '代币质押挖矿', amount: '3000 万', color: 'gold' },
              { percent: 10, label: '团队/流动性', amount: '1000 万', color: 'secondary' },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="text-center group"
              >
                {/* Circle Progress */}
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="8"
                      fill="none"
                    />
                    <motion.circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke={`url(#gradient-${item.color})`}
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      initial={{ strokeDasharray: '0 352' }}
                      animate={{ strokeDasharray: `${item.percent * 3.52} 352` }}
                      transition={{ duration: 1.5, delay: 0.5 + index * 0.2, ease: 'easeOut' }}
                    />
                    <defs>
                      <linearGradient id={`gradient-${item.color}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={item.color === 'primary' ? '#00D9A5' : item.color === 'gold' ? '#FFB800' : '#94A3B8'} />
                        <stop offset="100%" stopColor={item.color === 'primary' ? '#00B88A' : item.color === 'gold' ? '#FF8A00' : '#64748B'} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-3xl font-bold ${
                      item.color === 'primary' ? 'text-[#00D9A5]' :
                      item.color === 'gold' ? 'text-[#FFB800]' : 'text-white/60'
                    }`}>
                      {item.percent}%
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-white mb-1">{item.label}</h3>
                <p className="text-white/40 text-sm">{item.amount} RWT</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="glass-premium p-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00D9A5]/20 to-[#00D9A5]/5 border border-[#00D9A5]/30 flex items-center justify-center glow-primary">
              <FiShield className="w-10 h-10 text-[#00D9A5]" />
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-2xl font-bold mb-2 text-white">安全可靠</h3>
            <p className="text-white/50">
              合约代码经过全面测试，覆盖率超过 97%。采用 OpenZeppelin 安全库，
              具备重入攻击防护、溢出保护、权限控制等多重安全机制。
            </p>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#00D9A5]">103</div>
              <div className="text-white/40 text-sm">测试用例</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#00D9A5]">97%</div>
              <div className="text-white/40 text-sm">代码覆盖</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
