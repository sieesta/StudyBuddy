// js/main.js
import { supabase } from './supabase.js';

// Get base path for GitHub Pages
function getRedirectPath(page) {
    const basePath = new URL(document.baseURI).pathname;
    return basePath + page;
}

// Check authentication status
async function checkAuth() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const currentPath = window.location.pathname;
        
        // Redirect unauthenticated users to login (except on index.html)
        if (!user && !currentPath.includes('index.html')) {
            console.log('No user detected, redirecting to login');
            window.location.href = getRedirectPath('index.html');
            return;
        }
        
        // Redirect authenticated users away from index.html
        if (user && currentPath.includes('index.html')) {
            console.log('User already authenticated, redirecting to dashboard');
            window.location.href = getRedirectPath('dashboard.html');
            return;
        }
    } catch (err) {
        console.error('Auth check error:', err);
    }
}

// Check auth on page load
checkAuth();

// Dark Mode Toggle
document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'light');
                darkModeToggle.textContent = '🌙';
                localStorage.setItem('theme', 'light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                darkModeToggle.textContent = '☀️';
                localStorage.setItem('theme', 'dark');
            }
        });
    }

    // Set initial theme from localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (darkModeToggle) {
            darkModeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        }
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (darkModeToggle) {
            darkModeToggle.textContent = '☀️';
        }
    }
});

// Logout Button
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = getRedirectPath('index.html');
        });
    }
});
