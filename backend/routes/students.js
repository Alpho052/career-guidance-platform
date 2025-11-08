const express = require('express');
const router = express.Router();
const {
  getStudentProfile,
  updateStudentProfile,
  updateGrades,
  applyForCourses,
  getStudentApplications,
  getAvailableJobs,
  decideOnOffer,
  applyForJob,
  saveJob,
  getJobApplicationsIds,
  getSavedJobIds,
  uploadDocument,
  getStudentDocuments,
  deleteDocument,
  getNotifications,
  markNotificationRead
} = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require student authentication
router.use(authenticate);
router.use(authorize('student'));

// Profile routes
router.get('/profile', getStudentProfile);
router.put('/profile', updateStudentProfile);

// Grades routes
router.put('/grades', updateGrades);

// Course application routes
router.post('/apply', applyForCourses);
router.get('/applications', getStudentApplications);
router.put('/applications/:applicationId/decision', decideOnOffer);

// Job routes
router.get('/jobs', getAvailableJobs);
router.post('/jobs/:jobId/apply', applyForJob);
router.post('/jobs/:jobId/save', saveJob);
router.get('/jobs/applications/ids', getJobApplicationsIds);
router.get('/jobs/saved/ids', getSavedJobIds);

// Document routes
router.post('/documents', uploadDocument);
router.get('/documents', getStudentDocuments);
router.delete('/documents/:documentId', deleteDocument);

// Notification routes
router.get('/notifications', getNotifications);
router.put('/notifications/:notificationId/read', markNotificationRead);

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Student routes are working!',
    user: req.user
  });
});

module.exports = router;