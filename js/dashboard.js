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

const dashboardState = {
    profiles: [],
    search: '',
    filter: 'all',
};

function normalizeSubjects(subjects) {
    if (Array.isArray(subjects)) {
        return subjects.filter(Boolean).map(subject => String(subject).trim()).filter(Boolean);
    }

    if (typeof subjects === 'string' && subjects.trim()) {
        return subjects.split(',').map(subject => subject.trim()).filter(Boolean);
    }

    return [];
}

function getUserAvatar(user) {
    const initials = user.username ? user.username.slice(0, 2).toUpperCase() : 'SB';
    if (user.avatar_url) {
        return `<img src="${user.avatar_url}" alt="${user.username || 'Student'}">`;
    }
    return `<span>${initials}</span>`;
}

function matchesDashboardFilter(user) {
    const subjects = normalizeSubjects(user.subjects).join(' ').toLowerCase();
    const course = String(user.course || '').toLowerCase();
    const username = String(user.username || '').toLowerCase();
    const search = dashboardState.search;
    const filter = dashboardState.filter;

    const matchesSearch = !search || [subjects, course, username].join(' ').includes(search);

    const filterMap = {
        all: true,
        mathematics: /math|algebra|calculus|geometry|statistics/.test(subjects),
        science: /science|biology|chemistry|physics/.test(subjects),
        language: /english|literature|language|writing/.test(subjects),
        engineering: /engineering|coding|programming|computer/.test(subjects),
    };

    return matchesSearch && (filterMap[filter] ?? true);
}

function showDashboardLoading() {
    const loadingSkeletons = document.getElementById('loadingSkeletons');
    const userList = document.getElementById('user-list');
    const groupList = document.getElementById('group-list');
    if (loadingSkeletons) loadingSkeletons.style.display = 'block';
    if (userList) userList.style.display = 'none';
    if (groupList) groupList.style.opacity = '0.6';
}

function hideDashboardLoading() {
    const loadingSkeletons = document.getElementById('loadingSkeletons');
    const userList = document.getElementById('user-list');
    const groupList = document.getElementById('group-list');
    if (loadingSkeletons) loadingSkeletons.style.display = 'none';
    if (userList) userList.style.display = 'grid';
    if (groupList) groupList.style.opacity = '1';
}

// Fetch and display all users
async function fetchUsers() {
    try {
        const { data: profiles, error } = await supabase.from('profiles').select('*');
        if (error) {
            console.error('Error fetching users:', error);
            dashboardState.profiles = [];
            return;
        }
        
        dashboardState.profiles = Array.isArray(profiles) ? profiles : [];
        console.log('Users fetched:', dashboardState.profiles.length);
    } catch (err) {
        console.error('Exception fetching users:', err);
        dashboardState.profiles = [];
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

    if (!users.length) {
        userList.innerHTML = '<div class="card" style="grid-column: 1 / -1;">No study buddies matched your search.</div>';
        return;
    }

    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.classList.add('user-card');
        const subjects = normalizeSubjects(user.subjects);
        userCard.innerHTML = `
            <div class="user-card-head">
                <div class="user-avatar">${getUserAvatar(user)}</div>
                <div>
                    <h3>${user.username || 'Anonymous Scholar'}</h3>
                    <p class="muted">${user.course || 'Course not set'}</p>
                </div>
            </div>
            <div class="tag-list">
                ${subjects.length ? subjects.map(subject => `<span class="tag">${subject}</span>`).join('') : '<span class="tag">Open to study topics</span>'}
            </div>
            <p>${user.bio || 'No bio added yet.'}</p>
            <button class="btn btn-sm btn-ghost connect-btn" type="button" data-user="${user.username || 'student'}">Connect</button>
        `;
        userList.appendChild(userCard);
    });

    userList.querySelectorAll('.connect-btn').forEach((button) => {
        button.addEventListener('click', () => {
            alert(`Connection request coming soon for ${button.dataset.user}.`);
        });
    });
}

function displayGroups(groups, groupList) {
    groupList.innerHTML = '';
    groups.forEach(group => {
        const groupCard = document.createElement('div');
        groupCard.classList.add('group-card');
        const subject = group.subject || 'General study group';
        groupCard.innerHTML = `
            <div class="group-card-head">
                <div class="user-avatar"><span>${(group.name || 'SG').slice(0, 2).toUpperCase()}</span></div>
                <div>
                    <h3>${group.name}</h3>
                    <p class="muted">${subject}</p>
                </div>
            </div>
            <div class="tag-list">
                <span class="tag">Realtime chat</span>
                <span class="tag">Study group</span>
            </div>
            <button data-group-id="${group.id}" class="join-group-btn btn btn-sm btn-full" type="button">Join Chat</button>
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
    dashboardState.search = searchInput.value.trim().toLowerCase();
    const filteredUsers = dashboardState.profiles.filter(matchesDashboardFilter);
    displayUsers(filteredUsers, userList);
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
    const loadingSkeletons = document.getElementById('loadingSkeletons');
    const filterButtons = document.querySelectorAll('.chip');

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

    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            filterButtons.forEach((chip) => chip.classList.remove('active'));
            button.classList.add('active');
            dashboardState.filter = button.dataset.filter || 'all';
            displayUsers(dashboardState.profiles.filter(matchesDashboardFilter), userList);
        });
    });

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
        showDashboardLoading();
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            console.log('User authenticated:', !!user);
            
            if (!user) {
                console.error('No user found, not loading dashboard');
                userList.innerHTML = '<p>Please log in to view the dashboard.</p>';
                groupList.innerHTML = '<p>Please log in to view groups.</p>';
                return;
            }
            
            await fetchUsers();
            displayUsers(dashboardState.profiles.filter(matchesDashboardFilter), userList);
            await fetchGroups(groupList);
        } catch (err) {
            console.error('Error initializing dashboard:', err);
        } finally {
            hideDashboardLoading();
        }
    }

    // Load data
    initializeDashboard();
});
