import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
  Flame, 
  Target, 
  Heart, 
  Shield, 
  Zap, 
  Users,
  Code2,
  Globe
} from 'lucide-react';

const values = [
  {
    icon: Target,
    title: 'Our Mission',
    description: 'Provide the most reliable executor for the community.',
  },
  {
    icon: Heart,
    title: 'Community First',
    description: 'Built and shaped by community feedback.',
  },
  {
    icon: Shield,
    title: 'Security Focused',
    description: 'Regular updates and secure practices.',
  },
];

const features = [
  {
    icon: Zap,
    title: 'Lightning Performance',
    description: 'Built from the ground up for speed.',
  },
  {
    icon: Code2,
    title: 'Modern Technology',
    description: 'Electron, React, and custom backend.',
  },
  {
    icon: Users,
    title: 'Multi-Client',
    description: 'Execute across multiple instances.',
  },
  {
    icon: Globe,
    title: 'Script Hub',
    description: 'Access thousands of scripts.',
  },
];

export default function About() {
  const [recentUsers, setRecentUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    // Fetch recent users from API
    const fetchRecentUsers = async () => {
      try {
        const res = await fetch('/api/recent-users');
        const data = await res.json();
        setRecentUsers(data.users || []);
        setTotalUsers(data.totalUsers || 0);
      } catch (e) {
        console.error('Failed to fetch recent users:', e);
      }
    };

    fetchRecentUsers();
    // Refresh every 30 seconds
    const interval = setInterval(fetchRecentUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative bg-black min-h-screen pt-24 pb-20">
      {/* Fire background */}
      <div className="fire-bg" />

      <div className="relative z-10 max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-6"
          >
            <Flame className="w-10 h-10 text-white" />
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-5xl font-bold mb-4 text-white"
          >
            About <span className="gradient-text">Infernix</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-gray-500"
          >
            Our mission and the team behind the executor.
          </motion.p>
        </div>

        {/* Values */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid md:grid-cols-3 gap-4 mb-16"
        >
          {values.map((value, index) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="p-6 rounded-xl bg-white/5 border border-orange-500/10 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4">
                <value.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-semibold mb-2">{value.title}</h3>
              <p className="text-gray-500 text-sm">{value.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Story */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="p-8 rounded-2xl bg-white/5 border border-orange-500/10 mb-16"
        >
          <h2 className="text-2xl font-bold text-white mb-4 text-center">Our Story</h2>
          <div className="space-y-4 text-gray-400">
            <p>
              Infernix was born from a simple idea: <span className="text-white">what if there was an executor that just worked?</span>
            </p>
            <p>
              We started as developers passionate about creating tools for the community. After months of development and feedback from testers, Infernix is ready.
            </p>
            <p>
              Our executor combines <span className="text-orange-400">cutting-edge technology</span> with a <span className="text-orange-400">user-first design</span>.
            </p>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            What Makes Us <span className="gradient-text">Different</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-5 rounded-xl bg-white/5 border border-orange-500/10 flex gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                  <p className="text-gray-500 text-sm">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Users - Live Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 p-8 rounded-2xl bg-white/5 border border-orange-500/10"
        >
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              100% Free & <span className="gradient-text">Keyless</span>
            </h2>
            <p className="text-gray-500">
              No keys, no payments, no restrictions. Infernix is completely free
              to use and trusted by <span className="text-white font-bold">{totalUsers.toLocaleString()}</span> users worldwide.
            </p>
          </div>

          {/* Recent Users List */}
          <div className="space-y-3 max-w-md mx-auto">
            {recentUsers.length > 0 ? (
              recentUsers.slice(0, 5).map((user, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-black/50 border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-10 h-10 rounded-full border-2 border-orange-500/30"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${user.username}&background=f97316&color=fff`;
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {user.username?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">
                        {user.username?.length > 15 
                          ? user.username.slice(0, 2) + '...' 
                          : user.username} <span className="text-gray-500">used Infernix</span>
                      </p>
                      <p className="text-gray-600 text-xs">Active on Discord</p>
                    </div>
                  </div>
                  <span className="text-orange-400 text-sm font-medium">{user.time || 'Recently'}</span>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-600">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Loading recent activity...</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Discord CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 p-8 rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-600/10 border border-orange-500/20 text-center"
        >
          <Flame className="w-12 h-12 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">Join Our Community</h2>
          <p className="text-gray-400 mb-6">Connect with users, get support, and share scripts.</p>
          <a
            href="https://discord.gg/NjRH3q7A"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#5865F2] text-white font-medium hover:bg-[#4752C4] transition-colors"
          >
            Join Discord
          </a>
        </motion.div>
      </div>
    </div>
  );
}
