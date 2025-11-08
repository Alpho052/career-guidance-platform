const { db } = require('../config/firebase');

// Get institution profile
const getInstitutionProfile = async (req, res) => {
  try {
    const institutionId = req.user.id;

    const institutionDoc = await db.collection('institutions').doc(institutionId).get();
    if (!institutionDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Institution profile not found'
      });
    }

    const institution = institutionDoc.data();

    // Get courses count
    const coursesSnapshot = await db.collection('courses')
      .where('institutionId', '==', institutionId)
      .get();

    // Get applications count
    const applicationsSnapshot = await db.collection('applications')
      .where('institutionId', '==', institutionId)
      .get();

    res.json({
      success: true,
      institution: {
        ...institution,
        coursesCount: coursesSnapshot.size,
        applicationsCount: applicationsSnapshot.size
      }
    });

  } catch (error) {
    console.error('❌ Get institution profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update institution profile
const updateInstitutionProfile = async (req, res) => {
  try {
    const institutionId = req.user.id;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.uid;
    delete updateData.email;
    delete updateData.role;

    await db.collection('institutions').doc(institutionId).update({
      ...updateData,
      updatedAt: new Date()
    });

    await db.collection('users').doc(institutionId).update({
      updatedAt: new Date()
    });

    console.log(`✅ Institution profile updated: ${institutionId}`);

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('❌ Update institution profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Manage faculties
const getFaculties = async (req, res) => {
  try {
    const institutionId = req.user.id;

    const facultiesSnapshot = await db.collection('faculties')
      .where('institutionId', '==', institutionId)
      .get();

    const faculties = [];
    facultiesSnapshot.forEach(doc => {
      faculties.push({ id: doc.id, ...doc.data() });
    });

    res.json({
      success: true,
      faculties
    });

  } catch (error) {
    console.error('❌ Get faculties error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const addFaculty = async (req, res) => {
  try {
    const institutionId = req.user.id;
    const facultyData = req.body;

    if (!facultyData.name) {
      return res.status(400).json({
        success: false,
        error: 'Faculty name is required'
      });
    }

    const faculty = {
      institutionId,
      name: facultyData.name,
      code: facultyData.code || '',
      description: facultyData.description || '',
      contactEmail: facultyData.contactEmail || '',
      contactPhone: facultyData.contactPhone || '',
      headOfDepartment: facultyData.headOfDepartment || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('faculties').add(faculty);

    console.log(`✅ Faculty added: ${faculty.name}`);

    res.status(201).json({
      success: true,
      message: 'Faculty added successfully',
      facultyId: docRef.id
    });

  } catch (error) {
    console.error('❌ Add faculty error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const updateFaculty = async (req, res) => {
  try {
    const institutionId = req.user.id;
    const { facultyId } = req.params;
    const updateData = req.body;

    const facultyRef = db.collection('faculties').doc(facultyId);
    const facultyDoc = await facultyRef.get();

    if (!facultyDoc.exists || facultyDoc.data().institutionId !== institutionId) {
      return res.status(404).json({
        success: false,
        error: 'Faculty not found'
      });
    }

    await facultyRef.update({
      ...updateData,
      updatedAt: new Date()
    });

    console.log(`✅ Faculty updated: ${facultyId}`);

    res.json({
      success: true,
      message: 'Faculty updated successfully'
    });

  } catch (error) {
    console.error('❌ Update faculty error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const deleteFaculty = async (req, res) => {
  try {
    const institutionId = req.user.id;
    const { facultyId } = req.params;

    const facultyRef = db.collection('faculties').doc(facultyId);
    const facultyDoc = await facultyRef.get();

    if (!facultyDoc.exists || facultyDoc.data().institutionId !== institutionId) {
      return res.status(404).json({
        success: false,
        error: 'Faculty not found'
      });
    }

    await facultyRef.delete();

    console.log(`🗑️ Faculty deleted: ${facultyId}`);

    res.json({
      success: true,
      message: 'Faculty deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete faculty error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Manage courses
const getCourses = async (req, res) => {
  try {
    const institutionId = req.user.id;

    const coursesSnapshot = await db.collection('courses')
      .where('institutionId', '==', institutionId)
      .get();

    const courses = [];
    coursesSnapshot.forEach(doc => {
      courses.push({ id: doc.id, ...doc.data() });
    });

    res.json({
      success: true,
      courses
    });

  } catch (error) {
    console.error('❌ Get courses error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const addCourse = async (req, res) => {
  try {
    const institutionId = req.user.id;
    const courseData = req.body;

    if (!courseData.name || !courseData.faculty) {
      return res.status(400).json({
        success: false,
        error: 'Course name and faculty are required'
      });
    }

    const course = {
      institutionId,
      name: courseData.name,
      faculty: courseData.faculty,
      description: courseData.description || '',
      duration: courseData.duration || '',
      requirements: courseData.requirements || {},
      capacity: courseData.capacity || 0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('courses').add(course);

    console.log(`✅ Course added: ${course.name}`);

    res.status(201).json({
      success: true,
      message: 'Course added successfully',
      courseId: docRef.id
    });

  } catch (error) {
    console.error('❌ Add course error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const updateCourse = async (req, res) => {
  try {
    const institutionId = req.user.id;
    const courseId = req.params.courseId;
    const updateData = req.body;

    // Verify course belongs to institution
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists || courseDoc.data().institutionId !== institutionId) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    await db.collection('courses').doc(courseId).update({
      ...updateData,
      updatedAt: new Date()
    });

    console.log(`✅ Course updated: ${courseId}`);

    res.json({
      success: true,
      message: 'Course updated successfully'
    });

  } catch (error) {
    console.error('❌ Update course error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const institutionId = req.user.id;
    const courseId = req.params.courseId;

    // Verify course belongs to institution
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists || courseDoc.data().institutionId !== institutionId) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    await db.collection('courses').doc(courseId).delete();

    console.log(`🗑️ Course deleted: ${courseId}`);

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete course error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Manage student applications
const getStudentApplications = async (req, res) => {
  try {
    const institutionId = req.user.id;
    const { status } = req.query;

    let query = db.collection('applications')
      .where('institutionId', '==', institutionId);

    if (status) {
      query = query.where('status', '==', status);
    }

    const applicationsSnapshot = await query.get();

    const applications = [];
    
    for (const doc of applicationsSnapshot.docs) {
      const application = { id: doc.id, ...doc.data() };
      
      // Get student details and compute GPA
      const studentDoc = await db.collection('students').doc(application.studentId).get();
      if (studentDoc.exists) {
        application.student = studentDoc.data();
        const gradesSnapshot = await db.collection('grades')
          .where('studentId', '==', application.studentId)
          .get();
        const grades = [];
        gradesSnapshot.forEach(gd => grades.push(gd.data()));
        if (grades.length > 0) {
          // Convert percentage grades to 4.0 scale GPA
          const total = grades.reduce((sum, g) => {
            const percentage = g.grade || 0;
            return sum + ((percentage / 100) * 4);
          }, 0);
          application.student.gpa = (total / grades.length).toFixed(2);
          application.student.grades = grades;
        }
      }

      // Get course details
      const courseDoc = await db.collection('courses').doc(application.courseId).get();
      if (courseDoc.exists) {
        application.course = courseDoc.data();
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
      error: 'Internal server error'
    });
  }
};

const updateApplicationStatus = async (req, res) => {
  try {
    const institutionId = req.user.id;
    const { applicationId } = req.params;
    const { status } = req.body;

    if (!['admitted', 'rejected', 'pending', 'waiting-list'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: admitted, rejected, pending, or waiting-list'
      });
    }

    // Verify application belongs to institution
    const applicationDoc = await db.collection('applications').doc(applicationId).get();
    if (!applicationDoc.exists || applicationDoc.data().institutionId !== institutionId) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    const applicationData = applicationDoc.data();

    if (status === 'admitted') {
      const existingAdmissions = await db.collection('applications')
        .where('studentId', '==', applicationData.studentId)
        .where('status', '==', 'admitted')
        .get();

      const hasOtherAdmission = existingAdmissions.docs.some(doc => doc.id !== applicationId);
      if (hasOtherAdmission) {
        return res.status(400).json({
          success: false,
          error: 'This student has already been admitted to another programme. They must confirm or decline that offer before you can admit them here.'
        });
      }
    }

    await db.collection('applications').doc(applicationId).update({
      status,
      updatedAt: new Date()
    });

    console.log(`✅ Application status updated: ${applicationId} -> ${status}`);

    res.json({
      success: true,
      message: 'Application status updated successfully'
    });

  } catch (error) {
    console.error('❌ Update application status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Admissions settings
const updateAdmissionsSettings = async (req, res) => {
  try {
    const institutionId = req.user.id;
    const { admissionsOpen, admissionsMessage, nextIntakeDate, contactEmail } = req.body;

    const updates = {
      updatedAt: new Date()
    };

    if (typeof admissionsOpen === 'boolean') {
      updates.admissionsOpen = admissionsOpen;
    }

    if (admissionsMessage !== undefined) {
      updates.admissionsMessage = admissionsMessage;
    }

    if (nextIntakeDate !== undefined) {
      updates.nextIntakeDate = nextIntakeDate;
    }

    if (contactEmail !== undefined) {
      updates.admissionsContactEmail = contactEmail;
    }

    await db.collection('institutions').doc(institutionId).update(updates);

    console.log(`✅ Admissions settings updated for institution: ${institutionId}`);

    res.json({
      success: true,
      message: 'Admissions settings updated successfully'
    });

  } catch (error) {
    console.error('❌ Update admissions settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
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
};