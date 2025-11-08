const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: "career-platform-lesotho",
  private_key_id: "9822890b3ba2eaebe2ec78de2ca8d3b33095acf6",
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: "firebase-adminsdk-fbsvc@career-platform-lesotho.iam.gserviceaccount.com",
  client_id: "115604293203188174770",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40career-platform-lesotho.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

// Initialize Firebase Admin only if it hasn't been initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();

// Test database connection
const testConnection = async () => {
  try {
    await db.collection('test').doc('connection').set({
      test: true,
      timestamp: new Date()
    });
    console.log('✅ Firebase Firestore connection successful');
  } catch (error) {
    console.error('❌ Firebase Firestore connection failed:', error);
  }
};

testConnection();

module.exports = { admin, db, auth };