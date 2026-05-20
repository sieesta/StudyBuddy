// js/chat.js
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

const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const groupNameHeader = document.getElementById('group-name-header');
const videoCallBtn = document.getElementById('video-call-btn');

// Video Call Modal Elements
const videoCallModal = document.getElementById('video-call-modal');
const closeVideoCallBtn = document.getElementById('close-video-call-btn');
const jitsiContainer = document.getElementById('jitsi-container');
let jitsiApi = null;

// AI Panel Elements
const aiChatWindow = document.getElementById('ai-chat-window');
const aiInput = document.getElementById('ai-input');
const aiSendBtn = document.getElementById('ai-send-btn');
const aiSpinner = document.getElementById('ai-spinner');

const urlParams = new URLSearchParams(window.location.search);
const groupId = urlParams.get('group_id');

if (!groupId) {
    alert('No group selected!');
    window.location.href = getRedirectPath('dashboard.html');
}

let currentUser;
let usersCache = {};

// Fetch group details
async function fetchGroupDetails() {
    const { data, error } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single();
    if (error) {
        console.error('Error fetching group name:', error);
    } else {
        groupNameHeader.textContent = data.name;
    }
}

// Fetch user details and cache them
async function fetchUser(userId) {
    if (!userId) {
        return { username: 'Unknown', avatar_url: null };
    }
    if (usersCache[userId]) {
        return usersCache[userId];
    }
    const { data, error } = await supabase
        .from('profiles')
        .select('username, avatar')
        .eq('id', userId)
        .single();
    if (error) {
        console.error('Error fetching user profile:', error);
        return { username: 'Unknown', avatar: null };
    }
    usersCache[userId] = data;
    return data;
}


// Fetch initial messages
async function fetchMessages() {
    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching messages:', error);
        return;
    }

    messagesContainer.innerHTML = '';
    for (const message of messages) {
        await displayMessage(message);
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Display a single message
async function displayMessage(message) {
    const user = await fetchUser(message.user_id);
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message-wrapper');

    const avatarDiv = document.createElement('div');
    avatarDiv.classList.add('chat-avatar');

    if (user.avatar) {
        const img = document.createElement('img');
        img.src = user.avatar;
        img.alt = user.username;
        avatarDiv.appendChild(img);
    } else {
        avatarDiv.textContent = user.username ? user.username.charAt(0).toUpperCase() : '?';
    }

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');

    if (message.user_id === currentUser.id) {
        messageWrapper.classList.add('sent');
        messageDiv.classList.add('sent');
    } else {
        messageWrapper.classList.add('received');
        messageDiv.classList.add('received');
        messageWrapper.appendChild(avatarDiv); // Avatar on the left for received
    }

    messageDiv.innerHTML = `
        <div class="meta">
            <strong>${user.username}</strong>
            <span>${new Date(message.created_at).toLocaleTimeString()}</span>
        </div>
        <div class="text">${message.message}</div>
    `;
    
    messageWrapper.appendChild(messageDiv);
    if (message.user_id === currentUser.id) {
        messageWrapper.appendChild(avatarDiv); // Avatar on the right for sent
    }

    messagesContainer.appendChild(messageWrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send a message
async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return;

    const { error } = await supabase
        .from('messages')
        .insert([{ message: messageText, user_id: currentUser.id, group_id: groupId }]);

    if (error) {
        console.error('Error sending message:', error);
    } else {
        messageInput.value = '';
    }
}

// Handle AI commands
async function handleAiCommand(prompt) {
    if (!prompt) return;
    
    displayAiMessage(prompt, 'prompt');
    aiInput.value = '';

    // Show spinner and disable input
    aiSpinner.style.display = 'block';
    aiSendBtn.disabled = true;
    aiInput.disabled = true;

    try {
        // Securely call the Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('ai-chat', {
            body: { prompt: prompt },
        });

        if (error) {
            throw error;
        }

        // The Edge Function now returns a JSON object with a 'response' property
        const aiResponse = data.response;
        
        if(!aiResponse) {
            // Handle cases where the function returns an error message in the data object
            throw new Error(data.error || "The AI did not provide a response.");
        }

        displayAiMessage(aiResponse, 'response');
        
        // Log the interaction
        await supabase.from('ai_logs').insert([
            { user_id: currentUser.id, group_id: groupId, prompt: prompt, response: aiResponse }
        ]);

    } catch (error) {
        console.error('Error with AI command:', error);
        displayAiMessage(`Error: Could not get AI response. ${error.message}`, 'response');
    } finally {
        // Hide spinner and re-enable input
        aiSpinner.style.display = 'none';
        aiSendBtn.disabled = false;
        aiInput.disabled = false;
        aiInput.focus();
    }
}

function displayAiMessage(text, type) {
    const messageDiv = document.createElement('div');
    // Replace spaces in type with a hyphen for valid class names
    const className = type.replace(/\s+/g, '-');
    messageDiv.classList.add('ai-message', className);
    messageDiv.textContent = text;
    aiChatWindow.appendChild(messageDiv);
    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
}


// Listen for new messages in real-time
supabase.channel(`group_${groupId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` }, payload => {
        displayMessage(payload.new);
    })
    .subscribe();

// Listen for profile updates in real-time
const profileChannel = supabase.channel('public:profiles')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        // Update user cache and re-render messages if needed
        const updatedProfile = payload.new;
        if (usersCache[updatedProfile.id]) {
            usersCache[updatedProfile.id] = { ...usersCache[updatedProfile.id], ...updatedProfile };
            // This is a simple approach. For a large chat, you'd want to be more efficient.
            fetchMessages(); 
        }
    })
    .subscribe();


// Event Listeners
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

aiSendBtn.addEventListener('click', () => {
    handleAiCommand(aiInput.value);
});

aiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleAiCommand(aiInput.value);
    }
});

videoCallBtn.addEventListener('click', () => {
    // Show the modal
    videoCallModal.style.display = 'flex';

    // Jitsi options
    const domain = 'meet.jit.si';
    const options = {
        roomName: `studybuddy-finder-${groupId}`,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainer,
        userInfo: {
            displayName: currentUser.email // Or username from profile
        },
        configOverwrite: {
            prejoinPageEnabled: false // Skips the pre-join screen
        },
        interfaceConfigOverwrite: {
            // Overwrite interface properties
            TOOLBAR_BUTTONS: [
                'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
                'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
                'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
                'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
                'e2ee'
            ],
        }
    };

    // Initialize Jitsi
    jitsiApi = new JitsiMeetExternalAPI(domain, options);

    // Add a listener to know when the user hangs up
    jitsiApi.addEventListener('videoConferenceLeft', () => {
        closeVideoCall();
    });
});

function closeVideoCall() {
    if (jitsiApi) {
        jitsiApi.dispose();
        jitsiApi = null;
    }
    videoCallModal.style.display = 'none';
}

closeVideoCallBtn.addEventListener('click', closeVideoCall);

// Unsubscribe from channels when user leaves the page
window.addEventListener('beforeunload', () => {
    supabase.removeChannel(supabase.channel(`group_${groupId}`));
    supabase.removeChannel(profileChannel);
});

// Initialize
async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = getRedirectPath('index.html');
        return;
    }
    currentUser = user;
    await fetchGroupDetails();
    await fetchMessages();
}

init();
