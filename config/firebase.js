'use strict';

const admin = require('firebase-admin');

let firebaseApp;

if (!admin.apps.length) {
    try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
            console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not found in environment. Push notifications will be disabled.');
            return;
        }
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase Admin initialized successfully');
    } catch (error) {
        console.error('❌ Firebase Admin initialization error:', error.message);
    }
} else {
    firebaseApp = admin.app();
}

module.exports = admin;
