// Generate 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Calculate GPA from grades array (converts percentage 0-100 to 4.0 scale)
const calculateGPA = (grades) => {
  if (!grades || grades.length === 0) return 0;
  
  // Convert percentage grades (0-100) to 4.0 scale
  const total = grades.reduce((sum, grade) => {
    const percentage = grade.grade || 0;
    // Convert percentage to 4.0 scale: (percentage / 100) * 4
    const gpaValue = (percentage / 100) * 4;
    return sum + gpaValue;
  }, 0);
  
  return (total / grades.length).toFixed(2);
};

// Format date to YYYY-MM-DD
const formatDate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate random ID
const generateId = (prefix = '') => {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

// Validate course application data
const validateApplicationData = (applications) => {
  if (!Array.isArray(applications)) {
    return { valid: false, error: 'Applications must be an array' };
  }

  for (const app of applications) {
    if (!app.institutionId || !app.courseId) {
      return { valid: false, error: 'Each application must have institutionId and courseId' };
    }
  }

  return { valid: true };
};

// Check if student meets course requirements
const checkCourseRequirements = (student, course) => {
  if (!course.requirements) return { meets: true };
  
  const requirements = course.requirements;
  const results = {
    meets: true,
    failedRequirements: []
  };

  // Check minimum GPA
  if (requirements.minGPA && student.gpa < requirements.minGPA) {
    results.meets = false;
    results.failedRequirements.push(`Minimum GPA of ${requirements.minGPA} required`);
  }

  // Check required subjects
  if (requirements.requiredSubjects && Array.isArray(requirements.requiredSubjects)) {
    // This would need student's subject data to be implemented
  }

  return results;
};

// Convert Firestore document to plain object with dates as ISO strings
const convertFirestoreDoc = (doc) => {
  if (!doc) return null;
  
  const data = doc.data ? doc.data() : doc;
  const result = { ...data };
  
  // Convert all date fields to ISO strings
  for (const key in result) {
    const value = result[key];
    
    // Firestore Timestamp object
    if (value && typeof value === 'object' && (value.toDate || value._seconds !== undefined || value.seconds !== undefined)) {
      let date;
      if (value.toDate && typeof value.toDate === 'function') {
        date = value.toDate();
      } else if (value._seconds !== undefined) {
        date = new Date(value._seconds * 1000);
      } else if (value.seconds !== undefined) {
        date = new Date(value.seconds * 1000);
      }
      if (date && !isNaN(date.getTime())) {
        result[key] = date.toISOString();
      }
    }
    // Native Date object
    else if (value instanceof Date) {
      result[key] = value.toISOString();
    }
  }
  
  return result;
};

module.exports = {
  generateVerificationCode,
  calculateGPA,
  formatDate,
  validateEmail,
  generateId,
  validateApplicationData,
  checkCourseRequirements,
  convertFirestoreDoc
};