const express = require('express');
const router = express.Router();
const {
  getSystemStats,
  getInstitutions,
  createInstitution,
  updateInstitution,
  updateInstitutionStatus,
  deleteInstitution,
  getInstitutionCourses,
  addInstitutionCourse,
  updateCourse,
  deleteCourse,
  getCompanies,
  updateCompanyStatus,
  deleteCompany,
  getUsers,
  publishAdmissions,
  migrateCompanies
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// System statistics
router.get('/stats', getSystemStats);

// Institution management
router.get('/institutions', getInstitutions);
router.post('/institutions', createInstitution);
router.put('/institutions/:institutionId', updateInstitution);
router.put('/institutions/:institutionId/status', updateInstitutionStatus);
router.delete('/institutions/:institutionId', deleteInstitution);

// Institution courses management
router.get('/institutions/:institutionId/courses', getInstitutionCourses);
router.post('/institutions/:institutionId/courses', addInstitutionCourse);

// Course management
router.put('/courses/:courseId', updateCourse);
router.delete('/courses/:courseId', deleteCourse);

// Company management
router.get('/companies', getCompanies);
router.put('/companies/:companyId/status', updateCompanyStatus);
router.delete('/companies/:companyId', deleteCompany);

// Admissions management
router.post('/admissions/publish', publishAdmissions);

// Migration endpoint (one-time, admin only)
router.post('/migrate/companies', migrateCompanies);

// User management
router.get('/users', getUsers);

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Admin routes are working!',
    user: req.user
  });
});

module.exports = router;