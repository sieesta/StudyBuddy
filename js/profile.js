// js/profile.js
import { supabase } from './supabase.js';

// Detect if running on GitHub Pages and get the correct base path
function getRedirectPath(page) {
    const pathname = window.location.pathname;
    // Check if running on GitHub Pages (/StudyBuddy/)
    if (pathname.includes('/StudyBuddy/')) {
        return '/StudyBuddy/' + page;
    }
    // Local development or other deployment
    return '/' + page;
}

const profileForm = document.getElementById('profile-form');
const usernameInput = document.getElementById('username');
const courseInput = document.getElementById('course');
const subjectsInput = document.getElementById('subjects');
const bioInput = document.getElementById('bio');
const avatarContainer = document.getElementById('avatar-container');
const avatarUpload = document.getElementById('avatar-upload');
const changeAvatarBtn = document.getElementById('change-avatar-btn');
const profileContainer = document.querySelector('.profile-container');
const profileSkeleton = document.getElementById('profile-loading-skeleton');
const statGroups = document.getElementById('stat-groups');
const statMessages = document.getElementById('stat-messages');
const statBuddies = document.getElementById('stat-buddies');
const statHours = document.getElementById('stat-hours');

let userId;
let currentAvatarUrl = null;

function setProfileLoading(isLoading) {
    if (profileContainer) {
        profileContainer.classList.toggle('is-loading', isLoading);
    }

    if (profileSkeleton) {
        profileSkeleton.style.display = isLoading ? 'grid' : 'none';
    }
}

async function loadProfileStats(currentUserId) {
    try {
        const { data: createdGroups } = await supabase
            .from('groups')
            .select('id')
            .eq('created_by', currentUserId);

        const { data: sentMessages } = await supabase
            .from('messages')
            .select('id, group_id, user_id')
            .eq('user_id', currentUserId);

        const groupIds = Array.from(new Set((sentMessages || []).map(message => message.group_id).filter(Boolean)));
        const partnerIds = new Set();

        if (groupIds.length) {
            const { data: groupMessages } = await supabase
                .from('messages')
                .select('user_id, group_id')
                .in('group_id', groupIds);

            (groupMessages || []).forEach((message) => {
                if (message.user_id && message.user_id !== currentUserId) {
                    partnerIds.add(message.user_id);
                }
            });
        }

        if (statGroups) statGroups.textContent = String((createdGroups || []).length);
        if (statMessages) statMessages.textContent = String((sentMessages || []).length);
        if (statBuddies) statBuddies.textContent = String(partnerIds.size);
        if (statHours) statHours.textContent = String(Math.max(1, Math.round(((sentMessages || []).length || 0) / 10)));
    } catch (error) {
        console.warn('Error loading profile stats:', error);
    }
}

// Load user profile data
async function loadProfile() {
    setProfileLoading(true);
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
        setProfileLoading(false);
        return;
    }

    if (profile) {
        usernameInput.value = profile.username || '';
        courseInput.value = profile.course || '';
        subjectsInput.value = profile.subjects ? profile.subjects.join(', ') : '';
        bioInput.value = profile.bio || '';
        currentAvatarUrl = profile.avatar_url;
        displayAvatar(profile.username, profile.avatar_url);
        await loadProfileStats(userId);
    }

    setProfileLoading(false);
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
