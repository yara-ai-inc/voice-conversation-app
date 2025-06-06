import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User,
  signInWithCustomToken,
  signInAnonymously
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || '',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || ''
};

export class AuthService {
  private app: FirebaseApp;
  private auth: Auth;
  private googleProvider: GoogleAuthProvider;
  private currentUser: User | null = null;
  private authStateListeners: ((user: User | null) => void)[] = [];

  constructor() {
    this.app = initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.googleProvider = new GoogleAuthProvider();
    
    // Set up auth state listener
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      this.notifyAuthStateListeners(user);
    });
  }

  // Sign in with Google
  async signInWithGoogle(): Promise<User> {
    try {
      const result = await signInWithPopup(this.auth, this.googleProvider);
      return result.user;
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  }

  // Sign in with test token for development
  async signInWithTestToken(userId: string): Promise<User> {
    if (!this.isDevelopmentMode()) {
      throw new Error('Test tokens only available in development mode');
    }
    
    try {
      // For development, we'll sign in anonymously and then update the user ID
      const result = await signInAnonymously(this.auth);
      
      // Store the test user ID in local storage for the backend to recognize
      localStorage.setItem('test_user_id', userId);
      localStorage.setItem('test_token', `test_token_${userId}`);
      
      console.log('Test user signed in:', userId);
      return result.user;
    } catch (error) {
      console.error('Test token sign-in error:', error);
      throw error;
    }
  }

  // Get current authentication token
  async getAuthToken(): Promise<string | null> {
    if (!this.currentUser) {
      return null;
    }

    try {
      const token = await this.currentUser.getIdToken();
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // Subscribe to auth state changes
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.authStateListeners.push(callback);
    
    // Call immediately with current state
    callback(this.currentUser);
    
    // Return unsubscribe function
    return () => {
      this.authStateListeners = this.authStateListeners.filter(
        listener => listener !== callback
      );
    };
  }

  private notifyAuthStateListeners(user: User | null): void {
    this.authStateListeners.forEach(listener => listener(user));
  }

  // Helper method for development mode
  isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development' || 
           process.env.REACT_APP_USE_TEST_AUTH === 'true';
  }
}

// Export singleton instance
export const authService = new AuthService();