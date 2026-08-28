const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Facility = require('../models/Facility');

/**
 * Generate JWT and set httpOnly cookie
 */
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
      facility: user.facility ? (user.facility._id || user.facility) : null,
    },
    process.env.JWT_SECRET || 'setucare_jwt_secret_dev_2026_phase1_secure_key',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      message,
      token, // Also returned in body for flexible client debugging/tests
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        facility: user.facility,
        phone: user.phone,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
      },
    });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role, facility, phone, preferredLanguage } =
      req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and role',
      });
    }

    // Role validation
    const validRoles = [
      'frontline_worker',
      'medical_officer',
      'specialist',
      'program_manager',
      'admin',
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role '${role}'. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Facility validation: required for all non-admin roles
    if (role !== 'admin' && !facility) {
      return res.status(400).json({
        success: false,
        message: 'A facility assignment is required for non-admin roles',
      });
    }

    // If facility is provided, verify it exists
    if (facility) {
      const existingFacility = await Facility.findById(facility);
      if (!existingFacility) {
        return res.status(400).json({
          success: false,
          message: 'The selected health facility was not found',
        });
      }
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists',
      });
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role,
      facility: role === 'admin' ? facility || null : facility,
      phone,
      preferredLanguage: preferredLanguage || 'en',
    });

    const populatedUser = await User.findById(user._id).populate('facility');

    sendTokenResponse(
      populatedUser,
      201,
      res,
      'User registered and authenticated successfully'
    );
  } catch (error) {
    console.error('[Auth Controller] Register Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration',
    });
  }
};

/**
 * @desc    Login user with email & password
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    // Query user and explicitly select password hash
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('facility');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials: No account found with this email',
      });
    }

    // Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials: Password does not match',
      });
    }

    sendTokenResponse(user, 200, res, 'Logged in successfully');
  } catch (error) {
    console.error('[Auth Controller] Login Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during login',
    });
  }
};

/**
 * @desc    Logout user & clear cookie
 * @route   POST /api/auth/logout
 * @access  Public
 */
const logout = async (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'User logged out successfully',
  });
};

/**
 * @desc    Get current authenticated user info (Who Am I)
 * @route   GET /api/auth/me
 * @access  Private (Protected by JWT)
 */
const getMe = async (req, res) => {
  try {
    // req.user was already populated in protect middleware
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error('[Auth Controller] getMe Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving authenticated user profile',
    });
  }
};

/**
 * @desc    Test role-based access control
 * @route   GET /api/auth/test-role-guard
 * @access  Private (Protected by roleGuard)
 */
const testRoleGuard = async (req, res) => {
  res.status(200).json({
    success: true,
    message: `Access granted! Your role '${req.user.role}' has permission for this route.`,
    user: {
      name: req.user.name,
      role: req.user.role,
      facility: req.user.facility?.name || 'Unassigned / Global',
    },
  });
};

/**
 * @desc    Test facility-scoped access control
 * @route   GET /api/auth/test-facility-scope
 * @access  Private (Protected by facilityScope)
 */
const testFacilityScope = async (req, res) => {
  const simulatedFilter = req.applyFacilityScope({ status: 'active' });

  res.status(200).json({
    success: true,
    message: req.isUnrestrictedScope
      ? 'Global Regional Access: Program Manager / Admin scope active across all facilities.'
      : `Facility-Scoped Access: Operations bounded to facility ID '${req.facilityScope}'.`,
    scopeDetails: {
      isUnrestricted: req.isUnrestrictedScope,
      facilityId: req.facilityScope,
      facilityName: req.user.facility?.name || 'All Facilities (Regional)',
      appliedQueryFilterPreview: simulatedFilter,
    },
  });
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  testRoleGuard,
  testFacilityScope,
};
