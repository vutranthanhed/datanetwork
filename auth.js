// Authentication Functions

// Track current user
let currentUser = null;

// Monitor authentication state
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        currentUser = user;
        console.log("User logged in:", user.email);
        showDashboard();
        loadUserData();
    } else {
        // User is signed out
        currentUser = null;
        console.log("User logged out");
        showLandingPage();
    }
});

// Show/Hide UI based on auth state
function showDashboard() {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('auth-buttons').style.display = 'none';
    document.getElementById('user-menu').style.display = 'flex';
    document.getElementById('user-email').textContent = currentUser.email;
}

function showLandingPage() {
    document.getElementById('landing-page').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('auth-buttons').style.display = 'flex';
    document.getElementById('user-menu').style.display = 'none';
}

// Modal Controls
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    // Clear error messages
    const errorDiv = document.querySelector(`#${modalId} .error-message`);
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }
}

function showLogin() {
    showModal('login-modal');
}

function showSignup() {
    showModal('signup-modal');
}

function switchToSignup() {
    closeModal('login-modal');
    showModal('signup-modal');
}

function switchToLogin() {
    closeModal('signup-modal');
    showModal('login-modal');
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Handle Login Form
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        closeModal('login-modal');
        document.getElementById('login-form').reset();
    } catch (error) {
        console.error("Login error:", error);
        errorDiv.textContent = getErrorMessage(error.code);
        errorDiv.style.display = 'block';
    }
});

// Handle Signup Form
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;
    const errorDiv = document.getElementById('signup-error');
    
    // Validate passwords match
    if (password !== passwordConfirm) {
        errorDiv.textContent = "Passwords don't match!";
        errorDiv.style.display = 'block';
        return;
    }
    
    // Validate password length
    if (password.length < 6) {
        errorDiv.textContent = "Password must be at least 6 characters!";
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        // Create user account
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Create user document in Firestore
        await db.collection('users').doc(user.uid).set({
            email: user.email,
            points: 0,
            balance: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            requestsMade: 0,
            requestsFulfilled: 0,
            disputesAgainst: 0,
            disputesWon: 0,
            reputationScore: 100
        });
        
        console.log("User account created!");
        closeModal('signup-modal');
        document.getElementById('signup-form').reset();
    } catch (error) {
        console.error("Signup error:", error);
        errorDiv.textContent = getErrorMessage(error.code);
        errorDiv.style.display = 'block';
    }
});

// Handle Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        await auth.signOut();
        console.log("User logged out");
    } catch (error) {
        console.error("Logout error:", error);
    }
});

// User-friendly error messages
function getErrorMessage(errorCode) {
    const errors = {
        'auth/email-already-in-use': 'This email is already registered. Try logging in instead.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Check your internet connection.'
    };
    
    return errors[errorCode] || 'An error occurred. Please try again.';
}

// Load user data from Firestore
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // Update UI with user stats
            document.getElementById('user-balance').textContent = `${userData.balance} pts`;
            document.getElementById('stat-balance').textContent = userData.balance;
            document.getElementById('stat-earned').textContent = userData.points;
            document.getElementById('stat-requests').textContent = userData.requestsMade;
            document.getElementById('stat-fulfilled').textContent = userData.requestsFulfilled;
            
            // Update last active timestamp
            await db.collection('users').doc(currentUser.uid).update({
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        console.error("Error loading user data:", error);
    }
}