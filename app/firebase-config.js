export const firebaseConfig = {
  apiKey: 'AIzaSyA_i-ZwXm_k2go9pB-P0EMiifNs7QRbJLg',
  authDomain: 'gitarist-fa850.firebaseapp.com',
  projectId: 'gitarist-fa850',
  storageBucket: 'gitarist-fa850.firebasestorage.app',
  messagingSenderId: '759075803451',
  appId: '1:759075803451:web:8af8d8349a4e35888f271e',
  measurementId: 'G-J2JXB4G36R',
  // Optional: set this after registering App Check for the GitHub Pages domain.
  appCheckSiteKey: ''
};

export const isClassroomConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain
  && firebaseConfig.projectId && firebaseConfig.appId);

