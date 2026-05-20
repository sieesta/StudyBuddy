// js/auth.js
import { supabase } from './supabase.js';

const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

showSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
});

showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
});

loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        alert(`Error logging in: ${error.message}`);
    } else {
        window.location.href = 'dashboard.html';
    }
});

signupBtn.addEventListener('click', async () => {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const username = document.getElementById('signup-username').value;

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: username,
            }
        }
    });

    if (authError) {
        alert(`Error signing up: ${authError.message}`);
    } else if (authData.user) {
         // Now create a profile entry
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([
                { id: authData.user.id, username: username }
            ]);

        if (profileError) {
            alert(`Error creating profile: ${profileError.message}`);
        } else {
            alert('Signup successful! Please check your email to verify.');
            window.location.href = 'dashboard.html';
        }
    }
});
