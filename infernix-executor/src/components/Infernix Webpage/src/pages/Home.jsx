import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Zap,
  Shield,
  Code2,
  Users,
  Cpu,
  Download,
  Flame,
  Sparkles,
  History
} from 'lucide-react';
import { useEffect, useState } from 'react';

const changelog = [
  {
    version: '1.0.9',
    date: 'February 2026',
    changes: [
      '🎨 Custom Themes - Color picker for accent colors',
      '🚀 Auto-Update System - Detects new releases from GitHub',
      '⚡ ScriptHub Virtualization - Smoother scrolling',
      '🔥 Dynamic accent color across entire UI',
    ]
  },
  {
    version: '1.0.8',
    date: 'February 2026',
    changes: [
      '🔥 Banwave Status indicator with API',
      '🎮 Game detection for ScriptHub filtering',
      '📊 Improved Dashboard stats',
    ]
  },
  {
    version: '1.0.7',
    date: 'February 2026',
    changes: [
      '🔥 AutoExec now runs scripts on attach',
      '🔥 Kill Roblox button added',
      '🔥 Fixed Workspace AI chat',
    ]
  },
];

const features = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Execute scripts with blazing speed.',
  },
  {
    icon: Shield,
    title: 'Secure & Safe',
    description: 'Your scripts stay protected.',
  },
  {
    icon: Code2,
    title: 'Modern UI',
    description: 'Beautiful Monaco editor interface.',
  },
  {
    icon: Users,
    title: 'Multi-Client',
    description: 'Attach to multiple clients at once.',
  },
  {
    icon: Cpu,
    title: 'Optimized',
    description: 'Low resource usage.',
  },
  {
    icon: Sparkles,
    title: 'Script Hub',
    description: 'Access thousands of scripts.',
  },
];

// Ember particle component
function Embers() {
  const [embers, setEmbers] = useState([]);
  
  useEffect(() => {
    const emberCount = 20;
    const newEmbers = [];
    for (let i = 0; i < emberCount; i++) {
      newEmbers.push({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 4 + Math.random() * 4,
        size: 2 + Math.random() * 3,
      });
    }
    setEmbers(newEmbers);
  }, []);
  
  return (
    <>
      {embers.map((ember) => (
        <div
          key={ember.id}
          className="ember"
          style={{
            left: `${ember.left}%`,
            width: `${ember.size}px`,
            height: `${ember.size}px`,
            animationDelay: `${ember.delay}s`,
            animationDuration: `${ember.duration}s`,
          }}
        />
      ))}
    </>
  );
}

export default function Home() {
  return (
    <div className="relative bg-black min-h-screen">
      {/* Fire background */}
      <div className="fire-bg" />
      <Embers />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, type: 'spring' }}
            className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center glow-fire"
          >
            <Flame className="w-14 h-14 text-white" />
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold mb-6 text-white"
          >
            <span className="gradient-text">Infernix</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-lg text-gray-400 max-w-xl mx-auto mb-10"
          >
            The next-generation Roblox executor. Powerful, secure, and incredibly fast.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to="/download"
              className="flex items-center gap-2 px-8 py-4 rounded-lg btn-primary text-white font-semibold"
            >
              <Download className="w-5 h-5" />
              Download Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="https://discord.gg/NjRH3q7A"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-4 rounded-lg btn-secondary text-white font-semibold"
            >
              Join Discord
            </a>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-24">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Why <span className="gradient-text">Infernix</span>?
            </h2>
            <p className="text-gray-500">
              Built with everything you need.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-xl bg-white/5 border border-orange-500/10 hover:border-orange-500/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                <p className="text-gray-500 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Changelog Section */}
      <section className="relative py-24">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              <History className="inline-block w-8 h-8 mr-2 text-orange-500" />
              Latest <span className="gradient-text">Updates</span>
            </h2>
            <p className="text-gray-500">See what's new in Infernix</p>
          </motion.div>

          <div className="space-y-6">
            {changelog.map((release, index) => (
              <motion.div
                key={release.version}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-xl bg-white/5 border border-orange-500/20 hover:border-orange-500/40 transition-all"
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white text-sm font-bold">
                    v{release.version}
                  </span>
                  <span className="text-gray-500 text-sm">{release.date}</span>
                </div>
                <ul className="space-y-2">
                  {release.changes.map((change, i) => (
                    <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                      <span className="text-orange-500 mt-1">•</span>
                      {change}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-12 rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-600/10 border border-orange-500/20"
          >
            <Flame className="w-12 h-12 text-orange-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-gray-400 mb-8">
              Download Infernix now and experience the difference.
            </p>
            <Link
              to="/download"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg btn-primary text-white font-semibold"
            >
              <Download className="w-5 h-5" />
              Download Infernix
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
