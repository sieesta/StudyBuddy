// js/dashboard.js
import { supabase } from './supabase.js';

const userList = document.getElementById('user-list');
const groupList = document.getElementById('group-list');
const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
const createGroupBtn = document.getElementById('create-group-btn');

// Fetch and display all users initially
async function fetchUsers() {
    const { data: profiles, error } = await supabase.from('profiles').select('*');
    if (error) {
        console.error('Error fetching users:', error);
        return;
    }
    displayUsers(profiles);
}

// Fetch and display all groups
async function fetchGroups() {
    const { data: groups, error } = await supabase.from('groups').select('*');
    if (error) {
        console.error('Error fetching groups:', error);
        return;
    }
    displayGroups(groups);
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
            const basePath = new URL(document.baseURI).pathname;
            window.location.href = basePath + `chatroom.html?group_id=${groupId}`;
        });
    });
}

// Search functionality
searchBtn.addEventListener('click', async () => {
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (!searchTerm) {
        fetchUsers();
        return;
    }

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`subjects.ilike.%${searchTerm}%,course.ilike.%${searchTerm}%`);

    if (error) {
        console.error('Error searching users:', error);
    } else {
        displayUsers(profiles);
    }
});

// Create group functionality
createGroupBtn.addEventListener('click', async () => {
    const groupName = document.getElementById('group-name').value;
    const groupSubject = document.getElementById('group-subject').value;
    const { data: { user } } = await supabase.auth.getUser();

    if (!groupName || !groupSubject || !user) {
        alert('Please provide a group name, subject and be logged in.');
        return;
    }

    const { data, error } = await supabase
        .from('groups')
        .insert([{ name: groupName, subject: groupSubject, created_by: user.id }])
        .select();

    if (error) {
        alert(`Error creating group: ${error.message}`);
    } else {
        fetchGroups(); // Refresh the list
    }
});


// Initial data load
fetchUsers();
fetchGroups();
