// auth-check.js - Include this on EVERY page

// Check if user is logged in
function checkAuth() {
    const currentUser = sessionStorage.getItem('currentUser');
    const publicPages = ['index.html', 'login.html', 'about.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    // Public pages - anyone can access
    if(publicPages.includes(currentPage)) {
        return true;
    }
    
    // Check if logged in
    if(!currentUser) {
        // Redirect to login
        window.location.href = 'login.html';
        return false;
    }
    
    const user = JSON.parse(currentUser);
    
    // Admin pages - only admin can access
    const adminPages = ['admin.html', 'admin-dashboard.html'];
    if(adminPages.includes(currentPage) && user.role !== 'admin') {
        alert('Access denied. Admin only area.');
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}

// Get current user info
function getCurrentUser() {
    const user = sessionStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
}

// Check if user is admin
function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}

// Logout function
function logout() {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

// Update UI based on login status
function updateUIForUser() {
    const user = getCurrentUser();
    const navLinks = document.querySelector('.nav-links');
    
    if(user) {
        // User is logged in
        if(navLinks && !document.querySelector('.user-menu')) {
            const userMenu = document.createElement('div');
            userMenu.className = 'user-menu';
            userMenu.innerHTML = `
                <span class="user-name">👋 ${user.name}</span>
                <button onclick="logout()" class="logout-btn">Logout</button>
            `;
            navLinks.appendChild(userMenu);
        }
        
        // Show admin link if admin
        if(isAdmin() && navLinks && !document.querySelector('a[href="admin.html"]')) {
            const adminLink = document.createElement('a');
            adminLink.href = 'admin.html';
            adminLink.innerHTML = '📊 Admin';
            navLinks.insertBefore(adminLink, navLinks.children[navLinks.children.length - 1]);
        }
    } else {
        // User not logged in - show login link
        if(navLinks && !document.querySelector('a[href="login.html"]')) {
            const loginLink = document.createElement('a');
            loginLink.href = 'login.html';
            loginLink.innerHTML = '🔐 Login';
            navLinks.appendChild(loginLink);
        }
    }
}

// Add these styles
const style = document.createElement('style');
style.textContent = `
    .user-menu {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        margin-left: 1rem;
    }
    
    .user-name {
        color: #0066cc;
        font-weight: bold;
    }
    
    .logout-btn {
        background: none;
        border: none;
        color: #ff4444;
        cursor: pointer;
        font-size: 0.875rem;
    }
    
    .logout-btn:hover {
        text-decoration: underline;
    }
    
    /* Restricted content */
    .restricted-content {
        position: relative;
    }
    
    .login-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
    }
    
    .login-message {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        text-align: center;
    }
`;

document.head.appendChild(style);

// Run auth check on page load
checkAuth();
updateUIForUser();