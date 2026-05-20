// js/main.js
import { supabase } from './supabase.js';

// Check authentication status
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Redirect unauthenticated users to login (except on index.html)
    if (!user && !window.location.pathname.includes('index.html')) {
        window.location.href = 'index.html';
        return;
    }
    
    // Redirect authenticated users away from index.html
    if (user && window.location.pathname.includes('index.html')) {
        window.location.href = 'dashboard.html';
        return;
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
            window.location.href = 'index.html';
        });
    }
});
