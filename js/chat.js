// js/chat.js
import { supabase, supabaseKey, supabaseUrl } from './supabase.js';

function getRedirectPath(page) {
    const pathname = window.location.pathname;
    return pathname.includes('/StudyBuddy/') ? `/StudyBuddy/${page}` : `/${page}`;
}

const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const groupNameHeader = document.getElementById('group-name-header');
const videoCallBtn = document.getElementById('video-call-btn');
const chatGroupsList = document.querySelector('.chat-groups-list');
const videoCallModal = document.getElementById('video-call-modal');
const closeVideoCallBtn = document.getElementById('close-video-call-btn');
const jitsiContainer = document.getElementById('jitsi-container');
const aiChatWindow = document.getElementById('ai-chat-window');
const aiInput = document.getElementById('ai-input');
const aiSendBtn = document.getElementById('ai-send-btn');
const aiSpinner = document.getElementById('ai-spinner');
const aiQuickButtons = Array.from(document.querySelectorAll('.ai-quick-btn'));

const urlParams = new URLSearchParams(window.location.search);
let groupId = urlParams.get('group_id');
let currentUser = null;
let jitsiApi = null;
let availableGroups = [];
let usersCache = {};
let messagesChannel = null;
let profileChannel = null;
let assistantMessages = [];
let assistantRequestInFlight = false;
let assistantCooldownUntil = 0;
let assistantCooldownTimer = null;
const aiTypingIndicatorId = 'ai-typing-indicator';
const assistantStorageKey = `studybuddy-gemini-chat-${groupId || 'browse'}`;
const assistantStorageLegacyKey = `studybuddy-assistant-${groupId || 'browse'}`;

function normalizeSubjects(subjects) {
    if (Array.isArray(subjects)) {
        return subjects.filter(Boolean).map((subject) => String(subject).trim()).filter(Boolean);
    }

    if (typeof subjects === 'string' && subjects.trim()) {
        return subjects.split(',').map((subject) => subject.trim()).filter(Boolean);
    }

    return [];
}

function getGroupAvatar(name) {
    return (name || 'SG').slice(0, 2).toUpperCase();
}

function renderChatSkeletons() {
    messagesContainer.innerHTML = `
        <div class="message-wrapper">
            <div class="chat-avatar skeleton skeleton-avatar"></div>
            <div class="message skeleton" style="width: min(70%, 420px); height: 88px;"></div>
        </div>
        <div class="message-wrapper sent">
            <div class="chat-avatar skeleton skeleton-avatar"></div>
            <div class="message skeleton" style="width: min(60%, 360px); height: 76px;"></div>
        </div>
        <div class="message-wrapper">
            <div class="chat-avatar skeleton skeleton-avatar"></div>
            <div class="message skeleton" style="width: min(66%, 400px); height: 92px;"></div>
        </div>
    `;
}

function renderEmptyChatState() {
    messagesContainer.innerHTML = `
        <div class="card fade-in chat-empty-state">
            <h3 style="margin-top: 0;">Select a study group</h3>
            <p class="page-section-copy">All available study groups stay in the left sidebar. Open one to join the room, or browse from here without leaving the page.</p>
            <button id="browse-groups-btn" class="btn btn-sm">Browse groups</button>
        </div>
    `;

    document.getElementById('browse-groups-btn')?.addEventListener('click', () => {
        document.body.classList.add('chat-sidebar-open');
    });
}

function updateActiveGroupTitle() {
    if (!groupNameHeader) return;

    if (!groupId) {
        groupNameHeader.textContent = 'Select a group';
        return;
    }

    const activeGroup = availableGroups.find((group) => String(group.id) === String(groupId));
    groupNameHeader.textContent = activeGroup?.name || 'Loading group...';
}

