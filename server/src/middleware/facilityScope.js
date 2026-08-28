/**
 * Facility Scope Middleware
 * Scopes database operations to the user's assigned facility.
 * Program Managers and Admins bypass facility restrictions for regional oversight.
 */
const facilityScope = (facilityField = 'facility') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required prior to facility scope verification',
      });
    }

    const { role, facility } = req.user;

    // Admins and Program Managers have regional cross-facility scope
    if (role === 'admin' || role === 'program_manager') {
      req.facilityScope = null;
      req.isUnrestrictedScope = true;
      req.applyFacilityScope = (filter = {}) => filter;
      return next();
    }

    // Frontline workers, Medical Officers, Specialists must be bounded to their facility
    const facilityId = facility ? (facility._id || facility) : null;

    if (!facilityId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: User is not linked to an assigned health facility',
      });
    }

    req.facilityScope = facilityId;
    req.isUnrestrictedScope = false;

    // Helper method attached to req for controllers to easily filter by facility
    req.applyFacilityScope = (filter = {}, customField = facilityField) => {
      return {
        ...filter,
        [customField]: facilityId,
      };
    };

    next();
  };
};

module.exports = { facilityScope };
