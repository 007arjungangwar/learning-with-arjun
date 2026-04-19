// auth-check.js - Complete working authentication

// Get current user from session
function getCurrentUser() {
    const user = sessionStorage.getItem('currentUser');
    if(user) {
        return JSON.parse(user);
    }
    return null;
}

// Check if logged in
function isLoggedIn() {
    return getCurrentUser() !== null;
}

// Check if admin
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

// Get user avatar
function getUserAvatar() {
    const user = getCurrentUser();
    if(!user) return '👤';
    const savedAvatar = localStorage.getItem(`avatar_${user.id}`);
    return savedAvatar || '🧑‍🎓';
}

// Logout function
function logout() {
    if(confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

// Create profile circle
function createProfileCircle() {
    const user = getCurrentUser();
    
    const existingCircle = document.querySelector('.user-profile-circle');
    if(existingCircle) existingCircle.remove();
    
    if(user) {
        const circleHTML = `
            <div class="user-profile-circle">
                <div class="profile-circle" onclick="toggleDropdown()">
                    ${getUserAvatar()}
                </div>
                <div class="user-dropdown" id="userDropdown">
                    <div class="dropdown-header">
                        <div class="dropdown-avatar">${getUserAvatar()}</div>
                        <div class="dropdown-name">${user.name}</div>
                        <div class="dropdown-email">${user.email}</div>
                    </div>
                    <div class="dropdown-divider"></div>
                    <a href="profile.html" class="dropdown-item">👤 My Profile</a>
                    <a href="tracker.html" class="dropdown-item">📊 My Progress</a>
                    <a href="certificate.html" class="dropdown-item">🎓 My Certificates</a>
                    <div class="dropdown-divider"></div>
                    ${user.role === 'admin' ? `
                        <a href="admin.html" class="dropdown-item">📊 Admin Dashboard</a>
                        <div class="dropdown-divider"></div>
                    ` : ''}
                    <div class="dropdown-item logout" onclick="logout()">🚪 Logout</div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', circleHTML);
    }
}

// Toggle dropdown
function toggleDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if(dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const circle = document.querySelector('.user-profile-circle');
    const dropdown = document.getElementById('userDropdown');
    if(circle && dropdown && !circle.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

// Update UI
function updateUIForUser() {
    const user = getCurrentUser();
    
    // Remove old login link if exists
    const oldLoginLink = document.querySelector('a[href="login.html"]');
    const navLinks = document.querySelector('.nav-links');
    
    if(user) {
        if(oldLoginLink) oldLoginLink.remove();
        createProfileCircle();
    } else {
        if(oldLoginLink) return;
        if(navLinks && !document.querySelector('a[href="login.html"]')) {
            const loginLink = document.createElement('a');
            loginLink.href = 'login.html';
            loginLink.innerHTML = '🔐 Login';
            navLinks.appendChild(loginLink);
        }
    }
    
    // Update welcome message
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

// Check page access
function checkPageAccess() {
    const user = getCurrentUser();
    const currentPage = window.location.pathname.split('/').pop();
    
    const publicPages = ['index.html', 'login.html', 'about.html', 'blog.html', 'projects.html'];
    const loginRequiredPages = ['courses.html', 'forum.html', 'resources.html', 'quiz.html', 
                                 'certificate.html', 'assistant.html', 'tracker.html', 
                                 'videos.html', 'roadmap.html', 'profile.html', 'chat.html'];
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
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }
    
    return true;
}

// Add styles
const authStyles = document.createElement('style');
authStyles.textContent = `
    .user-profile-circle {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1001;
        cursor: pointer;
    }
    
    .profile-circle {
        width: 45px;
        height: 45px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        color: white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        transition: transform 0.3s;
    }
    
    .profile-circle:hover {
        transform: scale(1.1);
    }
    
    .user-dropdown {
        position: absolute;
        top: 55px;
        right: 0;
        background: white;
        border-radius: 12px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.15);
        min-width: 250px;
        display: none;
        z-index: 1002;
        overflow: hidden;
    }
    
    .user-dropdown.show {
        display: block;
        animation: fadeIn 0.2s ease;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .dropdown-header {
        padding: 1rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-align: center;
    }
    
    .dropdown-avatar {
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
    }
    
    .dropdown-name {
        font-weight: bold;
        margin-bottom: 0.25rem;
    }
    
    .dropdown-email {
        font-size: 0.75rem;
        opacity: 0.9;
        word-break: break-all;
    }
    
    .dropdown-divider {
        height: 1px;
        background: #eaeaea;
        margin: 0.5rem 0;
    }
    
    .dropdown-item {
        padding: 0.75rem 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        text-decoration: none;
        color: #333;
        transition: background 0.2s;
    }
    
    .dropdown-item:hover {
        background: #f5f7fa;
    }
    
    .dropdown-item.logout {
        color: #ff4444;
        border-top: 1px solid #eaeaea;
        cursor: pointer;
    }
    
    @media (max-width: 768px) {
        .user-profile-circle {
            top: 10px;
            right: 10px;
        }
        .profile-circle {
            width: 35px;
            height: 35px;
            font-size: 1rem;
        }
    }
`;

document.head.appendChild(authStyles);

// Run checks
checkPageAccess();
updateUIForUser();

console.log("Auth system loaded. User:", getCurrentUser());