/**
 * Role Guard Middleware
 * Restricts route access to specific roles
 * Example usage: roleGuard('medical_officer', 'specialist')
 */
const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required prior to role verification',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user.role}' is not authorized to access this resource. Required role(s): [${allowedRoles.join(', ')}]`,
        currentRole: req.user.role,
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
};

module.exports = { roleGuard };