function renderGroupsSidebar() {
    if (!chatGroupsList) return;

    chatGroupsList.innerHTML = '';

    if (!availableGroups.length) {
        chatGroupsList.innerHTML = '<li class="card" style="text-align:center;">No study groups found.</li>';
        return;
    }

    availableGroups.forEach((group) => {
        const subjects = normalizeSubjects(group.subject);
        const item = document.createElement('li');
        item.innerHTML = `
            <button type="button" class="group-pill ${String(group.id) === String(groupId) ? 'active' : ''}" data-group-id="${group.id}">
                <span class="group-pill-avatar">${getGroupAvatar(group.name)}</span>
                <span class="group-pill-body">
                    <strong>${group.name}</strong>
                    <small>${subjects.length ? subjects.join(' • ') : 'General study group'}</small>
                </span>
            </button>
        `;
        chatGroupsList.appendChild(item);
    });

    chatGroupsList.querySelectorAll('[data-group-id]').forEach((button) => {
        button.addEventListener('click', () => {
            const nextGroupId = button.dataset.groupId;
            window.location.href = getRedirectPath(`chatroom.html?group_id=${nextGroupId}`);
        });
    });
}

async function fetchStudyGroups() {
    const { data, error } = await supabase
        .from('groups')
        .select('id, name, subject, created_by, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching study groups:', error);
        availableGroups = [];
        renderGroupsSidebar();
        return;
    }

    availableGroups = Array.isArray(data) ? data : [];
    renderGroupsSidebar();
    updateActiveGroupTitle();
}

async function fetchGroupDetails() {
    if (!groupId) return;

    const { data, error } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single();

    if (error) {
        console.error('Error fetching group name:', error);
        return;
    }

    if (data?.name) {
        groupNameHeader.textContent = data.name;
    }
}

async function fetchUser(userId) {
    if (!userId) {
        return { username: 'Unknown', avatar: null };
    }

    if (usersCache[userId]) {
        return usersCache[userId];
    }

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching user profile:', error);
            return { username: 'Unknown', avatar: null };
        }

        const normalized = {
            username: data?.username || 'Unknown',
            avatar: data?.avatar_url || null,
        };

        usersCache[userId] = normalized;
        return normalized;
    } catch (error) {
        console.error('Unexpected error fetching user profile:', error);
        return { username: 'Unknown', avatar: null };
    }
}

function getCurrentRoomName() {
    return groupId ? `studybuddy-finder-${groupId}` : null;
}

function openCallRoom(roomName) {
    if (!roomName) return;

    videoCallModal.style.display = 'flex';

    if (jitsiApi) {
        jitsiApi.dispose();
        jitsiApi = null;
    }

    jitsiApi = new JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainer,
        userInfo: {
            displayName: currentUser?.email || currentUser?.user_metadata?.username || 'StudyBuddy user',
        },
        configOverwrite: {
            prejoinPageEnabled: false,
        },
        interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
                'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                'hangup', 'chat', 'raisehand', 'videoquality', 'filmstrip',
                'invite', 'tileview', 'help',
            ],
        },
    });

    jitsiApi.addEventListener('videoConferenceLeft', () => {
        closeVideoCall();
    });
}

async function postCallInvite() {
    if (!groupId || !currentUser) return;

    const roomName = getCurrentRoomName();
    const { error } = await supabase.from('messages').insert([
        {
            message: `[[CALL_INVITE]] ${roomName}`,
            user_id: currentUser.id,
            group_id: groupId,
            is_ai_response: false,
        },
    ]);

    if (error) {
        console.error('Error creating call invite:', error);
    }
}

function buildCallInviteElement(roomName, message) {
    const inviteCard = document.createElement('div');
    inviteCard.className = 'call-invite-card';
    inviteCard.innerHTML = `
        <div class="call-invite-head">
            <span class="call-dot"></span>
            <strong>Live call available</strong>
        </div>
        <p>${message}</p>
        <button type="button" class="btn btn-sm join-call-btn">Join call</button>
    `;

    inviteCard.querySelector('.join-call-btn')?.addEventListener('click', () => {
        openCallRoom(roomName);
    });

    return inviteCard;
}

function renderMessageSkeleton() {
    renderChatSkeletons();
}

