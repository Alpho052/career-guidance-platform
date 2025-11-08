const express = require('express');
const router = express.Router();
const {
  getInstitutionProfile,
  updateInstitutionProfile,
  getFaculties,
  addFaculty,
  updateFaculty,
  deleteFaculty,
  getCourses,
  addCourse,
  updateCourse,
  deleteCourse,
  getStudentApplications,
  updateApplicationStatus,
  updateAdmissionsSettings
} = require('../controllers/institutionController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require institution authentication
router.use(authenticate);
router.use(authorize('institution'));

// Profile routes
router.get('/profile', getInstitutionProfile);
router.put('/profile', updateInstitutionProfile);

// Faculty management routes
router.get('/faculties', getFaculties);
router.post('/faculties', addFaculty);
router.put('/faculties/:facultyId', updateFaculty);
router.delete('/faculties/:facultyId', deleteFaculty);

// Course management routes
router.get('/courses', getCourses);
router.post('/courses', addCourse);
router.put('/courses/:courseId', updateCourse);
router.delete('/courses/:courseId', deleteCourse);

// Application management routes
router.get('/applications', getStudentApplications);
router.put('/applications/:applicationId/status', updateApplicationStatus);

// Admissions settings
router.put('/admissions/settings', updateAdmissionsSettings);

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Institution routes are working!',
    user: req.user
  });
});

module.exports = router;