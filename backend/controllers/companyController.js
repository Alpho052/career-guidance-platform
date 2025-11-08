const { db } = require('../config/firebase');
const { calculateGPA } = require('../utils/helpers');

// Get company profile
const getCompanyProfile = async (req, res) => {
  try {
    const companyId = req.user.id;

    const companyDoc = await db.collection('companies').doc(companyId).get();
    if (!companyDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Company profile not found'
      });
    }

    const company = companyDoc.data();

    // Get jobs count
    const jobsSnapshot = await db.collection('jobs')
      .where('companyId', '==', companyId)
      .get();

    res.json({
      success: true,
      company: {
        ...company,
        jobsCount: jobsSnapshot.size
      }
    });

  } catch (error) {
    console.error('❌ Get company profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update company profile
const updateCompanyProfile = async (req, res) => {
  try {
    const companyId = req.user.id;
    const updateData = req.body || {};

    // Remove fields that shouldn't be updated
    delete updateData.uid;
    delete updateData.email;
    delete updateData.role;

    const companyRef = db.collection('companies').doc(companyId);
    const existing = await companyRef.get();
    if (!existing.exists) {
      // Create if missing
      const userDoc = await db.collection('users').doc(companyId).get();
      const user = userDoc.exists ? userDoc.data() : {};
      await companyRef.set({
        uid: companyId,
        email: user.email || req.user.email,
        name: user.name || req.user.name || '',
        status: 'approved',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...updateData
      }, { merge: true });
    } else {
      await companyRef.update({
        ...updateData,
        updatedAt: new Date()
      });
    }

    await db.collection('users').doc(companyId).update({
      updatedAt: new Date()
    });

    console.log(`✅ Company profile updated: ${companyId}`);

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('❌ Update company profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Manage jobs
const getJobs = async (req, res) => {
  try {
    const companyId = req.user.id;

    const jobsSnapshot = await db.collection('jobs')
      .where('companyId', '==', companyId)
      .get();

    const jobs = [];
    jobsSnapshot.forEach(doc => {
      jobs.push({ id: doc.id, ...doc.data() });
    });

    res.json({
      success: true,
      jobs
    });

  } catch (error) {
    console.error('❌ Get jobs error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const normalizeArrayInput = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((item) => (typeof item === 'string' ? item.trim() : item))
      .filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const postJob = async (req, res) => {
  try {
    const companyId = req.user.id;
    const jobData = req.body;

    if (!jobData.title || !jobData.description) {
      return res.status(400).json({
        success: false,
        error: 'Job title and description are required'
      });
    }

    // Get company details for notifications
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const companyName = companyDoc.exists ? companyDoc.data().name : 'A Company';

    const requiredCertificates = normalizeArrayInput(jobData.requirements?.requiredCertificates);
    const keywords = normalizeArrayInput(jobData.requirements?.keywords);

    const job = {
      companyId,
      title: jobData.title,
      description: jobData.description,
      requirements: {
        education: jobData.requirements?.education || '',
        experience: jobData.requirements?.experience || '',
        skills: jobData.requirements?.skills || '',
        requiredCertificates,
        keywords,
      },
      minGPA: jobData.minGPA ? Number(jobData.minGPA) : 0,
      minExperienceYears: jobData.minExperienceYears ? Number(jobData.minExperienceYears) : 0,
      location: jobData.location || '',
      type: jobData.type || 'full-time', // full-time, part-time, internship
      salary: jobData.salary || '',
      applicationDeadline: jobData.applicationDeadline || null,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('jobs').add(job);
    const jobId = docRef.id;

    // Create notifications for students who match job requirements
    try {
      const studentsSnapshot = await db.collection('students').get();
      const { createJobNotification } = require('./studentController');
      
      for (const studentDoc of studentsSnapshot.docs) {
        const student = studentDoc.data();
        const studentId = studentDoc.id;
        
        // Check if student meets minimum GPA requirement
        const studentGPA = student.gpa ? Number(student.gpa) : 0;
        if (job.minGPA && studentGPA < job.minGPA) {
          continue; // Skip students who don't meet GPA requirement
        }
        
        // Create notification for this student
        await createJobNotification(studentId, jobId, job.title, companyName);
      }
      
      console.log(`✅ Notifications created for matching students`);
    } catch (notifError) {
      console.error('⚠️ Error creating job notifications:', notifError);
      // Don't fail the job posting if notifications fail
    }

    console.log(`✅ Job posted: ${job.title}`);

    res.status(201).json({
      success: true,
      message: 'Job posted successfully',
      jobId: jobId
    });

  } catch (error) {
    console.error('❌ Post job error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const updateJob = async (req, res) => {
  try {
    const companyId = req.user.id;
    const jobId = req.params.jobId;
    const updateData = req.body;

    // Verify job belongs to company
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    if (!jobDoc.exists || jobDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    if (updateData.requirements) {
      updateData.requirements = {
        education: updateData.requirements.education,
        experience: updateData.requirements.experience,
        skills: updateData.requirements.skills,
        requiredCertificates: normalizeArrayInput(updateData.requirements.requiredCertificates),
        keywords: normalizeArrayInput(updateData.requirements.keywords)
      };
    }

    if (updateData.minGPA !== undefined) {
      updateData.minGPA = Number(updateData.minGPA) || 0;
    }

    if (updateData.minExperienceYears !== undefined) {
      updateData.minExperienceYears = Number(updateData.minExperienceYears) || 0;
    }

    await db.collection('jobs').doc(jobId).update({
      ...updateData,
      updatedAt: new Date()
    });

    console.log(`✅ Job updated: ${jobId}`);

    res.json({
      success: true,
      message: 'Job updated successfully'
    });

  } catch (error) {
    console.error('❌ Update job error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// View job applicants
const getJobApplicants = async (req, res) => {
  try {
    const companyId = req.user.id;
    const jobId = req.params.jobId;

    // Verify job belongs to company
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    if (!jobDoc.exists || jobDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    const job = jobDoc.data();

    const requiredCertificates = normalizeArrayInput(job.requirements?.requiredCertificates).map((c) => c.toLowerCase());
    const keywords = normalizeArrayInput(job.requirements?.keywords).map((k) => k.toLowerCase());
    const minGPA = job.minGPA ? Number(job.minGPA) : 0;
    const minExperienceYears = job.minExperienceYears ? Number(job.minExperienceYears) : 0;

    const jobApplicationsSnapshot = await db.collection('jobApplications')
      .where('jobId', '==', jobId)
      .get();

    const applicants = [];
    
    for (const doc of jobApplicationsSnapshot.docs) {
      const application = { id: doc.id, ...doc.data() };
      
      // Get student details
      const studentDoc = await db.collection('students').doc(application.studentId).get();
      if (studentDoc.exists) {
        application.student = studentDoc.data();
        application.student.skills = application.student.skills || '';
      } else {
        continue;
      }

      // Get student's grades and calculate GPA (4.0 scale)
      const gradesSnapshot = await db.collection('grades')
        .where('studentId', '==', application.studentId)
        .get();

      const grades = [];
      gradesSnapshot.forEach(gradeDoc => {
        grades.push(gradeDoc.data());
      });

      const calculatedGPA = grades.length > 0 ? calculateGPA(grades) : (application.student.gpa ? Number(application.student.gpa) : 0);
      const gpaValue = Number(calculatedGPA || 0);

      // Fetch student experience
      const experience = Array.isArray(application.student.experience) ? application.student.experience : [];
      const totalExperienceYears = experience.reduce((sum, exp) => sum + (Number(exp.years) || 0), 0);

      // Fetch student certificates
      const documentsSnapshot = await db.collection('studentDocuments')
        .where('studentId', '==', application.studentId)
        .get();

      const certificates = [];
      documentsSnapshot.forEach(document => {
        const data = document.data();
        if (['certificate', 'diploma'].includes((data.documentType || '').toLowerCase())) {
          certificates.push({
            id: document.id,
            fileName: data.fileName || 'Certificate',
            documentType: data.documentType || 'certificate'
          });
        }
      });

      const studentCertificatesLower = certificates.map(cert => cert.fileName.toLowerCase());

      // Evaluate applicant against job requirements
      const meetsGPA = !minGPA || gpaValue >= minGPA;
      const meetsExperience = !minExperienceYears || totalExperienceYears >= minExperienceYears;
      const meetsCertificates = requiredCertificates.length === 0 || requiredCertificates.every((requiredCert) =>
        studentCertificatesLower.some((studentCert) => studentCert.includes(requiredCert))
      );

      const skillsText = [
        application.student.skills || '',
        ...experience.map(exp => `${exp.role || ''} ${exp.description || ''}`)
      ].join(' ').toLowerCase();

      const matchesKeywords = keywords.length === 0 || keywords.every((keyword) => skillsText.includes(keyword));

      const meetsAllCriteria = meetsGPA && meetsExperience && meetsCertificates && matchesKeywords;

      if (!meetsAllCriteria) {
        continue;
      }

      const criteriaScore = [meetsGPA, meetsExperience, meetsCertificates, matchesKeywords].filter(Boolean).length;
      const score = criteriaScore + (Math.max(0, gpaValue - minGPA) * 0.25) + (totalExperienceYears * 0.1);

      application.student.gpa = gpaValue.toFixed(2);
      application.student.experience = experience;
      application.student.certificates = certificates;
      application.evaluation = {
        meetsGPA,
        meetsExperience,
        meetsCertificates,
        matchesKeywords,
        score: Number(score.toFixed(2)),
        gpa: Number(gpaValue.toFixed(2)),
        minGPA,
        totalExperienceYears,
        minExperienceYears,
        requiredCertificates: job.requirements?.requiredCertificates || [],
        matchedCertificates: certificates.map(cert => cert.fileName),
        keywords: job.requirements?.keywords || []
      };
      application.readyForInterview = true;

      applicants.push(application);
    }

    applicants.sort((a, b) => (b.evaluation?.score || 0) - (a.evaluation?.score || 0));

    res.json({
      success: true,
      applicants,
      totalCount: applicants.length
    });

  } catch (error) {
    console.error('❌ Get job applicants error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  getCompanyProfile,
  updateCompanyProfile,
  getJobs,
  postJob,
  updateJob,
  getJobApplicants
};