// auth-check.js - Complete authentication system

// Get current user from session
function getCurrentUser() {
    const user = sessionStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
}

// Check if user is logged in
function isLoggedIn() {
    return getCurrentUser() !== null;
}

// Check if user is admin
function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}

// Get user email
function getUserEmail() {
    const user = getCurrentUser();
    return user ? user.email : null;
}

// Get user name
function getUserName() {
    const user = getCurrentUser();
    return user ? user.name : null;
}

// Logout function
function logout() {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

// Update UI everywhere based on login status
function updateUIForUser() {
    const user = getCurrentUser();
    
    // Update navigation
    const navLinks = document.querySelector('.nav-links');
    if(navLinks) {
        // Remove existing user menu if any
        const existingMenu = document.querySelector('.user-menu');
        if(existingMenu) existingMenu.remove();
        
        if(user) {
            // Add user menu
            const userMenu = document.createElement('div');
            userMenu.className = 'user-menu';
            userMenu.innerHTML = `
                <span class="user-name">👋 ${user.name}</span>
                <span class="user-email">📧 ${user.email}</span>
                <button onclick="logout()" class="logout-btn">🚪 Logout</button>
            `;
            navLinks.appendChild(userMenu);
            
            // Add admin link if admin
            if(user.role === 'admin' && !document.querySelector('a[href="admin.html"]')) {
                const adminLink = document.createElement('a');
                adminLink.href = 'admin.html';
                adminLink.innerHTML = '📊 Admin';
                navLinks.insertBefore(adminLink, navLinks.children[navLinks.children.length - 1]);
            }
        } else {
            // Add login link
            if(!document.querySelector('a[href="login.html"]')) {
                const loginLink = document.createElement('a');
                loginLink.href = 'login.html';
                loginLink.innerHTML = '🔐 Login';
                navLinks.appendChild(loginLink);
            }
        }
    }
    
    // Update profile page if on profile page
    if(window.location.pathname.includes('profile.html') && user) {
        updateProfilePage(user);
    }
    
    // Update admin page if on admin page
    if(window.location.pathname.includes('admin.html') && user && user.role === 'admin') {
        updateAdminPage(user);
    }
    
    // Update welcome message on home page
    updateWelcomeMessage(user);
}

// Update profile page with user data
function updateProfilePage(user) {
    if(!user) return;
    
    // Update profile header
    const nameElement = document.getElementById('displayName');
    const emailElement = document.getElementById('userEmail');
    const avatarElement = document.getElementById('avatar');
    const joinDateElement = document.getElementById('joinDate');
    
    if(nameElement) nameElement.innerHTML = user.name;
    if(emailElement) emailElement.innerHTML = user.email;
    if(joinDateElement) {
        const userData = JSON.parse(localStorage.getItem('users')).find(u => u.id === user.id);
        if(userData && userData.joinDate) {
            joinDateElement.innerHTML = new Date(userData.joinDate).toLocaleDateString();
        }
    }
    
    // Load user-specific data
    loadUserStats(user);
}

// Load user statistics
function loadUserStats(user) {
    if(!user) return;
    
    // Study streak
    const streak = localStorage.getItem(`studyStreak_${user.id}`) || 0;
    const streakElement = document.getElementById('studyStreak');
    if(streakElement) streakElement.innerHTML = streak;
    
    // Courses completed
    const enrollments = JSON.parse(localStorage.getItem(`enrollments_${user.id}`) || '[]');
    const coursesElement = document.getElementById('coursesCompleted');
    if(coursesElement) coursesElement.innerHTML = enrollments.length;
    
    // Certificates earned
    const certificates = JSON.parse(localStorage.getItem(`certificates_${user.id}`) || '[]');
    const certElement = document.getElementById('certificatesEarned');
    if(certElement) certElement.innerHTML = certificates.length;
    
    // Forum posts
    const forumTopics = JSON.parse(localStorage.getItem('forumTopics') || '[]');
    const userPosts = forumTopics.filter(t => t.author === user.name || t.authorEmail === user.email);
    const postsElement = document.getElementById('forumPosts');
    if(postsElement) postsElement.innerHTML = userPosts.length;
}

// Update admin page with admin data
function updateAdminPage(user) {
    if(!user || user.role !== 'admin') return;
    
    const adminNameElement = document.getElementById('adminName');
    const adminEmailElement = document.getElementById('adminEmail');
    
    if(adminNameElement) adminNameElement.innerHTML = user.name;
    if(adminEmailElement) adminEmailElement.innerHTML = user.email;
}

// Update welcome message on home page
function updateWelcomeMessage(user) {
    const guestMsg = document.getElementById('guestMessage');
    const userMsg = document.getElementById('userMessage');
    const userNameSpan = document.getElementById('userName');
    
    if(guestMsg && userMsg) {
        if(user) {
            guestMsg.style.display = 'none';
            userMsg.style.display = 'block';
            if(userNameSpan) userNameSpan.innerHTML = user.name;
        } else {
            guestMsg.style.display = 'block';
            userMsg.style.display = 'none';
        }
    }
}

// Check page access based on authentication
function checkPageAccess() {
    const user = getCurrentUser();
    const currentPage = window.location.pathname.split('/').pop();
    
    // Public pages anyone can access
    const publicPages = ['index.html', 'login.html', 'about.html', 'blog.html', 'projects.html'];
    
    // Pages that require login
    const loginRequiredPages = ['courses.html', 'forum.html', 'resources.html', 'quiz.html', 
                                 'certificate.html', 'assistant.html', 'tracker.html', 
                                 'videos.html', 'roadmap.html', 'profile.html'];
    
    // Admin only pages
    const adminPages = ['admin.html'];
    
    if(publicPages.includes(currentPage)) {
        return true;
    }
    
    if(loginRequiredPages.includes(currentPage)) {
        if(!user) {
            alert('Please login to access this page!');
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }
    
    if(adminPages.includes(currentPage)) {
        if(!user || user.role !== 'admin') {
            alert('Access denied. Admin only area.');
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }
    
    return true;
}

// Add styles for user menu
const authStyles = document.createElement('style');
authStyles.textContent = `
    .user-menu {
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        margin-left: 1rem;
        padding-left: 1rem;
        border-left: 1px solid #eaeaea;
    }
    
    .user-name {
        font-weight: bold;
        color: #0066cc;
    }
    
    .user-email {
        font-size: 0.8rem;
        color: #666;
    }
    
    .logout-btn {
        background: #ff4444;
        color: white;
        border: none;
        padding: 0.25rem 0.75rem;
        border-radius: 5px;
        cursor: pointer;
        font-size: 0.8rem;
    }
    
    .logout-btn:hover {
        background: #cc0000;
    }
    
    @media (max-width: 768px) {
        .user-menu {
            flex-wrap: wrap;
            margin-top: 0.5rem;
        }
        .user-email {
            display: none;
        }
    }
`;

document.head.appendChild(authStyles);

// Run on page load
checkPageAccess();
updateUIForUser();