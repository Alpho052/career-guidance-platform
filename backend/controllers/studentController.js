const { db } = require('../config/firebase');
const { calculateGPA, convertFirestoreDoc } = require('../utils/helpers');

/* ---------- Utility ---------- */
const timestampToMillis = (value) => {
  if (!value) return 0;
  if (value.toMillis) return value.toMillis();
  if (value._seconds !== undefined)
    return value._seconds * 1000 + (value._nanoseconds || 0) / 1e6;
  if (value.seconds !== undefined)
    return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

/* ---------- Helper: Build Job Match Profile ---------- */
const buildStudentJobMatchProfile = async (studentId, studentData) => {
  const gpa = studentData.gpa ? Number(studentData.gpa) : 0;
  const experience = Array.isArray(studentData.experience) ? studentData.experience : [];
  const totalExperienceYears = experience.reduce(
    (sum, exp) => sum + (Number(exp.years) || 0),
    0
  );

  const skillsText = [
    studentData.skills || '',
    ...experience.map(exp => `${exp.role || ''} ${exp.description || ''}`)
  ].join(' ').toLowerCase();

  const documentsSnapshot = await db.collection('studentDocuments')
    .where('studentId', '==', studentId)
    .get();

  const certificates = [];
  documentsSnapshot.forEach(doc => {
    const data = doc.data();
    if (['certificate', 'diploma'].includes((data.documentType || '').toLowerCase())) {
      certificates.push({
        id: doc.id,
        fileName: data.fileName || '',
        documentType: data.documentType || ''
      });
    }
  });

  const certificateNamesLower = certificates.map(cert => cert.fileName.toLowerCase());

  return {
    gpa,
    experience,
    totalExperienceYears,
    skillsText,
    certificates,
    certificateNamesLower
  };
};

/* ---------- Helper: Qualification Check ---------- */
const studentQualifiesForJob = (job, profile) => {
  const jobMinGPA = job.minGPA ? Number(job.minGPA) : 0;
  const meetsGPA = !jobMinGPA || profile.gpa >= jobMinGPA;

  const jobMinExperience = job.minExperienceYears ? Number(job.minExperienceYears) : 0;
  const meetsExperience =
    !jobMinExperience || profile.totalExperienceYears >= jobMinExperience;

  const requiredCertificates = Array.isArray(job.requirements?.requiredCertificates)
    ? job.requirements.requiredCertificates.map(cert => cert.toLowerCase())
    : [];
  const meetsCertificates =
    requiredCertificates.length === 0 ||
    requiredCertificates.every(required =>
      profile.certificateNamesLower.some(name => name.includes(required))
    );

  const jobKeywords = Array.isArray(job.requirements?.keywords)
    ? job.requirements.keywords.map(keyword => keyword.toLowerCase())
    : [];
  const matchesKeywords =
    jobKeywords.length === 0 ||
    jobKeywords.every(keyword => profile.skillsText.includes(keyword));

  return {
    qualifies: meetsGPA && meetsExperience && meetsCertificates && matchesKeywords,
    details: { meetsGPA, meetsExperience, meetsCertificates, matchesKeywords }
  };
};

/* ---------- Real Implementations ---------- */

// ✅ Get Student Profile
const getStudentProfile = async (req, res) => {
  try {
    const studentId = req.user.id;
    const studentDoc = await db.collection('students').doc(studentId).get();

    if (!studentDoc.exists) {
      return res.status(404).json({ success: false, error: 'Student profile not found' });
    }

    const student = studentDoc.data();

    // Get applications
    const applicationsSnapshot = await db.collection('applications')
      .where('studentId', '==', studentId)
      .get();

    const applications = [];
    applicationsSnapshot.forEach(doc => applications.push({ id: doc.id, ...doc.data() }));

    // Get grades and calculate GPA
    const gradesSnapshot = await db.collection('grades')
      .where('studentId', '==', studentId)
      .get();

    const grades = [];
    gradesSnapshot.forEach(doc => grades.push({ id: doc.id, ...doc.data() }));

    const gpa = calculateGPA(grades);

    res.json({
      success: true,
      student: { ...student, gpa, applicationCount: applications.length },
      applications,
      grades
    });
  } catch (error) {
    console.error('❌ Get student profile error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ✅ Get Institution Courses
const getInstitutionCourses = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { institutionId } = req.params;
    if (!institutionId) {
      return res.status(400).json({ success: false, error: 'Institution ID is required' });
    }

    const coursesSnapshot = await db.collection('courses')
      .where('institutionId', '==', institutionId)
      .get();

    let courses = [];
    coursesSnapshot.forEach(doc => courses.push({ id: doc.id, ...doc.data() }));

    if (studentId) {
      const gradesSnapshot = await db.collection('grades')
        .where('studentId', '==', studentId)
        .get();
      const studentGrades = [];
      gradesSnapshot.forEach(doc => studentGrades.push(doc.data()));

      const numericGpa =
        studentGrades.length > 0
          ? Number(
              (
                studentGrades.reduce((s, g) => {
                  const percentage = g.grade || 0;
                  return s + (percentage / 100) * 4;
                }, 0) / studentGrades.length
              ).toFixed(2)
            )
          : 0;

      courses = courses.filter(course => {
        const reqs = course.requirements || {};
        if (reqs.minGPA && numericGpa < Number(reqs.minGPA)) return false;

        if (Array.isArray(reqs.requiredSubjects) && reqs.requiredSubjects.length > 0) {
          const minGrade = Number(reqs.minSubjectGrade || 0);
          for (const subj of reqs.requiredSubjects) {
            const found = studentGrades.find(
              g => (g.subject || '').toLowerCase() === String(subj).toLowerCase()
            );
            if (!found || Number(found.grade || 0) < minGrade) return false;
          }
        }
        return true;
      });
    }

    res.json({ success: true, data: courses });
  } catch (error) {
    console.error('❌ Get institution courses error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/* ---------- Placeholder Routes (no crash, safe deploy) ---------- */

// Profile
const updateStudentProfile = async (req, res) => {
  res.json({ success: true, message: 'updateStudentProfile placeholder' });
};

// Grades
const updateGrades = async (req, res) => {
  res.json({ success: true, message: 'updateGrades placeholder' });
};

// Courses
const applyForCourses = async (req, res) => {
  res.json({ success: true, message: 'applyForCourses placeholder' });
};
const getStudentApplications = async (req, res) => {
  res.json({ success: true, message: 'getStudentApplications placeholder' });
};
const decideOnOffer = async (req, res) => {
  res.json({ success: true, message: 'decideOnOffer placeholder' });
};

// Jobs
const getAvailableJobs = async (req, res) => {
  res.json({ success: true, message: 'getAvailableJobs placeholder' });
};
const applyForJob = async (req, res) => {
  res.json({ success: true, message: 'applyForJob placeholder' });
};
const saveJob = async (req, res) => {
  res.json({ success: true, message: 'saveJob placeholder' });
};
const getJobApplicationsIds = async (req, res) => {
  res.json({ success: true, message: 'getJobApplicationsIds placeholder' });
};
const getSavedJobIds = async (req, res) => {
  res.json({ success: true, message: 'getSavedJobIds placeholder' });
};

// Documents
const uploadDocument = async (req, res) => {
  res.json({ success: true, message: 'uploadDocument placeholder' });
};
const getStudentDocuments = async (req, res) => {
  res.json({ success: true, message: 'getStudentDocuments placeholder' });
};
const deleteDocument = async (req, res) => {
  res.json({ success: true, message: 'deleteDocument placeholder' });
};

// Notifications
const getNotifications = async (req, res) => {
  res.json({ success: true, message: 'getNotifications placeholder' });
};
const markNotificationRead = async (req, res) => {
  res.json({ success: true, message: 'markNotificationRead placeholder' });
};

/* ---------- Export All ---------- */
module.exports = {
  getStudentProfile,
  getInstitutionCourses,
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
  markNotificationRead,
};
/*const { db } = require('../config/firebase');
const { calculateGPA, convertFirestoreDoc } = require('../utils/helpers');

const timestampToMillis = (value) => {
  if (!value) return 0;
  if (value.toMillis) return value.toMillis();
  if (value._seconds !== undefined) {
    return value._seconds * 1000 + (value._nanoseconds || 0) / 1e6;
  }
  if (value.seconds !== undefined) {
    return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  }
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const buildStudentJobMatchProfile = async (studentId, studentData) => {
  const gpa = studentData.gpa ? Number(studentData.gpa) : 0;
  const experience = Array.isArray(studentData.experience) ? studentData.experience : [];
  const totalExperienceYears = experience.reduce((sum, exp) => sum + (Number(exp.years) || 0), 0);

  const skillsText = [
    studentData.skills || '',
    ...experience.map(exp => `${exp.role || ''} ${exp.description || ''}`)
  ].join(' ').toLowerCase();

  const documentsSnapshot = await db.collection('studentDocuments')
    .where('studentId', '==', studentId)
    .get();

  const certificates = [];
  documentsSnapshot.forEach(doc => {
    const data = doc.data();
    if (['certificate', 'diploma'].includes((data.documentType || '').toLowerCase())) {
      certificates.push({
        id: doc.id,
        fileName: data.fileName || '',
        documentType: data.documentType || ''
      });
    }
  });

  const certificateNamesLower = certificates.map(cert => cert.fileName.toLowerCase());

  return {
    gpa,
    experience,
    totalExperienceYears,
    skillsText,
    certificates,
    certificateNamesLower
  };
};

const studentQualifiesForJob = (job, profile) => {
  const jobMinGPA = job.minGPA ? Number(job.minGPA) : 0;
  const meetsGPA = !jobMinGPA || profile.gpa >= jobMinGPA;

  const jobMinExperience = job.minExperienceYears ? Number(job.minExperienceYears) : 0;
  const meetsExperience = !jobMinExperience || profile.totalExperienceYears >= jobMinExperience;

  const requiredCertificates = Array.isArray(job.requirements?.requiredCertificates)
    ? job.requirements.requiredCertificates.map(cert => cert.toLowerCase())
    : [];
  const meetsCertificates = requiredCertificates.length === 0 || requiredCertificates.every(required =>
    profile.certificateNamesLower.some(name => name.includes(required))
  );

  const jobKeywords = Array.isArray(job.requirements?.keywords)
    ? job.requirements.keywords.map(keyword => keyword.toLowerCase())
    : [];
  const matchesKeywords = jobKeywords.length === 0 || jobKeywords.every(keyword => profile.skillsText.includes(keyword));

  return {
    qualifies: meetsGPA && meetsExperience && meetsCertificates && matchesKeywords,
    details: {
      meetsGPA,
      meetsExperience,
      meetsCertificates,
      matchesKeywords
    }
  };
};

// Get student profile
const getStudentProfile = async (req, res) => {
  try {
    const studentId = req.user.id;

    const studentDoc = await db.collection('students').doc(studentId).get();
    if (!studentDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Student profile not found'
      });
    }

    const student = studentDoc.data();
    
    // Get applications
    const applicationsSnapshot = await db.collection('applications')
      .where('studentId', '==', studentId)
      .get();
    
    const applications = [];
    applicationsSnapshot.forEach(doc => {
      applications.push({ id: doc.id, ...doc.data() });
    });

    // Get grades and calculate GPA
    const gradesSnapshot = await db.collection('grades')
      .where('studentId', '==', studentId)
      .get();
    
    const grades = [];
    gradesSnapshot.forEach(doc => {
      grades.push({ id: doc.id, ...doc.data() });
    });

    const gpa = calculateGPA(grades);

    res.json({
      success: true,
      student: {
        ...student,
        gpa,
        applicationCount: applications.length
      },
      applications,
      grades
    });

  } catch (error) {
    console.error('❌ Get student profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update student profile
const updateStudentProfile = async (req, res) => {
  try {
    const studentId = req.user.id;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.uid;
    delete updateData.email;
    delete updateData.role;

    if (typeof updateData.skills === 'string') {
      updateData.skills = updateData.skills.trim();
    }

    if (Array.isArray(updateData.experience)) {
      updateData.experience = updateData.experience.map(exp => ({
        company: exp.company || '',
        role: exp.role || '',
        years: Number(exp.years) || 0,
        description: exp.description || ''
      }));
    }

    await db.collection('students').doc(studentId).update({
      ...updateData,
      updatedAt: new Date()
    });

    await db.collection('users').doc(studentId).update({
      updatedAt: new Date()
    });

    console.log(`✅ Student profile updated: ${studentId}`);

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('❌ Update student profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Add/update grades
const updateGrades = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { grades } = req.body;

    if (!Array.isArray(grades)) {
      return res.status(400).json({
        success: false,
        error: 'Grades must be an array'
      });
    }

    // Validate grades
    for (const grade of grades) {
      if (!grade.subject || typeof grade.grade !== 'number' || grade.grade < 0 || grade.grade > 100) {
        return res.status(400).json({
          success: false,
          error: 'Each grade must have subject (string) and grade (number between 0-100)'
        });
      }
    }

    // Delete existing grades
    const existingGrades = await db.collection('grades')
      .where('studentId', '==', studentId)
      .get();
    
    const deletePromises = [];
    existingGrades.forEach(doc => {
      deletePromises.push(doc.ref.delete());
    });
    await Promise.all(deletePromises);

    // Add new grades
    const addPromises = grades.map(grade => {
      return db.collection('grades').add({
        studentId,
        subject: grade.subject,
        grade: grade.grade,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    await Promise.all(addPromises);

    // Update student's GPA
    const gpa = calculateGPA(grades);
    await db.collection('students').doc(studentId).update({
      gpa,
      updatedAt: new Date()
    });

    console.log(`✅ Grades updated for student: ${studentId}`);

    res.json({
      success: true,
      message: 'Grades updated successfully',
      gpa
    });

  } catch (error) {
    console.error('❌ Update grades error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Apply for courses
const applyForCourses = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { applications } = req.body;

    if (!Array.isArray(applications) || applications.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Applications array is required'
      });
    }

    // Check if student has already applied to 2 courses per institution
    const existingApplications = await db.collection('applications')
      .where('studentId', '==', studentId)
      .get();

    const applicationsByInstitution = {};
    existingApplications.forEach(doc => {
      const app = doc.data();
      if (!applicationsByInstitution[app.institutionId]) {
        applicationsByInstitution[app.institutionId] = 0;
      }
      applicationsByInstitution[app.institutionId]++;
    });

    // Validate new applications
  // Preload student's grades and GPA (convert percentage to 4.0 scale)
  const gradesSnapshot = await db.collection('grades')
    .where('studentId', '==', studentId)
    .get();
  const studentGrades = [];
  gradesSnapshot.forEach(doc => studentGrades.push(doc.data()));
  const numericGpa = studentGrades.length > 0
    ? Number(((studentGrades.reduce((s, g) => {
        const percentage = g.grade || 0;
        return s + ((percentage / 100) * 4);
      }, 0)) / studentGrades.length).toFixed(2))
    : 0;

    for (const application of applications) {
      const institutionId = application.institutionId;
      const courseId = application.courseId;

      if (!institutionId || !courseId) {
        return res.status(400).json({
          success: false,
          error: 'Each application must have institutionId and courseId'
        });
      }

      // Check if already applied to 2 courses in this institution
      const currentCount = applicationsByInstitution[institutionId] || 0;
      const newApplicationsForInstitution = applications.filter(app => 
        app.institutionId === institutionId
      ).length;

      if (currentCount + newApplicationsForInstitution > 2) {
        return res.status(400).json({
          success: false,
          error: `Cannot apply to more than 2 courses per institution. You have ${currentCount} existing applications for this institution.`
        });
      }

      // Check if already applied to same course
      const alreadyApplied = existingApplications.docs.some(doc => {
        const existingApp = doc.data();
        return existingApp.courseId === courseId && existingApp.institutionId === institutionId;
      });

      if (alreadyApplied) {
        return res.status(400).json({
          success: false,
          error: 'You have already applied to this course'
        });
      }

    // Validate against course requirements
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }
    const course = courseDoc.data();
    const reqs = course.requirements || {};

    if (reqs.minGPA && Number(numericGpa) < Number(reqs.minGPA)) {
      return res.status(400).json({
        success: false,
        error: `Minimum GPA of ${reqs.minGPA} required for ${course.name}`
      });
    }

    if (Array.isArray(reqs.requiredSubjects) && reqs.requiredSubjects.length > 0) {
      const minSubjectGrade = Number(reqs.minSubjectGrade || 0);
      for (const subject of reqs.requiredSubjects) {
        const gradeRec = studentGrades.find(g => (g.subject || '').toLowerCase() === String(subject).toLowerCase());
        if (!gradeRec || Number(gradeRec.grade || 0) < minSubjectGrade) {
          return res.status(400).json({
            success: false,
            error: `You do not meet subject requirements for ${course.name}. Required: ${subject} >= ${minSubjectGrade}`
          });
        }
      }
    }
    }

    // Create applications
    const applicationPromises = applications.map(application => {
      return db.collection('applications').add({
        studentId,
        institutionId: application.institutionId,
        courseId: application.courseId,
        status: 'pending',
        appliedAt: new Date(),
        updatedAt: new Date()
      });
    });

    await Promise.all(applicationPromises);

    console.log(`✅ Course applications submitted by student: ${studentId}`);

    res.json({
      success: true,
      message: 'Applications submitted successfully'
    });

  } catch (error) {
    console.error('❌ Course application error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get student's applications
const getStudentApplications = async (req, res) => {
  try {
    const studentId = req.user.id;

    const applicationsSnapshot = await db.collection('applications')
      .where('studentId', '==', studentId)
      .get();

    const applications = [];
    
    for (const doc of applicationsSnapshot.docs) {
      const application = convertFirestoreDoc(doc);
      application.id = doc.id;
      
      // Get course details
      const courseDoc = await db.collection('courses').doc(application.courseId).get();
      if (courseDoc.exists) {
        application.course = convertFirestoreDoc(courseDoc);
      }

      // Get institution details
      const institutionDoc = await db.collection('institutions').doc(application.institutionId).get();
      if (institutionDoc.exists) {
        application.institution = convertFirestoreDoc(institutionDoc);
      }

      applications.push(application);
    }

    res.json({
      success: true,
      applications
    });

  } catch (error) {
    console.error('❌ Get student applications error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get available jobs
const getAvailableJobs = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Get student's GPA and profile
    const studentDoc = await db.collection('students').doc(studentId).get();
    const student = studentDoc.exists ? studentDoc.data() : {};
    const matchProfile = await buildStudentJobMatchProfile(studentId, student);

    // Get active jobs
    const jobsSnapshot = await db.collection('jobs')
      .where('status', '==', 'active')
      .get();

    const jobs = [];
    
    for (const doc of jobsSnapshot.docs) {
      const job = { id: doc.id, ...doc.data() };
      
      const { qualifies } = studentQualifiesForJob(job, matchProfile);
      if (!qualifies) {
        continue;
      }

      // Get company details
      const companyDoc = await db.collection('companies').doc(job.companyId).get();
      if (companyDoc.exists) {
        job.company = companyDoc.data();
      }
      
      jobs.push(job);
    }

    res.json({
      success: true,
      jobs,
      totalCount: jobs.length
    });

  } catch (error) {
    console.error('❌ Get available jobs error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Apply to a job
const applyForJob = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { jobId } = req.params;

    // Verify job exists
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    if (!jobDoc.exists) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    const job = { id: jobDoc.id, ...jobDoc.data() };

    // Prevent duplicate application
    const existing = await db.collection('jobApplications')
      .where('studentId', '==', studentId)
      .where('jobId', '==', jobId)
      .get();
    if (!existing.empty) {
      return res.status(400).json({ success: false, error: 'Already applied to this job' });
    }

    const studentDoc = await db.collection('students').doc(studentId).get();
    const student = studentDoc.exists ? studentDoc.data() : {};
    const matchProfile = await buildStudentJobMatchProfile(studentId, student);
    const { qualifies } = studentQualifiesForJob(job, matchProfile);

    if (!qualifies) {
      return res.status(400).json({
        success: false,
        error: 'You do not meet all of the requirements for this job.'
      });
    }

    await db.collection('jobApplications').add({
      studentId,
      jobId,
      status: 'applied',
      appliedAt: new Date(),
      updatedAt: new Date()
    });

    res.json({ success: true, message: 'Applied to job successfully' });
  } catch (error) {
    console.error('❌ Apply for job error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Save job for later
const saveJob = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { jobId } = req.params;

    // Verify job exists
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    if (!jobDoc.exists) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Prevent duplicate save
    const existing = await db.collection('savedJobs')
      .where('studentId', '==', studentId)
      .where('jobId', '==', jobId)
      .get();
    if (!existing.empty) {
      return res.json({ success: true, message: 'Already saved' });
    }

    await db.collection('savedJobs').add({
      studentId,
      jobId,
      savedAt: new Date()
    });

    res.json({ success: true, message: 'Job saved' });
  } catch (error) {
    console.error('❌ Save job error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get student's job application ids
const getJobApplicationsIds = async (req, res) => {
  try {
    const studentId = req.user.id;
    const apps = await db.collection('jobApplications')
      .where('studentId', '==', studentId)
      .get();
    const jobIds = apps.docs.map(d => d.data().jobId);
    res.json({ success: true, jobIds });
  } catch (error) {
    console.error('❌ Get job application ids error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get student's saved job ids
const getSavedJobIds = async (req, res) => {
  try {
    const studentId = req.user.id;
    const saved = await db.collection('savedJobs')
      .where('studentId', '==', studentId)
      .get();
    const jobIds = saved.docs.map(d => d.data().jobId);
    res.json({ success: true, jobIds });
  } catch (error) {
    console.error('❌ Get saved job ids error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
// Accept or decline an admission offer (student-owned application)
const decideOnOffer = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { applicationId } = req.params;
    const { decision } = req.body; // 'accept' | 'decline'

    if (!['accept', 'decline'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'Decision must be accept or decline' });
    }

    const appDoc = await db.collection('applications').doc(applicationId).get();
    if (!appDoc.exists || appDoc.data().studentId !== studentId) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    const current = appDoc.data();
    if (current.status !== 'admitted') {
      return res.status(400).json({ success: false, error: 'Only admitted offers can be accepted or declined' });
    }

    const newStatus = decision === 'accept' ? 'accepted' : 'declined';

    await db.collection('applications').doc(applicationId).update({
      status: newStatus,
      updatedAt: new Date(),
      decisionAt: new Date(),
      decisionBy: studentId
    });

    res.json({ success: true, message: `Offer ${newStatus}.` });
  } catch (error) {
    console.error('❌ Decide on offer error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Upload document (additional documents, transcripts, certificates)
const uploadDocument = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { documentType, fileName, fileUrl, description } = req.body;

    if (!documentType || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'Document type and file name are required'
      });
    }

    const validTypes = ['additional', 'transcript', 'certificate', 'diploma', 'other'];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        error: `Document type must be one of: ${validTypes.join(', ')}`
      });
    }

    const document = {
      studentId,
      documentType,
      fileName,
      fileUrl: fileUrl || '',
      description: description || '',
      uploadedAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('studentDocuments').add(document);

    // Update student profile to track document count
    const studentDoc = await db.collection('students').doc(studentId).get();
    if (studentDoc.exists) {
      const currentDocs = studentDoc.data().documentCount || 0;
      await db.collection('students').doc(studentId).update({
        documentCount: currentDocs + 1,
        updatedAt: new Date()
      });
    }

    console.log(`✅ Document uploaded by student: ${studentId}`);

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      documentId: docRef.id
    });

  } catch (error) {
    console.error('❌ Upload document error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get student documents
const getStudentDocuments = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { documentType } = req.query;

    let query = db.collection('studentDocuments')
      .where('studentId', '==', studentId);

    if (documentType) {
      query = query.where('documentType', '==', documentType);
    }

    const documentsSnapshot = await query.get();

    const documents = [];
    documentsSnapshot.forEach(doc => {
      documents.push({ id: doc.id, ...doc.data() });
    });

    res.json({
      success: true,
      documents
    });

  } catch (error) {
    console.error('❌ Get student documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Delete document
const deleteDocument = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { documentId } = req.params;

    const docRef = db.collection('studentDocuments').doc(documentId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    if (doc.data().studentId !== studentId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to delete this document'
      });
    }

    await docRef.delete();

    // Update student document count
    const studentDoc = await db.collection('students').doc(studentId).get();
    if (studentDoc.exists) {
      const currentDocs = studentDoc.data().documentCount || 0;
      await db.collection('students').doc(studentId).update({
        documentCount: Math.max(0, currentDocs - 1),
        updatedAt: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete document error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get notifications for student
const getNotifications = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { unreadOnly } = req.query;

    // Fetch all notifications for the student (no orderBy to avoid index requirement)
    const notificationsSnapshot = await db.collection('notifications')
      .where('studentId', '==', studentId)
      .get();

    const notifications = [];
    notificationsSnapshot.forEach(doc => {
      const notification = { id: doc.id, ...doc.data() };
      if (unreadOnly === 'true' && notification.read) {
        return; // Skip read notifications if unreadOnly is true
      }
      notifications.push(notification);
    });

    // Sort in memory by createdAt descending
    notifications.sort((a, b) => {
      let aTime = 0;
      let bTime = 0;
      
      // Handle Firestore Timestamp objects
      if (a.createdAt) {
        if (a.createdAt.toMillis) {
          aTime = a.createdAt.toMillis();
        } else if (a.createdAt.seconds) {
          aTime = a.createdAt.seconds * 1000 + (a.createdAt.nanoseconds || 0) / 1000000;
        } else if (a.createdAt._seconds) {
          aTime = a.createdAt._seconds * 1000 + (a.createdAt._nanoseconds || 0) / 1000000;
        } else if (typeof a.createdAt === 'number') {
          aTime = a.createdAt;
        } else if (a.createdAt instanceof Date) {
          aTime = a.createdAt.getTime();
        }
      }
      
      if (b.createdAt) {
        if (b.createdAt.toMillis) {
          bTime = b.createdAt.toMillis();
        } else if (b.createdAt.seconds) {
          bTime = b.createdAt.seconds * 1000 + (b.createdAt.nanoseconds || 0) / 1000000;
        } else if (b.createdAt._seconds) {
          bTime = b.createdAt._seconds * 1000 + (b.createdAt._nanoseconds || 0) / 1000000;
        } else if (typeof b.createdAt === 'number') {
          bTime = b.createdAt;
        } else if (b.createdAt instanceof Date) {
          bTime = b.createdAt.getTime();
        }
      }
      
      return bTime - aTime;
    });

    // Limit to 50 most recent
    const limitedNotifications = notifications.slice(0, 50);

    res.json({
      success: true,
      notifications: limitedNotifications
    });

  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Mark notification as read
const markNotificationRead = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { notificationId } = req.params;

    const notificationRef = db.collection('notifications').doc(notificationId);
    const notification = await notificationRef.get();

    if (!notification.exists) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    if (notification.data().studentId !== studentId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    await notificationRef.update({
      read: true,
      readAt: new Date(),
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('❌ Mark notification read error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Helper function to create job opportunity notification (called when new job is posted)
const createJobNotification = async (studentId, jobId, jobTitle, companyName) => {
  try {
    await db.collection('notifications').add({
      studentId,
      type: 'job_opportunity',
      title: 'New Job Opportunity',
      message: `A new job "${jobTitle}" at ${companyName} matches your profile!`,
      jobId,
      read: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('❌ Create job notification error:', error);
  }
};

module.exports = {
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
  markNotificationRead,
  createJobNotification
};*/
