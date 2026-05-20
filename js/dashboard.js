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

// Fetch and display all users
async function fetchUsers(userList) {
    try {
        const { data: profiles, error } = await supabase.from('profiles').select('*');
        if (error) {
            console.error('Error fetching users:', error);
            userList.innerHTML = `<p style="color: red;">Error loading users: ${error.message}</p>`;
            return;
        }
        
        console.log('Users fetched:', profiles?.length);
        displayUsers(profiles, userList);
    } catch (err) {
        console.error('Exception fetching users:', err);
        userList.innerHTML = `<p style="color: red;">Exception: ${err.message}</p>`;
    }
}

// Fetch and display all groups
async function fetchGroups(groupList) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Current user:', user?.id);
        
        const { data: groups, error } = await supabase.from('groups').select('*');
        if (error) {
            console.error('Error fetching groups:', error);
            groupList.innerHTML = `<p style="color: red;">Error loading groups: ${error.message}</p>`;
            return;
        }
        
        console.log('Groups fetched:', groups?.length);
        
        if (!groups || groups.length === 0) {
            groupList.innerHTML = '<p>No groups found. Create one to get started!</p>';
            return;
        }
        
        displayGroups(groups, groupList);
    } catch (err) {
        console.error('Exception fetching groups:', err);
        groupList.innerHTML = `<p style="color: red;">Exception: ${err.message}</p>`;
    }
}

function displayUsers(users, userList) {
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

function displayGroups(groups, groupList) {
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

async function performSearch(searchInput, userList) {
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (!searchTerm) {
        await fetchUsers(userList);
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
            displayUsers(profiles, userList);
        }
    } catch (err) {
        console.error('Exception searching users:', err);
        userList.innerHTML = `<p style="color: red;">Exception: ${err.message}</p>`;
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard DOM loaded, initializing...');
    
    // Get all elements
    const userList = document.getElementById('user-list');
    const groupList = document.getElementById('group-list');
    const searchInput = document.getElementById('search-input');
    const matchBuddyBtn = document.getElementById('match-buddy-btn');
    const createGroupForm = document.getElementById('createGroupForm');
    const groupNameInput = document.getElementById('group-name');
    const groupSubjectInput = document.getElementById('group-subject');

    if (!userList || !groupList) {
        console.error('Critical elements not found');
        return;
    }

    console.log('All elements found, setting up event listeners');

    // Setup search functionality
    if (matchBuddyBtn) {
        matchBuddyBtn.addEventListener('click', () => performSearch(searchInput, userList));
        console.log('Search button listener added');
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch(searchInput, userList);
            }
        });
        console.log('Search input listener added');
    }

    // Setup create group functionality
    if (createGroupForm) {
        createGroupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Create group form submitted');
            
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
                    await fetchGroups(groupList);
                }
            } catch (err) {
                alert(`Unexpected error: ${err.message}`);
                console.error('Exception creating group:', err);
            }
        });
        console.log('Create group form listener added');
    } else {
        console.error('Create group form not found');
    }

    // Load initial data
    async function initializeDashboard() {
        console.log('Initializing dashboard data load...');
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            console.log('User authenticated:', !!user);
            
            if (!user) {
                console.error('No user found, not loading dashboard');
                userList.innerHTML = '<p>Please log in to view the dashboard.</p>';
                groupList.innerHTML = '<p>Please log in to view groups.</p>';
                return;
            }
            
            await fetchUsers(userList);
            await fetchGroups(groupList);
        } catch (err) {
            console.error('Error initializing dashboard:', err);
        }
    }

    // Load data
    initializeDashboard();
});
