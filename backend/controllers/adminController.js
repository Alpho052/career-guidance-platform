const { db, auth } = require('../config/firebase');
// Migrate legacy 'companys' collection into 'companies'
const migrateCompanies = async (req, res) => {
  try {
    const legacySnap = await db.collection('companys').get();
    let migrated = 0;
    for (const doc of legacySnap.docs) {
      const data = doc.data();
      await db.collection('companies').doc(doc.id).set({
        ...data,
        migratedFrom: 'companys',
        updatedAt: new Date()
      }, { merge: true });
      migrated++;
      // Optionally delete legacy doc
      await db.collection('companys').doc(doc.id).delete();
    }
    res.json({ success: true, migrated });
  } catch (error) {
    console.error('❌ Migrate companies error:', error);
    res.status(500).json({ success: false, error: 'Migration failed' });
  }
};

// Get system statistics
const getSystemStats = async (req, res) => {
  try {
    const [
      studentsSnapshot,
      institutionsSnapshot,
      companiesSnapshot,
      jobsSnapshot,
      applicationsSnapshot,
      pendingInstitutionsSnapshot,
      pendingCompaniesSnapshot
    ] = await Promise.all([
      db.collection('students').get(),
      db.collection('institutions').where('status', '==', 'approved').get(),
      db.collection('companies').where('status', '==', 'approved').get(),
      db.collection('jobs').where('status', '==', 'active').get(),
      db.collection('applications').get(),
      db.collection('institutions').where('status', '==', 'pending').get(),
      db.collection('companies').where('status', '==', 'pending').get()
    ]);

    const stats = {
      totalStudents: studentsSnapshot.size,
      totalInstitutions: institutionsSnapshot.size,
      totalCompanies: companiesSnapshot.size,
      activeJobs: jobsSnapshot.size,
      totalApplications: applicationsSnapshot.size,
      pendingInstitutions: pendingInstitutionsSnapshot.size,
      pendingCompanies: pendingCompaniesSnapshot.size
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Get system stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Manage institutions
const getInstitutions = async (req, res) => {
  try {
    const { status } = req.query;

    let query = db.collection('institutions');
    if (status) {
      query = query.where('status', '==', status);
    }

    const institutionsSnapshot = await query.get();

    const institutions = [];
    institutionsSnapshot.forEach(doc => {
      institutions.push({ id: doc.id, ...doc.data() });
    });

    res.json({
      success: true,
      institutions
    });

  } catch (error) {
    console.error('❌ Get institutions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const createInstitution = async (req, res) => {
  try {
    const institutionData = req.body;

    if (!institutionData.name || !institutionData.email) {
      return res.status(400).json({
        success: false,
        error: 'Institution name and email are required'
      });
    }

    // Check if email already exists
    const existingInstitution = await db.collection('institutions')
      .where('email', '==', institutionData.email)
      .get();

    if (!existingInstitution.empty) {
      return res.status(400).json({
        success: false,
        error: 'Institution with this email already exists'
      });
    }

    // Create user account for institution
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: institutionData.email,
        password: institutionData.password || 'TempPassword123!',
        displayName: institutionData.name
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Error creating user account: ' + error.message
      });
    }

    const institution = {
      name: institutionData.name,
      email: institutionData.email,
      location: institutionData.location || '',
      type: institutionData.type || '',
      contactEmail: institutionData.contactEmail || institutionData.email,
      phone: institutionData.phone || '',
      status: 'approved',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create institution document
    await db.collection('institutions').doc(userRecord.uid).set(institution);

    // Create user document
    await db.collection('users').doc(userRecord.uid).set({
      email: institutionData.email,
      name: institutionData.name,
      role: 'institution',
      isVerified: true,
      status: 'active',
      createdAt: new Date()
    });

    console.log(`✅ Institution created: ${institutionData.name}`);

    res.status(201).json({
      success: true,
      message: 'Institution created successfully',
      institutionId: userRecord.uid
    });

  } catch (error) {
    console.error('❌ Create institution error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const updateInstitution = async (req, res) => {
  try {
    const { institutionId } = req.params;
    const updateData = req.body;

    const institutionRef = db.collection('institutions').doc(institutionId);
    const institutionDoc = await institutionRef.get();

    if (!institutionDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Institution not found'
      });
    }

    const allowedFields = ['name', 'location', 'type', 'contactEmail', 'phone'];
    const updates = {
      updatedAt: new Date()
    };

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    await institutionRef.update(updates);

    // Update user document if name changed
    if (updateData.name) {
      await db.collection('users').doc(institutionId).update({
        name: updateData.name,
        updatedAt: new Date()
      });
    }

    console.log(`✅ Institution updated: ${institutionId}`);

    res.json({
      success: true,
      message: 'Institution updated successfully'
    });

  } catch (error) {
    console.error('❌ Update institution error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const updateInstitutionStatus = async (req, res) => {
  try {
    const { institutionId } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'suspended', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    await db.collection('institutions').doc(institutionId).update({
      status,
      updatedAt: new Date()
    });

    // Keep user status in sync: suspended -> suspended, others -> active
    await db.collection('users').doc(institutionId).update({
      status: status === 'suspended' ? 'suspended' : 'active',
      updatedAt: new Date()
    });

    console.log(`✅ Institution status updated: ${institutionId} -> ${status}`);

    res.json({
      success: true,
      message: 'Institution status updated successfully'
    });

  } catch (error) {
    console.error('❌ Update institution status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const deleteInstitution = async (req, res) => {
  try {
    const { institutionId } = req.params;

    const institutionRef = db.collection('institutions').doc(institutionId);
    const institutionDoc = await institutionRef.get();

    if (!institutionDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Institution not found'
      });
    }

    // Delete institution document
    await institutionRef.delete();

    // Delete user document
    await db.collection('users').doc(institutionId).delete();

    // Delete user auth account
    try {
      await auth.deleteUser(institutionId);
    } catch (error) {
      console.warn('⚠️ Could not delete auth user:', error.message);
    }

    // Delete all courses for this institution
    const coursesSnapshot = await db.collection('courses')
      .where('institutionId', '==', institutionId)
      .get();
    
    const deletePromises = coursesSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);

    console.log(`✅ Institution deleted: ${institutionId}`);

    res.json({
      success: true,
      message: 'Institution deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete institution error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get courses for an institution
const getInstitutionCourses = async (req, res) => {
  try {
    const { institutionId } = req.params;

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
    console.error('❌ Get institution courses error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Add course for an institution
const addInstitutionCourse = async (req, res) => {
  try {
    const { institutionId } = req.params;
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

    console.log(`✅ Course added by admin: ${course.name}`);

    res.status(201).json({
      success: true,
      message: 'Course added successfully',
      courseId: docRef.id
    });

  } catch (error) {
    console.error('❌ Add institution course error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update course
const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const updateData = req.body;

    const courseRef = db.collection('courses').doc(courseId);
    const courseDoc = await courseRef.get();

    if (!courseDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    const allowedFields = ['name', 'faculty', 'description', 'duration', 'requirements', 'capacity', 'status'];
    const updates = {
      updatedAt: new Date()
    };

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    await courseRef.update(updates);

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

// Delete course
const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const courseRef = db.collection('courses').doc(courseId);
    const courseDoc = await courseRef.get();

    if (!courseDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    await courseRef.delete();

    console.log(`✅ Course deleted: ${courseId}`);

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

// Manage companies
const getCompanies = async (req, res) => {
  try {
    const { status } = req.query;

    let query = db.collection('companies');
    if (status) {
      query = query.where('status', '==', status);
    }

    const [companiesSnapshot, legacySnapshot] = await Promise.all([
      query.get(),
      status ? db.collection('companys').where('status', '==', status).get() : db.collection('companys').get()
    ]);

    const companyMap = new Map();
    companiesSnapshot.forEach(doc => companyMap.set(doc.id, { id: doc.id, ...doc.data() }));
    legacySnapshot.forEach(doc => {
      if (!companyMap.has(doc.id)) companyMap.set(doc.id, { id: doc.id, ...doc.data(), __source: 'companys' });
    });
    const companies = Array.from(companyMap.values());

    // Fallback: if still none, derive from users collection
    if (companies.length === 0 && !status) {
      const usersSnapshot = await db.collection('users').where('role', '==', 'company').get();
      usersSnapshot.forEach(doc => {
        const user = doc.data();
        companies.push({
          id: doc.id,
          email: user.email,
          name: user.name,
          status: user.status === 'active' ? 'approved' : (user.status || 'approved'),
          createdAt: user.createdAt
        });
      });
    }

    res.json({
      success: true,
      companies
    });

  } catch (error) {
    console.error('❌ Get companies error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const updateCompanyStatus = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'suspended', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    await db.collection('companies').doc(companyId).update({
      status,
      updatedAt: new Date()
    });

    // Keep user status in sync: suspended -> suspended, others -> active
    await db.collection('users').doc(companyId).update({
      status: status === 'suspended' ? 'suspended' : 'active',
      updatedAt: new Date()
    });

    console.log(`✅ Company status updated: ${companyId} -> ${status}`);

    res.json({
      success: true,
      message: 'Company status updated successfully'
    });

  } catch (error) {
    console.error('❌ Update company status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const deleteCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const companyRef = db.collection('companies').doc(companyId);
    const companyDoc = await companyRef.get();

    if (!companyDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Delete company document
    await companyRef.delete();

    // Delete user document
    await db.collection('users').doc(companyId).delete();

    // Delete user auth account
    try {
      await auth.deleteUser(companyId);
    } catch (error) {
      console.warn('⚠️ Could not delete auth user:', error.message);
    }

    // Delete all jobs for this company
    const jobsSnapshot = await db.collection('jobs')
      .where('companyId', '==', companyId)
      .get();
    
    const deletePromises = jobsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);

    console.log(`✅ Company deleted: ${companyId}`);

    res.json({
      success: true,
      message: 'Company deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete company error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get all users
const getUsers = async (req, res) => {
  try {
    const { role } = req.query;

    let query = db.collection('users');
    if (role) {
      query = query.where('role', '==', role);
    }

    const usersSnapshot = await query.get();

    const users = [];
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      users.push({
        id: doc.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        status: user.status,
        createdAt: user.createdAt
      });
    });

    res.json({
      success: true,
      users
    });

  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Publish admissions (open/close admission periods)
const publishAdmissions = async (req, res) => {
  try {
    const { action, institutionId } = req.body;

    if (!['open', 'close'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Action must be "open" or "close"'
      });
    }

    if (institutionId) {
      // Update specific institution
      await db.collection('institutions').doc(institutionId).update({
        admissionsOpen: action === 'open',
        updatedAt: new Date()
      });
      console.log(`✅ Admissions ${action} for institution: ${institutionId}`);
    } else {
      // Update all institutions
      const institutionsSnapshot = await db.collection('institutions').get();
      const updatePromises = institutionsSnapshot.docs.map(doc => 
        doc.ref.update({
          admissionsOpen: action === 'open',
          updatedAt: new Date()
        })
      );
      await Promise.all(updatePromises);
      console.log(`✅ Admissions ${action} for all institutions`);
    }

    res.json({
      success: true,
      message: `Admissions ${action === 'open' ? 'opened' : 'closed'} successfully`
    });

  } catch (error) {
    console.error('❌ Publish admissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
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
};