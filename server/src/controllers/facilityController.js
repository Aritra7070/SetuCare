const Facility = require('../models/Facility');
const seedFacilityHierarchy = require('../seed/facilities');

/**
 * Helper: Validate Parent-Tier stepped-care hierarchy rules
 * Rule:
 *  - district_hospital: parent MUST be null
 *  - rural_hospital: parent MUST be a district_hospital
 *  - phc: parent MUST be a rural_hospital
 *  - sub_centre: parent MUST be a phc
 */
const validateParentTier = async (tier, parentFacilityId) => {
  if (tier === 'district_hospital') {
    if (parentFacilityId) {
      return {
        valid: false,
        message: 'District Hospital is the apex tier and cannot have a parent facility.',
      };
    }
    return { valid: true };
  }

  // Non-district hospitals require a parent facility
  if (!parentFacilityId) {
    const requiredParentTierMap = {
      rural_hospital: 'District Hospital',
      phc: 'Rural Hospital / Sub-District Hospital',
      sub_centre: 'Primary Health Centre (PHC)',
    };
    return {
      valid: false,
      message: `A ${tier.replace('_', ' ')} requires a parent facility of tier '${requiredParentTierMap[tier]}'.`,
    };
  }

  const parent = await Facility.findById(parentFacilityId);
  if (!parent) {
    return {
      valid: false,
      message: 'The selected parent facility does not exist.',
    };
  }

  const expectedTierMap = {
    rural_hospital: 'district_hospital',
    phc: 'rural_hospital',
    sub_centre: 'phc',
  };

  const expectedParentTier = expectedTierMap[tier];
  if (parent.tier !== expectedParentTier) {
    return {
      valid: false,
      message: `Invalid hierarchy: A '${tier.replace('_', ' ')}' must have a parent of tier '${expectedParentTier.replace('_', ' ')}', but '${parent.name}' is a '${parent.tier.replace('_', ' ')}'.`,
    };
  }

  return { valid: true, parentDoc: parent };
};

/**
 * @desc    Create a new health facility
 * @route   POST /api/facilities
 * @access  Private (Admin only)
 */
const createFacility = async (req, res) => {
  try {
    const {
      name,
      tier,
      parentFacility,
      location,
      district,
      state,
      contactPhone,
      active,
    } = req.body;

    if (!name || !tier || !district) {
      return res.status(400).json({
        success: false,
        message: 'Please provide facility name, tier, and district',
      });
    }

    // Validate tier enum
    const validTiers = ['sub_centre', 'phc', 'rural_hospital', 'district_hospital'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({
        success: false,
        message: `Invalid tier '${tier}'. Allowed: ${validTiers.join(', ')}`,
      });
    }

    // Validate parent tier hierarchy rule
    const parentValidation = await validateParentTier(tier, parentFacility);
    if (!parentValidation.valid) {
      return res.status(400).json({
        success: false,
        message: parentValidation.message,
      });
    }

    const facility = await Facility.create({
      name: name.trim(),
      tier,
      parentFacility: tier === 'district_hospital' ? null : parentFacility || null,
      location: location || {},
      district: district.trim(),
      state: state || 'Maharashtra',
      contactPhone: contactPhone ? contactPhone.trim() : undefined,
      active: active !== undefined ? active : true,
    });

    const populated = await Facility.findById(facility._id).populate('parentFacility');

    res.status(201).json({
      success: true,
      message: `Facility '${facility.name}' created successfully`,
      facility: populated,
    });
  } catch (error) {
    console.error('[Facility Controller] Create Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create facility',
    });
  }
};

/**
 * @desc    Get flat list of facilities with optional filters
 * @route   GET /api/facilities
 * @access  Private (Authenticated users)
 */
const getFacilities = async (req, res) => {
  try {
    const { tier, district, search, includeInactive } = req.query;

    const query = {};

    // Filter by active status unless includeInactive is explicitly true
    if (includeInactive !== 'true' && includeInactive !== true) {
      query.active = true;
    }

    if (tier) {
      query.tier = tier;
    }

    if (district) {
      query.district = new RegExp(`^${district}$`, 'i');
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    let facilities = await Facility.find(query)
      .populate('parentFacility')
      .sort({ district: 1, tier: 1, name: 1 });

    // Auto-seed if entire collection is empty
    if (facilities.length === 0 && Object.keys(query).length === 0) {
      const totalCount = await Facility.countDocuments();
      if (totalCount === 0) {
        console.log('[Facilities] Auto-seeding initial facility hierarchy...');
        await seedFacilityHierarchy();
        facilities = await Facility.find(query)
          .populate('parentFacility')
          .sort({ district: 1, tier: 1, name: 1 });
      }
    }

    res.status(200).json({
      success: true,
      count: facilities.length,
      facilities,
    });
  } catch (error) {
    console.error('[Facility Controller] List Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve facilities',
    });
  }
};

/**
 * @desc    Get nested stepped-care hierarchy tree
 * @route   GET /api/facilities/tree
 * @access  Private (Authenticated users)
 */
