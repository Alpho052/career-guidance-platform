const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// Get all institutions for dropdowns/landing
router.get('/institutions', async (req, res) => {
  try {
    // Prefer approved institutions
    let institutionsSnapshot = await db.collection('institutions')
      .where('status', '==', 'approved')
      .get();

    // Fallback: if none approved yet, return all institutions
    if (institutionsSnapshot.empty) {
      institutionsSnapshot = await db.collection('institutions').get();
    }
    
    const institutions = [];
    institutionsSnapshot.forEach(doc => {
      institutions.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({
      success: true,
      data: institutions,
      count: institutions.length
    });
  } catch (error) {
    console.error('❌ Get institutions error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch institutions',
      details: error.message 
    });
  }
});

// Get courses for a specific institution (public)
router.get('/institutions/:institutionId/courses', async (req, res) => {
  try {
    const { institutionId } = req.params;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        error: 'Institution ID is required'
      });
    }

    let coursesSnapshot = await db.collection('courses')
      .where('institutionId', '==', institutionId)
      .where('status', '==', 'active')
      .get();

    // Fallback: if no active courses, return all courses for institution
    if (coursesSnapshot.empty) {
      coursesSnapshot = await db.collection('courses')
        .where('institutionId', '==', institutionId)
        .get();
    }

    const courses = [];
    coursesSnapshot.forEach(doc => {
      courses.push({ id: doc.id, ...doc.data() });
    });

    res.json({
      success: true,
      data: courses,
      count: courses.length
    });
  } catch (error) {
    console.error('❌ Get institution courses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch courses',
      details: error.message
    });
  }
});

// Get statistics for landing page
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching platform statistics...');

    // Get all students (active status)
    const studentsSnapshot = await db.collection('students').get();
    console.log(`👨‍🎓 Students count: ${studentsSnapshot.size}`);

    // Get ALL institutions (both approved and pending)
    const institutionsSnapshot = await db.collection('institutions').get();
    console.log(`🏫 Institutions count: ${institutionsSnapshot.size}`);

    // Get companies only from canonical collection
    const companiesSnapshot = await db.collection('companies').get();
    const companyMap = new Map();
    companiesSnapshot.forEach(doc => companyMap.set(doc.id, doc.data()));
    let companiesCount = companyMap.size;
    if (companiesCount === 0) {
      // Fallback to users with role=company
      const usersCompaniesSnapshot = await db.collection('users')
        .where('role', '==', 'company')
        .get();
      companiesCount = usersCompaniesSnapshot.size;
      console.log(`💼 Companies fallback count (users.role=company): ${companiesCount}`);
    } else {
      console.log(`💼 Companies merged count: ${companiesCount}`);
    }

    // Get active jobs
    const jobsSnapshot = await db.collection('jobs').where('status', '==', 'active').get();
    console.log(`💼 Jobs count: ${jobsSnapshot.size}`);

    // Count approved vs pending
    let approvedInstitutions = 0;
    let pendingInstitutions = 0;
    institutionsSnapshot.forEach(doc => {
      const institution = doc.data();
      if (institution.status === 'approved') {
        approvedInstitutions++;
      } else if (institution.status === 'pending') {
        pendingInstitutions++;
      }
    });

    let approvedCompanies = 0;
    let pendingCompanies = 0;
    if (companyMap.size > 0) {
      for (const company of companyMap.values()) {
        if (company.status === 'approved') approvedCompanies++;
        else if (company.status === 'pending') pendingCompanies++;
      }
    }

    const stats = {
      students: studentsSnapshot.size,
      institutions: institutionsSnapshot.size, // Total institutions
      companies: companiesCount, // Total companies
      jobs: jobsSnapshot.size,
      approvedInstitutions,
      pendingInstitutions,
      approvedCompanies, 
      pendingCompanies
    };

    console.log('📊 Final stats:', stats);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch statistics',
      details: error.message 
    });
  }
});

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Public routes are working!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;