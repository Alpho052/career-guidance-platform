const express = require('express');
const router = express.Router();
const {
  getCompanyProfile,
  updateCompanyProfile,
  getJobs,
  postJob,
  updateJob,
  getJobApplicants
} = require('../controllers/companyController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require company authentication
router.use(authenticate);
router.use(authorize('company'));

// Profile routes
router.get('/profile', getCompanyProfile);
router.put('/profile', updateCompanyProfile);

// Job management routes
router.get('/jobs', getJobs);
router.post('/jobs', postJob);
router.put('/jobs/:jobId', updateJob);

// Applicant routes
router.get('/jobs/:jobId/applicants', getJobApplicants);

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Company routes are working!',
    user: req.user
  });
});

module.exports = router;