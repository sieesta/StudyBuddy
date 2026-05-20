// js/profile.js
import { supabase } from './supabase.js';

// Get base path for GitHub Pages
function getRedirectPath(page) {
    const basePath = new URL(document.baseURI).pathname;
    return basePath + page;
}

const profileForm = document.getElementById('profile-form');
const usernameInput = document.getElementById('username');
const courseInput = document.getElementById('course');
const subjectsInput = document.getElementById('subjects');
const bioInput = document.getElementById('bio');
const avatarContainer = document.getElementById('avatar-container');
const avatarUpload = document.getElementById('avatar-upload');
const changeAvatarBtn = document.getElementById('change-avatar-btn');

let userId;
let currentAvatarUrl = null;

// Load user profile data
async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = getRedirectPath('index.html');
        return;
    }
    userId = user.id;

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
        return;
    }

    if (profile) {
        usernameInput.value = profile.username || '';
        courseInput.value = profile.course || '';
        subjectsInput.value = profile.subjects ? profile.subjects.join(', ') : '';
        bioInput.value = profile.bio || '';
        currentAvatarUrl = profile.avatar_url;
        displayAvatar(profile.username, profile.avatar_url);
    }
}

function displayAvatar(username, avatarUrl) {
    avatarContainer.innerHTML = '';
    if (avatarUrl) {
        const img = document.createElement('img');
        img.src = avatarUrl;
        img.alt = username;
        avatarContainer.appendChild(img);
    } else {
        const initial = username ? username.charAt(0).toUpperCase() : '?';
        avatarContainer.textContent = initial;
    }
}

// Handle avatar upload
changeAvatarBtn.addEventListener('click', () => {
    avatarUpload.click();
});

avatarUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

    if (uploadError) {
        alert(`Error uploading avatar: ${uploadError.message}`);
        return;
    }

    // Get public URL
    const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

    // Update profile with new avatar URL
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date() })
        .eq('id', userId);

    if (updateError) {
        alert(`Error updating profile: ${updateError.message}`);
    } else {
        currentAvatarUrl = publicUrl;
        displayAvatar(usernameInput.value, publicUrl);
        alert('Avatar updated!');
    }
});

// Handle profile update
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const updates = {
        id: userId,
        username: usernameInput.value,
        course: courseInput.value,
        subjects: subjectsInput.value.split(',').map(s => s.trim()),
        bio: bioInput.value,
        updated_at: new Date()
    };

    const { error } = await supabase.from('profiles').upsert(updates);

    if (error) {
        alert(`Error updating profile: ${error.message}`);
    } else {
        alert('Profile updated successfully!');
    }
});

loadProfile();