async function fetchMessages() {
    if (!groupId) {
        renderEmptyChatState();
        return;
    }

    renderMessageSkeleton();

    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching messages:', error);
        messagesContainer.innerHTML = '<div class="card">Unable to load messages.</div>';
        return;
    }

    messagesContainer.innerHTML = '';
    for (const message of (data || [])) {
        await displayMessage(message);
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function displayMessage(message) {
    const isCallInvite = typeof message.message === 'string' && message.message.startsWith('[[CALL_INVITE]]');
    const callRoomName = isCallInvite ? message.message.replace('[[CALL_INVITE]]', '').trim() : '';

    if (isCallInvite) {
        const inviter = await fetchUser(message.user_id);
        const inviteRow = document.createElement('div');
        inviteRow.className = 'message-wrapper received call-invite-wrapper';
        inviteRow.appendChild(buildCallInviteElement(callRoomName, `${inviter.username || 'A member'} started a live call in this room.`));
        messagesContainer.appendChild(inviteRow);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return;
    }

    const user = await fetchUser(message.user_id);
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper';

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'chat-avatar';

    if (user.avatar) {
        const img = document.createElement('img');
        img.src = user.avatar;
        img.alt = user.username;
        avatarDiv.appendChild(img);
    } else {
        avatarDiv.textContent = user.username ? user.username.charAt(0).toUpperCase() : '?';
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';

    if (message.user_id === currentUser?.id) {
        messageWrapper.classList.add('sent');
        messageDiv.classList.add('sent');
    } else {
        messageWrapper.classList.add('received');
        messageDiv.classList.add('received');
        messageWrapper.appendChild(avatarDiv);
    }

    messageDiv.innerHTML = `
        <div class="meta">
            <strong>${user.username}</strong>
            <span>${new Date(message.created_at).toLocaleTimeString()}</span>
        </div>
        <div class="text">${message.message}</div>
    `;

    messageWrapper.appendChild(messageDiv);
    if (message.user_id === currentUser?.id) {
        messageWrapper.appendChild(avatarDiv);
    }

    messagesContainer.appendChild(messageWrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText || !groupId) return;

    const { error } = await supabase
        .from('messages')
        .insert([{ message: messageText, user_id: currentUser.id, group_id: groupId }]);

    if (error) {
        console.error('Error sending message:', error);
        return;
    }

    messageInput.value = '';
}

function loadAssistantMessages() {
    try {
        const stored = localStorage.getItem(assistantStorageKey);
        if (!stored) {
            localStorage.removeItem(assistantStorageLegacyKey);
            return [];
        }

        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Could not load assistant history:', error);
        return [];
    }
}

function saveAssistantMessages() {
    try {
        localStorage.setItem(assistantStorageKey, JSON.stringify(assistantMessages.slice(-40)));
    } catch (error) {
        console.warn('Could not save assistant history:', error);
    }
}

function renderAssistantChat() {
    aiChatWindow.innerHTML = '';

    if (!assistantMessages.length) {
        const welcome = document.createElement('div');
        welcome.className = 'ai-message assistant welcome';
        welcome.innerHTML = `
            <strong>Gemini Chat</strong>
            <p>Ask me to explain a topic, build a quiz, summarize notes, or help with homework.</p>
            <small>Try “Explain mitosis” or “Quiz me on algebra”.</small>
        `;
        aiChatWindow.appendChild(welcome);
        return;
    }

    for (const item of assistantMessages) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${item.role}`;

        const bubble = document.createElement('div');
        bubble.className = 'ai-bubble';

        const meta = document.createElement('div');
        meta.className = 'ai-meta';
        meta.textContent = `${item.role === 'user' ? 'You' : 'Gemini'} · ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        const content = document.createElement('div');
        content.className = 'ai-content';
        content.textContent = item.text;

        bubble.appendChild(meta);
        bubble.appendChild(content);
        messageDiv.appendChild(bubble);
        aiChatWindow.appendChild(messageDiv);
    }

    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
}

function addAssistantMessage(role, text) {
    assistantMessages.push({
        role,
        text,
        timestamp: Date.now(),
    });
    saveAssistantMessages();
    renderAssistantChat();
}

function showAiTypingIndicator() {
    hideAiTypingIndicator();
    const typing = document.createElement('div');
    typing.id = aiTypingIndicatorId;
    typing.className = 'ai-message assistant';
    typing.innerHTML = `
        <div class="typing-bubble">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    aiChatWindow.appendChild(typing);
    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
}

function hideAiTypingIndicator() {
    document.getElementById(aiTypingIndicatorId)?.remove();
}

function setAssistantControlsDisabled(isDisabled) {
    aiSendBtn.disabled = isDisabled;
    aiInput.disabled = isDisabled;
    aiQuickButtons.forEach((button) => {
        button.disabled = isDisabled;
    });
}

function clearAssistantCooldownTimer() {
    if (assistantCooldownTimer) {
        window.clearTimeout(assistantCooldownTimer);
        assistantCooldownTimer = null;
    }
}

function startAssistantCooldown(durationMs = 3000) {
    assistantCooldownUntil = Date.now() + durationMs;
    clearAssistantCooldownTimer();
    assistantCooldownTimer = window.setTimeout(() => {
        assistantCooldownUntil = 0;
        assistantCooldownTimer = null;
        setAssistantControlsDisabled(false);
    }, durationMs);
}

function isAssistantCoolingDown() {
    return Date.now() < assistantCooldownUntil;
}

function formatRateLimitDetails(data) {
    const model = data?.model ? ` Model: ${data.model}.` : '';
    const version = data?.version ? ` Function: ${data.version}.` : '';
    const retryAfter = data?.retryAfter ? ` Retry after: ${data.retryAfter}.` : '';
    return `${data?.error || 'Gemini quota is exhausted for this API key.'}${model}${version}${retryAfter}`;
}

function getFallbackAssistantReply(prompt) {
    const normalizedPrompt = prompt.toLowerCase();

    if (/\b(explain|what is|define|describe)\b/.test(normalizedPrompt)) {
        return 'Gemini quota is exhausted for this API key right now. Try again later, or paste the topic and I can help you break it into definition, example, and takeaway.';
    }

    if (/\b(solve|help me solve|problem|question|answer)\b/.test(normalizedPrompt)) {
        return 'Gemini quota is exhausted for this API key right now. Paste the full problem and I will help you organize the given facts, goal, and first step.';
    }

    if (/\b(summarize|summary|recap)\b/.test(normalizedPrompt)) {
        return 'Gemini quota is exhausted for this API key right now. Paste the notes or passage and I will help you build a short summary framework.';
    }

    return 'Gemini quota is exhausted for this API key right now. Wait a minute and try again, or paste your topic here and I will help with a quick study outline.';
}

async function handleAssistantPrompt(prompt) {
    if (!prompt) return;
    if (assistantRequestInFlight || isAssistantCoolingDown()) return;

    assistantRequestInFlight = true;
    const trimmedPrompt = prompt.trim();
    addAssistantMessage('user', trimmedPrompt);
    aiInput.value = '';
    aiSpinner.style.display = 'block';
    setAssistantControlsDisabled(true);
    showAiTypingIndicator();

    try {
        const conversation = assistantMessages.slice(0, -1).slice(-12).map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            text: message.text,
        }));

        const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
                prompt: trimmedPrompt,
                history: conversation,
            }),
        });

        const rawText = await response.text();
        let data;
        try {
            data = rawText ? JSON.parse(rawText) : {};
        } catch {
            data = { error: rawText || 'Empty response from Edge Function.' };
        }

        const rateLimitError = /rate limit/i.test(data?.error || '') || response.status === 429 || data?.status === 429;

        if (!response.ok || data?.error) {
            if (rateLimitError) {
                hideAiTypingIndicator();
                addAssistantMessage('assistant', `${getFallbackAssistantReply(trimmedPrompt)}\n\n${formatRateLimitDetails(data)}`);
                const retryAfterSeconds = Number.parseInt(data?.retryAfter || '', 10);
                startAssistantCooldown(Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 30000);
                return;
            }

            throw new Error(data?.error || `Edge Function returned HTTP ${response.status}.`);
        }

        const reply = data?.response?.trim();
        if (!reply) {
            throw new Error('The chatbot did not return a response.');
        }

        hideAiTypingIndicator();
        addAssistantMessage('assistant', reply);
        startAssistantCooldown(1500);
    } catch (error) {
        hideAiTypingIndicator();
        console.error('Error with study bot:', error);
        addAssistantMessage('assistant', `I hit a problem generating a reply: ${error.message}`);
    } finally {
        assistantRequestInFlight = false;
        if (!isAssistantCoolingDown()) {
            aiSpinner.style.display = 'none';
            setAssistantControlsDisabled(false);
            aiInput.focus();
        }
    }
}

async function handleRealtimeMessageInsert(payload) {
    if (!payload?.new) return;
    await displayMessage(payload.new);
}

function subscribeToMessages() {
    if (!groupId) return;

    if (messagesChannel) {
        supabase.removeChannel(messagesChannel);
    }

    messagesChannel = supabase
        .channel(`group_${groupId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `group_id=eq.${groupId}`,
        }, handleRealtimeMessageInsert)
        .subscribe();
}

