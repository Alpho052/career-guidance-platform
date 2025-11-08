const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, auth } = require('../config/firebase');
const { sendVerificationEmail } = require('../utils/emailService');
const { generateVerificationCode } = require('../utils/helpers');

// User registration
const register = async (req, res) => {
  try {
    const { email, password, name, role, additionalData } = req.body;

    console.log(`📝 Registration attempt: ${email} as ${role}`);

    // Check if user already exists
    const existingUser = await db.collection('users').where('email', '==', email).get();
    if (!existingUser.empty) {
      return res.status(400).json({ 
        success: false,
        error: 'User already exists with this email' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification code
    const verificationCode = generateVerificationCode();

    let userRecord;
    try {
      // Create user in Firebase Auth
      userRecord = await auth.createUser({
        email,
        password: hashedPassword,
        displayName: name,
        emailVerified: false
      });
    } catch (firebaseError) {
      console.error('❌ Firebase Auth creation error:', firebaseError);
      
      if (firebaseError.code === 'auth/email-already-exists') {
        return res.status(400).json({ 
          success: false,
          error: 'User already exists with this email' 
        });
      }
      
      throw firebaseError;
    }

    // Create user document in Firestore
    const userData = {
      uid: userRecord.uid,
      email,
      name,
      role,
      password: hashedPassword,
      isVerified: false,
      verificationCode,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      ...additionalData
    };

    await db.collection('users').doc(userRecord.uid).set(userData);

    // Create role-specific document (except for admin)
    if (role !== 'admin') {
      const roleData = {
        uid: userRecord.uid,
        email,
        name,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Immediately approve all roles
        status: 'approved',
        ...additionalData
      };

      const collectionName = role === 'company' ? 'companies' : `${role}s`;
      await db.collection(collectionName).doc(userRecord.uid).set(roleData);
    }

    // Send verification email (don't fail if email fails)
    let emailSent = false;
    try {
      emailSent = await sendVerificationEmail(email, verificationCode);
    } catch (emailError) {
      console.log('⚠️ Email sending failed, but registration continues');
      // Don't throw error - registration should succeed even if email fails
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: userRecord.uid, 
        role: role,
        email: email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✅ User registered successfully: ${email}`);
    console.log(`📧 Verification code: ${verificationCode}`);

    // AUTO-VERIFY FOR DEVELOPMENT - Remove this in production
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 DEVELOPMENT: Auto-verifying email...');
      await db.collection('users').doc(userRecord.uid).update({
        isVerified: true,
        verificationCode: null,
        updatedAt: new Date()
      });

      try {
        await auth.updateUser(userRecord.uid, {
          emailVerified: true
        });
      } catch (firebaseError) {
        console.error('⚠️ Could not update Firebase Auth email status:', firebaseError);
      }
    }

    res.status(201).json({
      success: true,
      message: process.env.NODE_ENV === 'development' 
        ? 'User registered successfully! Email auto-verified in development mode.' 
        : 'User registered successfully. Please verify your email.',
      token,
      user: {
        id: userRecord.uid,
        email,
        name,
        role,
        isVerified: process.env.NODE_ENV === 'development' ? true : false
      },
      verificationCode: verificationCode,
      emailSent
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Internal server error during registration';
    let statusCode = 500;

    if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
      statusCode = 400;
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak';
      statusCode = 400;
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMessage = 'Email/password accounts are not enabled';
      statusCode = 400;
    }

    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// User login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log(`🔐 Login attempt: ${email}`);

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required' 
      });
    }

    // Find user
    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    if (usersSnapshot.empty) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    const userDoc = usersSnapshot.docs[0];
    const user = userDoc.data();

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    // Check if email is verified - SKIP IN DEVELOPMENT
    if (!user.isVerified && process.env.NODE_ENV !== 'development') {
      return res.status(400).json({ 
        success: false,
        error: 'Please verify your email first',
        needsVerification: true,
        verificationCode: user.verificationCode
      });
    }

    // For development, auto-verify if not verified
    if (!user.isVerified && process.env.NODE_ENV === 'development') {
      console.log('🔄 DEVELOPMENT: Auto-verifying user for login...');
      await db.collection('users').doc(userDoc.id).update({
        isVerified: true,
        verificationCode: null,
        updatedAt: new Date()
      });
      user.isVerified = true;
    }

    // Ensure account is active based on role document (auto-heal user status)
    if (user.status !== 'active') {
      const collectionName = user.role === 'company' ? 'companies' : (user.role === 'institution' ? 'institutions' : null);
      if (collectionName) {
        const roleDoc = await db.collection(collectionName).doc(userDoc.id).get();
        const roleData = roleDoc.exists ? roleDoc.data() : {};
        // Block only suspended accounts; otherwise activate
        if (roleData.status === 'suspended') {
          return res.status(400).json({ 
            success: false,
            error: 'Account is not active. Please contact support.' 
          });
        }
        await db.collection('users').doc(userDoc.id).update({ status: 'active', updatedAt: new Date() });
        user.status = 'active';
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: userDoc.id, 
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✅ User logged in successfully: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: userDoc.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error during login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verify email
const verifyEmail = async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    console.log(`📧 Email verification attempt: ${email}`);

    if (!email || !verificationCode) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and verification code are required' 
      });
    }

    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    if (usersSnapshot.empty) {
      return res.status(400).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const userDoc = usersSnapshot.docs[0];
    const user = userDoc.data();

    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid verification code' 
      });
    }

    // Update user as verified
    await db.collection('users').doc(userDoc.id).update({
      isVerified: true,
      verificationCode: null,
      updatedAt: new Date()
    });

    // Update Firebase Auth email verification status
    try {
      await auth.updateUser(user.uid, {
        emailVerified: true
      });
    } catch (firebaseError) {
      console.error('⚠️ Could not update Firebase Auth email status:', firebaseError);
      // Continue anyway - we've updated Firestore
    }

    console.log(`✅ Email verified successfully: ${email}`);

    res.json({ 
      success: true,
      message: 'Email verified successfully' 
    });

  } catch (error) {
    console.error('❌ Email verification error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error during email verification',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const user = userDoc.data();
    
    // Remove sensitive data
    const { password, verificationCode, ...userProfile } = user;

    res.json({
      success: true,
      user: userProfile
    });

  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Development endpoint to bypass email verification
const devVerify = async (req, res) => {
  try {
    const { email } = req.body;

    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    if (usersSnapshot.empty) {
      return res.status(400).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const userDoc = usersSnapshot.docs[0];
    const user = userDoc.data();

    await db.collection('users').doc(userDoc.id).update({
      isVerified: true,
      verificationCode: null,
      updatedAt: new Date()
    });

    // Update Firebase Auth if possible
    try {
      await auth.updateUser(user.uid, {
        emailVerified: true
      });
    } catch (firebaseError) {
      console.error('⚠️ Could not update Firebase Auth:', firebaseError);
    }

    console.log(`✅ Development verification for: ${email}`);

    res.json({ 
      success: true,
      message: 'Account verified in development mode' 
    });

  } catch (error) {
    console.error('❌ Dev verify error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
};

module.exports = { 
  register, 
  login, 
  verifyEmail, 
  getProfile,
  devVerify 
};