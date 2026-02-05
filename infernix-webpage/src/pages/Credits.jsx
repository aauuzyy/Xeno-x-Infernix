import { motion } from 'framer-motion';
import { Heart, Github, Globe, Code2, Palette, Cpu, Users, Flame } from 'lucide-react';

const team = [
  {
    name: 'Lead Developer',
    role: 'Core Development',
    description: 'Built the core execution engine and backend systems.',
    icon: Cpu,
  },
  {
    name: 'UI/UX Designer',
    role: 'Design & Frontend',
    description: 'Created the modern interface and user experience.',
    icon: Palette,
  },
  {
    name: 'Backend Developer',
    role: 'Infrastructure',
    description: 'Manages servers, updates, and distribution systems.',
    icon: Code2,
  },
  {
    name: 'Community Manager',
    role: 'Support & Community',
    description: 'Handles community support and feedback collection.',
    icon: Users,
  },
];

const specialThanks = [
  {
    name: 'Crystxll',
    reason: 'The one who convinced us to make Infernix! Without his inspiration, this project wouldn\'t exist.',
    highlight: true,
  },
  {
    name: 'Xeno',
    reason: 'For the amazing API and execution backend that powers Infernix.',
    link: 'https://xeno.onl',
  },
  {
    name: 'Beta Testers',
    reason: 'Our amazing community members who tested early versions and provided invaluable feedback.',
  },
  {
    name: 'Open Source Community',
    reason: 'For the incredible tools and libraries that made this project possible.',
  },
  {
    name: 'Discord Community',
    reason: 'For the continuous support, bug reports, and feature suggestions.',
  },
];

const technologies = [
  { name: 'Electron', description: 'Desktop framework' },
  { name: 'React', description: 'UI library' },
  { name: 'Vite', description: 'Build tool' },
  { name: 'Monaco Editor', description: 'Code editor' },
  { name: 'Framer Motion', description: 'Animations' },
  { name: 'Tailwind CSS', description: 'Styling' },
];

export default function Credits() {
  return (
    <div className="relative bg-black min-h-screen pt-24 pb-20">
      {/* Fire background */}
      <div className="fire-bg" />

      <div className="relative z-10 max-w-5xl mx-auto px-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-6">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            <span className="gradient-text">Credits</span>
          </h1>
          <p className="text-gray-500">
            Infernix wouldn't be possible without these amazing people and projects.
          </p>
        </motion.div>

        {/* Team Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            The <span className="gradient-text">Team</span>
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-5 rounded-xl bg-white/5 border border-orange-500/10 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-3">
                  <member.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">{member.name}</h3>
                <p className="text-xs text-orange-400 mb-2">{member.role}</p>
                <p className="text-xs text-gray-500">{member.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Special Thanks */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <div className="p-6 rounded-2xl bg-white/5 border border-orange-500/10">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Flame className="w-5 h-5 text-orange-400" />
              <h2 className="text-xl font-bold text-white">Special Thanks</h2>
              <Flame className="w-5 h-5 text-orange-400" />
            </div>

            {/* CRYSTXLL - The Legend */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-orange-600/30 via-yellow-500/20 to-red-600/30 border-2 border-orange-500 ring-2 ring-orange-500/50 shadow-[0_0_40px_rgba(249,115,22,0.4)] relative overflow-hidden"
            >
              {/* Animated glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/10 to-transparent animate-pulse" />
              
              <div className="relative flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 via-yellow-400 to-red-500 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(249,115,22,0.6)] animate-pulse">
                  <Flame className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-yellow-300 to-orange-500 bg-clip-text text-transparent">
                      Crystxll
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-orange-500 to-yellow-500 text-black rounded-full">
                      The Inspiration
                    </span>
                  </div>
                  <p className="text-orange-100/90 text-sm leading-relaxed">
                    The one who convinced us to make Infernix! Without his inspiration and belief in this project, none of this would exist. A true legend. 🔥
                  </p>
                </div>
              </div>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-3">
              {specialThanks.filter(t => !t.highlight).map((thanks) => (
                <div
                  key={thanks.name}
                  className="p-4 rounded-xl border bg-black/30 border-white/5"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center flex-shrink-0">
                      <Heart className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-white text-sm mb-1">
                        {thanks.link ? (
                          <a 
                            href={thanks.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-orange-400 transition-colors inline-flex items-center gap-1"
                          >
                            {thanks.name}
                            <Globe className="w-3 h-3" />
                          </a>
                        ) : (
                          thanks.name
                        )}
                      </h3>
                      <p className="text-gray-500 text-xs leading-relaxed">{thanks.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Technologies */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-12"
        >
          <h2 className="text-lg font-bold text-white mb-4 text-center">Built With</h2>
          
          <div className="flex flex-wrap justify-center gap-2">
            {technologies.map((tech) => (
              <div
                key={tech.name}
                className="px-4 py-2 rounded-lg bg-white/5 border border-orange-500/10 text-sm"
              >
                <span className="text-white font-medium">{tech.name}</span>
                <span className="text-gray-500 ml-1">• {tech.description}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* GitHub */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-6 rounded-2xl bg-white/5 border border-orange-500/10 text-center"
        >
          <Github className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Open Source</h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-4">
            Infernix uses many open source projects. We're grateful to all the developers 
            who create and maintain these amazing tools.
          </p>
          <a
            href="https://github.com/aauuzyy/Xeno-x-Infernix"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition-colors"
          >
            <Github className="w-4 h-4" />
            View on GitHub
          </a>
        </motion.div>
      </div>
    </div>
  );
}
