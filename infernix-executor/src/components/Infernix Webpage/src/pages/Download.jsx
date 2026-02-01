import { motion } from 'framer-motion';
import { 
  Download as DownloadIcon, 
  ArrowRight, 
  Flame, 
  Users, 
  Zap, 
  Code2,
  RefreshCw,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Growing Community',
    description: 'Join our Discord for support.',
  },
  {
    icon: Code2,
    title: 'Multi Attach',
    description: 'Attach to multiple clients.',
  },
  {
    icon: Zap,
    title: 'Performance',
    description: 'Fast and lightweight.',
  },
];

const changelog = [
  {
    version: '1.0.4',
    date: 'February 2026',
    type: 'release',
    changes: [
      'Initial public release',
      'Monaco editor integration',
      'Multi-client support',
      'Script hub with popular scripts',
      'Modern dark theme UI',
    ],
  },
  {
    version: '0.9.5',
    date: 'January 2026',
    type: 'beta',
    changes: [
      'Fixed execution stability',
      'Improved attach speed',
      'Added auto-execute',
    ],
  },
];

export default function Download() {
  const handleDownload = () => {
    window.open('https://github.com/aauuzyy/Xeno-x-Infernix/releases/latest/download/Infernix.Setup.1.0.4.exe', '_blank');
  };

  return (
    <div className="relative bg-black min-h-screen pt-24 pb-20">
      {/* Fire background */}
      <div className="fire-bg" />

      <div className="relative z-10 max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6"
          >
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-300">Latest Release</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold mb-4 text-white"
          >
            Download <span className="gradient-text">Infernix</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-500"
          >
            Get started in seconds.
          </motion.p>
        </div>

        {/* Main Download Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid lg:grid-cols-3 gap-6 mb-12"
        >
          {/* Download Section */}
          <div className="lg:col-span-2 p-8 rounded-2xl bg-white/5 border border-orange-500/10">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Flame className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Infernix 1.0.4</h2>
                <p className="text-gray-500 text-sm">February 2026 • Latest Release</p>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {features.map((feature) => (
                <div key={feature.title} className="p-3 rounded-lg bg-white/5">
                  <feature.icon className="w-5 h-5 text-orange-400 mb-2" />
                  <h3 className="font-medium text-white text-sm">{feature.title}</h3>
                  <p className="text-xs text-gray-500">{feature.description}</p>
                </div>
              ))}
            </div>

            {/* Download Button */}
            <motion.button
              onClick={handleDownload}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-lg btn-primary text-white font-semibold"
            >
              <DownloadIcon className="w-5 h-5" />
              Download Now
              <ArrowRight className="w-5 h-5" />
            </motion.button>

            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-orange-400" />
                Windows 10/11
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-orange-400" />
                Free Forever
              </span>
              <span className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3 text-orange-400" />
                Auto Updates
              </span>
            </div>
          </div>

          {/* Latest Updates */}
          <div className="p-6 rounded-2xl bg-white/5 border border-orange-500/10">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              Latest Updates
            </h3>
            <div className="space-y-2">
              {changelog[0].changes.map((change, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="p-3 rounded-lg bg-white/5 text-sm text-gray-400"
                >
                  {change}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Changelog */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h3 className="text-xl font-bold text-white mb-6">Changelog</h3>
          <div className="space-y-4">
            {changelog.map((release) => (
              <div key={release.version} className="p-6 rounded-xl bg-white/5 border border-orange-500/10">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-lg font-bold text-white">v{release.version}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    release.type === 'release' 
                      ? 'bg-orange-500/20 text-orange-400' 
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {release.type === 'release' ? 'Release' : 'Beta'}
                  </span>
                  <span className="text-sm text-gray-500">{release.date}</span>
                </div>
                <ul className="space-y-1">
                  {release.changes.map((change, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-gray-400 text-sm">
                      <CheckCircle2 className="w-3 h-3 text-orange-400 flex-shrink-0" />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Help */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            Need help?{' '}
            <a
              href="https://discord.gg/NjRH3q7A"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300 inline-flex items-center gap-1"
            >
              Join our Discord
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
