// js/auth.js
import { supabase } from './supabase.js';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is already logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        window.location.href = 'dashboard.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    // Handle form submission for login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value.trim();

            if (!email || !password) {
                alert('Please fill in all fields');
                return;
            }

            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) {
                    alert(`Error logging in: ${error.message}`);
                    console.error('Login error:', error);
                } else {
                    console.log('Login successful');
                    window.location.href = 'dashboard.html';
                }
            } catch (err) {
                alert(`Unexpected error: ${err.message}`);
                console.error('Auth error:', err);
            }
        });
    }

    // Handle form submission for signup
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value.trim();
            const username = document.getElementById('signup-username').value.trim();

            if (!email || !password || !username) {
                alert('Please fill in all fields');
                return;
            }

            try {
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
                    console.error('Signup error:', authError);
                } else if (authData.user) {
                    // Now create a profile entry
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert([
                            { id: authData.user.id, username: username }
                        ]);

                    if (profileError) {
                        console.error('Profile error:', profileError);
                        alert(`Error creating profile: ${profileError.message}`);
                    } else {
                        alert('Signup successful! Please check your email to verify your account.');
                        // Reset and show login form
                        signupForm.reset();
                        signupForm.style.display = 'none';
                        loginForm.style.display = 'block';
                    }
                }
            } catch (err) {
                alert(`Unexpected error: ${err.message}`);
                console.error('Signup error:', err);
            }
        });
    }
});
