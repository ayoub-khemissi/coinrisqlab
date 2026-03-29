/**
 * Express middleware: require Pro subscription.
 * Must be used after authenticateUser middleware.
 */
export function requirePro(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ data: null, msg: 'Unauthorized' });
  }

  if (req.user.plan !== 'pro') {
    return res.status(403).json({ data: null, msg: 'Pro subscription required' });
  }

  // Check expiration
  if (req.user.planExpiresAt && new Date(req.user.planExpiresAt) < new Date()) {
    return res.status(403).json({ data: null, msg: 'Pro subscription expired' });
  }

  next();
}
