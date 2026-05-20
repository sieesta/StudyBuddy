import './js/main.js';

const pageMap = [
  ['index.html', () => import('./js/auth.js')],
  ['dashboard.html', () => import('./js/dashboard.js')],
  ['chatroom.html', () => import('./js/chat.js')],
  ['profile.html', () => import('./js/profile.js')],
];

function ensureLoader() {
  let loader = document.getElementById('pageLoader');
  if (loader) {
    return loader;
  }

  loader = document.createElement('div');
  loader.id = 'pageLoader';
  loader.className = 'page-loader';
  loader.innerHTML = `
    <div class="loader-card">
      <div class="loader-orbit" aria-hidden="true"></div>
      <p class="loader-text">StudyBuddy Finder</p>
    </div>
  `;
  document.body.prepend(loader);
  return loader;
}

function ensureChatSidebarBackdrop() {
  const chatSidebar = document.querySelector('.chat-sidebar');
  if (!chatSidebar) {
    return;
  }

  let backdrop = document.querySelector('.chat-sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'chat-sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  backdrop.addEventListener('click', () => {
    document.body.classList.remove('chat-sidebar-open');
  });
}

function ensureNavToggle() {
  const nav = document.querySelector('header nav');
  if (!nav || nav.querySelector('.nav-toggle')) {
    return;
  }

  const toggle = document.createElement('button');
  toggle.className = 'nav-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Toggle navigation');
  toggle.innerHTML = '&#9776;';

  toggle.addEventListener('click', () => {
    nav.classList.toggle('nav-open');
  });

  const logo = nav.querySelector('.nav-logo');
  nav.insertBefore(toggle, logo ? logo.nextSibling : nav.firstChild);
}

function ensureChatSidebarToggle() {
  const chatHeader = document.querySelector('.chat-header');
  const chatSidebar = document.querySelector('.chat-sidebar');
  if (!chatHeader || !chatSidebar || document.getElementById('chat-sidebar-toggle')) {
    return;
  }

  const toggle = document.createElement('button');
  toggle.id = 'chat-sidebar-toggle';
  toggle.className = 'chat-sidebar-toggle btn-ghost';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Open study groups');
  toggle.textContent = '☰';
  toggle.addEventListener('click', () => {
    document.body.classList.toggle('chat-sidebar-open');
  });

  chatHeader.prepend(toggle);
}

function setupTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function setPageClass() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.body.dataset.page = path.replace('.html', '');
}

function hideLoader() {
  const loader = ensureLoader();
  requestAnimationFrame(() => {
    loader.classList.add('is-hidden');
  });
}

async function bootstrap() {
  setPageClass();
  setupTheme();
  ensureLoader();
  ensureNavToggle();
  ensureChatSidebarBackdrop();
  ensureChatSidebarToggle();

  const path = window.location.pathname.split('/').pop() || 'index.html';
  const pageEntry = pageMap.find(([page]) => page === path);

  if (pageEntry) {
    await pageEntry[1]();
  }

  window.addEventListener('load', () => {
    setTimeout(hideLoader, 180);
  });

  if (document.readyState === 'complete') {
    hideLoader();
  }
}

bootstrap().catch((error) => {
  console.error('App bootstrap failed:', error);
  hideLoader();
});