function subscribeToProfiles() {
    if (profileChannel) {
        supabase.removeChannel(profileChannel);
    }

    profileChannel = supabase
        .channel('public:profiles')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
            const updatedProfile = payload.new;
            if (updatedProfile?.id && usersCache[updatedProfile.id]) {
                usersCache[updatedProfile.id] = {
                    ...usersCache[updatedProfile.id],
                    username: updatedProfile.username || usersCache[updatedProfile.id].username,
                    avatar: updatedProfile.avatar_url || null,
                };
                fetchMessages();
            }
        })
        .subscribe();
}

function closeVideoCall() {
    if (jitsiApi) {
        jitsiApi.dispose();
        jitsiApi = null;
    }
    videoCallModal.style.display = 'none';
}

async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = getRedirectPath('index.html');
        return;
    }

    currentUser = user;
    document.body.classList.add('chatroom-page');

    await fetchStudyGroups();
    updateActiveGroupTitle();
    assistantMessages = loadAssistantMessages();

    if (!assistantMessages.length) {
        assistantMessages = [{
            role: 'assistant',
            text: 'I am Gemini Chat. Ask me to explain a topic, summarize notes, quiz you, or help with homework.',
            timestamp: Date.now(),
        }];
        saveAssistantMessages();
    }

    renderAssistantChat();

    if (groupId) {
        await fetchGroupDetails();
        await fetchMessages();
        subscribeToMessages();
    } else {
        renderEmptyChatState();
        messageInput.disabled = true;
        sendBtn.disabled = true;
        videoCallBtn.disabled = true;
        messagesContainer.classList.add('chat-empty');
    }

    subscribeToProfiles();
}

function loadAssistantMessages() {
    try {
        const stored = localStorage.getItem(assistantStorageKey);
        if (!stored) {
            localStorage.removeItem(assistantStorageLegacyKey);
            return [];
        }

        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Could not load assistant history:', error);
        return [];
    }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

aiSendBtn.addEventListener('click', () => {
    handleAssistantPrompt(aiInput.value);
});

aiInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        handleAssistantPrompt(aiInput.value);
    }
});

aiQuickButtons.forEach((button) => {
    button.addEventListener('click', () => {
        handleAssistantPrompt(button.dataset.prompt || button.textContent.trim());
    });
});

videoCallBtn.addEventListener('click', async () => {
    if (!groupId) {
        alert('Select a study group first.');
        return;
    }

    await postCallInvite();
    openCallRoom(getCurrentRoomName());
});

closeVideoCallBtn.addEventListener('click', closeVideoCall);

window.addEventListener('beforeunload', () => {
    if (messagesChannel) {
        supabase.removeChannel(messagesChannel);
    }

    if (profileChannel) {
        supabase.removeChannel(profileChannel);
    }
});

init().catch((error) => {
    console.error('Chatroom initialization failed:', error);
});
