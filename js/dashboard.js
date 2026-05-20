// js/dashboard.js
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

const userList = document.getElementById('user-list');
const groupList = document.getElementById('group-list');
const searchInput = document.getElementById('search-input');
const matchBuddyBtn = document.getElementById('match-buddy-btn');
const createGroupForm = document.getElementById('createGroupForm');
const groupNameInput = document.getElementById('group-name');
const groupSubjectInput = document.getElementById('group-subject');

// Fetch and display all users initially
async function fetchUsers() {
    try {
        const { data: profiles, error } = await supabase.from('profiles').select('*');
        if (error) {
            console.error('Error fetching users:', error);
            userList.innerHTML = `<p style="color: red;">Error loading users: ${error.message}</p>`;
            return;
        }
        
        console.log('Users fetched:', profiles?.length, profiles);
        displayUsers(profiles);
    } catch (err) {
        console.error('Exception fetching users:', err);
        userList.innerHTML = `<p style="color: red;">Exception: ${err.message}</p>`;
    }
}

// Fetch and display all groups
async function fetchGroups() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Current user:', user?.id);
        
        const { data: groups, error } = await supabase.from('groups').select('*');
        if (error) {
            console.error('Error fetching groups:', error);
            groupList.innerHTML = `<p style="color: red;">Error loading groups: ${error.message}</p>`;
            return;
        }
        
        console.log('Groups fetched:', groups?.length, groups);
        
        if (!groups || groups.length === 0) {
            groupList.innerHTML = '<p>No groups found. Create one to get started!</p>';
            return;
        }
        
        displayGroups(groups);
    } catch (err) {
        console.error('Exception fetching groups:', err);
        groupList.innerHTML = `<p style="color: red;">Exception: ${err.message}</p>`;
    }
}

function displayUsers(users) {
    userList.innerHTML = '';
    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.classList.add('user-card');
        userCard.innerHTML = `
            <h3>${user.username}</h3>
            <p><strong>Course:</strong> ${user.course || 'Not set'}</p>
            <p><strong>Subjects:</strong> ${user.subjects || 'Not set'}</p>
        `;
        userList.appendChild(userCard);
    });
}

function displayGroups(groups) {
    groupList.innerHTML = '';
    groups.forEach(group => {
        const groupCard = document.createElement('div');
        groupCard.classList.add('group-card');
        groupCard.innerHTML = `
            <h3>${group.name}</h3>
            <p><strong>Subject:</strong> ${group.subject}</p>
            <button data-group-id="${group.id}" class="join-group-btn">Join Chat</button>
        `;
        groupList.appendChild(groupCard);
    });

    document.querySelectorAll('.join-group-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const groupId = e.target.dataset.groupId;
            window.location.href = getRedirectPath(`chatroom.html?group_id=${groupId}`);
        });
    });
}

// Search functionality
if (matchBuddyBtn) {
    matchBuddyBtn.addEventListener('click', performSearch);
}

if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

async function performSearch() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (!searchTerm) {
        await fetchUsers();
        return;
    }

    try {
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`subjects.ilike.%${searchTerm}%,course.ilike.%${searchTerm}%`);

        if (error) {
            console.error('Error searching users:', error);
            userList.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        } else {
            displayUsers(profiles);
        }
    } catch (err) {
        console.error('Exception searching users:', err);
        userList.innerHTML = `<p style="color: red;">Exception: ${err.message}</p>`;
    }
}

// Create group functionality
if (createGroupForm) {
    createGroupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const groupName = groupNameInput.value.trim();
        const groupSubject = groupSubjectInput.value.trim();
        
        if (!groupName || !groupSubject) {
            alert('Please fill in all fields');
            return;
        }
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                alert('You must be logged in to create a group');
                return;
            }

            const { data, error } = await supabase
                .from('groups')
                .insert([{ name: groupName, subject: groupSubject, created_by: user.id }])
                .select();

            if (error) {
                alert(`Error creating group: ${error.message}`);
                console.error('Create group error:', error);
            } else {
                console.log('Group created:', data);
                groupNameInput.value = '';
                groupSubjectInput.value = '';
                alert('Group created successfully!');
                await fetchGroups(); // Refresh the list
            }
        } catch (err) {
            alert(`Unexpected error: ${err.message}`);
            console.error('Exception creating group:', err);
        }
    });
}


// Initial data load
async function initializeDashboard() {
    console.log('Initializing dashboard...');
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('User authenticated:', !!user);
        
        if (!user) {
            console.error('No user found, not loading groups');
            return;
        }
        
        await fetchUsers();
        await fetchGroups();
    } catch (err) {
        console.error('Error initializing dashboard:', err);
    }
}

// Call initialization when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard DOM loaded');
    initializeDashboard();
});
