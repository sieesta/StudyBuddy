// js/main.js
import { supabase } from './supabase.js';

// Redirect to login if not authenticated
const user = await supabase.auth.getUser();
if (!user.data.user && !window.location.pathname.endsWith('index.html')) {
    window.location.href = 'index.html';
}

// Dark Mode Toggle
const darkModeToggle = document.getElementById('dark-mode-toggle');
darkModeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        darkModeToggle.textContent = '🌙';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        darkModeToggle.textContent = '☀️';
    }
});

// Set initial theme
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
    darkModeToggle.textContent = '☀️';
}


// Logout Button
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });
}