const getFacilityTree = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const query = {};

    if (includeInactive !== 'true' && includeInactive !== true) {
      query.active = true;
    }

    const facilities = await Facility.find(query)
      .populate('parentFacility')
      .lean();

    // Map by ID with initialized children array
    const facilityMap = {};
    facilities.forEach((f) => {
      facilityMap[f._id.toString()] = {
        ...f,
        children: [],
      };
    });

    const roots = [];
    const orphaned = [];

    // Build the parent -> children links
    facilities.forEach((f) => {
      const node = facilityMap[f._id.toString()];
      if (!f.parentFacility) {
        // Root node (e.g. District Hospital)
        roots.push(node);
      } else {
        const parentId = (f.parentFacility._id || f.parentFacility).toString();
        const parentNode = facilityMap[parentId];
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          // Parent is missing or inactive
          node.isOrphaned = true;
          orphaned.push(node);
        }
      }
    });

    res.status(200).json({
      success: true,
      totalCount: facilities.length,
      rootCount: roots.length,
      orphanedCount: orphaned.length,
      tree: roots,
      orphaned,
    });
  } catch (error) {
    console.error('[Facility Controller] Tree Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to build facility hierarchy tree',
    });
  }
};

/**
 * @desc    Get single facility details with children count
 * @route   GET /api/facilities/:id
 * @access  Private (Authenticated users)
 */
const getFacilityById = async (req, res) => {
  try {
    const facility = await Facility.findById(req.params.id).populate('parentFacility');

    if (!facility) {
      return res.status(404).json({
        success: false,
        message: 'Facility not found',
      });
    }

    const children = await Facility.find({
      parentFacility: facility._id,
      active: true,
    }).sort({ tier: 1, name: 1 });

    res.status(200).json({
      success: true,
      facility,
      children,
    });
  } catch (error) {
    console.error('[Facility Controller] GetById Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve facility',
    });
  }
};

/**
 * @desc    Update a facility
 * @route   PATCH /api/facilities/:id
 * @access  Private (Admin only)
 */
const updateFacility = async (req, res) => {
  try {
    const facility = await Facility.findById(req.params.id);

    if (!facility) {
      return res.status(404).json({
        success: false,
        message: 'Facility not found',
      });
    }

    const {
      name,
      tier,
      parentFacility,
      location,
      district,
      state,
      contactPhone,
      active,
    } = req.body;

    const newTier = tier || facility.tier;
    const newParent =
      parentFacility !== undefined
        ? parentFacility
        : facility.parentFacility
        ? facility.parentFacility.toString()
        : null;

    // Check circular parent reference
    if (newParent && newParent.toString() === facility._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'A facility cannot be its own parent.',
      });
    }

    // Validate parent-tier rule if either tier or parent was modified
    if (tier || parentFacility !== undefined) {
      const parentValidation = await validateParentTier(newTier, newParent);
      if (!parentValidation.valid) {
        return res.status(400).json({
          success: false,
          message: parentValidation.message,
        });
      }
    }

    if (name) facility.name = name.trim();
    if (tier) facility.tier = tier;
    if (parentFacility !== undefined) {
      facility.parentFacility = newTier === 'district_hospital' ? null : parentFacility || null;
    }
    if (location) facility.location = location;
    if (district) facility.district = district.trim();
    if (state) facility.state = state.trim();
    if (contactPhone !== undefined) facility.contactPhone = contactPhone ? contactPhone.trim() : '';
    if (active !== undefined) facility.active = Boolean(active);

    await facility.save();

    const updated = await Facility.findById(facility._id).populate('parentFacility');

    res.status(200).json({
      success: true,
      message: `Facility '${facility.name}' updated successfully`,
      facility: updated,
    });
  } catch (error) {
    console.error('[Facility Controller] Update Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update facility',
    });
  }
};

/**
 * @desc    Soft-delete a facility (sets active: false)
 * @route   DELETE /api/facilities/:id
 * @access  Private (Admin only)
 */
const deleteFacility = async (req, res) => {
  try {
    const facility = await Facility.findById(req.params.id);

    if (!facility) {
      return res.status(404).json({
        success: false,
        message: 'Facility not found',
      });
    }

    // Soft delete
    facility.active = false;
    await facility.save();

    // Check how many active child facilities depend on this one
    const activeChildrenCount = await Facility.countDocuments({
      parentFacility: facility._id,
      active: true,
    });

    res.status(200).json({
      success: true,
      message: `Facility '${facility.name}' has been soft-deleted (marked inactive)`,
      facility,
      activeChildrenCount,
      warning:
        activeChildrenCount > 0
          ? `${activeChildrenCount} active child facilities currently reference this facility as parent.`
          : undefined,
    });
  } catch (error) {
    console.error('[Facility Controller] Delete Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to soft-delete facility',
    });
  }
};

/**
 * @desc    Seed facilities reset endpoint
 * @route   POST /api/facilities/seed
 * @access  Private (Admin only)
 */
const seedFacilities = async (req, res) => {
  try {
    const count = await seedFacilityHierarchy();
    res.status(200).json({
      success: true,
      message: 'Facility hierarchy seeded successfully',
      count,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Seeding failed: ' + error.message,
    });
  }
};

module.exports = {
  createFacility,
  getFacilities,
  getFacilityTree,
  getFacilityById,
  updateFacility,
  deleteFacility,
  seedFacilities,
};
