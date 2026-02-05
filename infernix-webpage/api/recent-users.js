// In-memory store for recent users (resets on cold start)
// For persistence, you'd use a database like MongoDB, Supabase, or Vercel KV
let recentUsers = [];
let totalUsers = 810230;

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // Executor sends user data here
    const { username, odometer,  version, discordId } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Missing username' });
    }

    // Add to recent users
    const newUser = {
      username,
      avatar: discordId ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png` : null,
      version: version || '1.1.8',
      time: 'Just now',
      timestamp: Date.now(),
    };

    // Add to front, keep only last 50
    recentUsers.unshift(newUser);
    if (recentUsers.length > 50) recentUsers.pop();

    // Increment total users
    totalUsers++;

    return res.status(200).json({ ok: true, totalUsers });
  }

  if (req.method === 'GET') {
    // Update relative times
    const now = Date.now();
    const usersWithTimes = recentUsers.map(user => {
      const diff = now - user.timestamp;
      let time = 'Just now';
      if (diff > 60000) time = `${Math.floor(diff / 60000)}m ago`;
      if (diff > 3600000) time = `${Math.floor(diff / 3600000)}h ago`;
      return { ...user, time };
    });

    return res.status(200).json({
      users: usersWithTimes.slice(0, 10),
      totalUsers,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
