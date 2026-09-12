const demoStructure = [
  { id: 'identity-maker', type: 'identity', icon: '🌱', title: '꾸준히 만드는 사람', description: '완벽하게 준비되길 기다리기보다 작은 결과물을 계속 만드는 방향.', parent: null, progress: 62 },
  { id: 'goal-portfolio', type: 'goal', icon: '🎯', title: '디자인 포트폴리오 완성', description: '내 경험과 작업을 보여줄 수 있는 포트폴리오를 완성한다.', parent: 'identity-maker', progress: 48 },
  { id: 'project-site', type: 'project', icon: '📁', title: '포트폴리오 웹사이트', description: '프로젝트와 소개를 웹으로 정리해 공개 가능한 상태까지 만든다.', parent: 'goal-portfolio', progress: 45 },
  { id: 'task-main', type: 'task', icon: '□', title: '메인 페이지 디자인', description: '첫 화면의 구조와 시각 스타일을 결정한다.', parent: 'project-site', progress: 35 },
  { id: 'next-ref', type: 'next', icon: '→', title: '레퍼런스 사이트 3개 저장하기', description: '지금 바로 실행할 수 있는 가장 작은 행동.', parent: 'task-main', progress: 0 },
  { id: 'task-intro', type: 'task', icon: '□', title: '프로젝트 소개 정리', description: '프로젝트마다 문제, 과정, 결과를 읽기 쉽게 정리한다.', parent: 'project-site', progress: 10 },
  { id: 'project-works', type: 'project', icon: '📁', title: '개인 작업 정리', description: '드로잉과 디자인 개인작을 선별해 정리한다.', parent: 'goal-portfolio', progress: 20 },
  { id: 'identity-work', type: 'identity', icon: '🌱', title: '일을 안정적으로 익히는 사람', description: '새 업무를 기록하고 반복해서 내 방식으로 익힌다.', parent: null, progress: 30 },
  { id: 'goal-adapt', type: 'goal', icon: '🎯', title: '품질관리 업무 흐름 익히기', description: '반복되는 업무와 확인 포인트를 놓치지 않는 체계를 만든다.', parent: 'identity-work', progress: 30 },
  { id: 'project-manual', type: 'project', icon: '📁', title: '업무 개인 매뉴얼', description: '배운 내용을 내 언어로 다시 정리한다.', parent: 'goal-adapt', progress: 25 }
];

const nextItems = [
  { id: 'n1', title: '레퍼런스 사이트 3개 저장하기', path: '포트폴리오 웹사이트 › 메인 페이지 디자인', done: false },
  { id: 'n2', title: '업무 순서 메모 3줄 정리하기', path: '업무 개인 매뉴얼 › 업무 흐름 정리', done: false },
  { id: 'n3', title: '로고 스케치 하나 그리기', path: '개인 작업 정리 › 브랜딩 연습', done: false }
];

const archiveItems = [
  { type: '완료', title: '포트폴리오 구조 잡기', meta: '9월 10일 완료' },
  { type: '완료', title: '이력서 기본 구조 정리', meta: '9월 4일 완료' },
  { type: '보관', title: '예전 유튜브 프로젝트', meta: '필요할 때 다시 시작' },
  { type: '중단', title: '초기 앱 리디자인 실험', meta: '방향 변경으로 중단' }
];

const state = {
  page: 'home',
  selectedId: 'project-site',
  filter: 'all'
};

const labels = {
  identity: '정체성',
  goal: '목표',
  project: '프로젝트',
  task: '작업',
  next: '다음 한칸'
};

function $(selector, root = document) { return root.querySelector(selector); }
function $$(selector, root = document) { return [...root.querySelectorAll(selector)]; }

function getNode(id) { return demoStructure.find(item => item.id === id); }
function getChildren(id) { return demoStructure.filter(item => item.parent === id); }
function getDepth(item) {
  let depth = 0;
  let cursor = item;
  while (cursor?.parent) {
    depth += 1;
    cursor = getNode(cursor.parent);
  }
  return depth;
}

function pathFor(item) {
  const names = [];
  let cursor = item;
  while (cursor?.parent) {
    cursor = getNode(cursor.parent);
    if (cursor) names.unshift(cursor.title);
  }
  return names.join(' › ');
}

function renderTree() {
  const host = $('#structureTree');
  if (!host) return;
  const allowed = state.filter === 'all' ? demoStructure : demoStructure.filter(item => item.type === state.filter || hasAncestorType(item, state.filter));
  host.innerHTML = allowed.map(item => {
    const depth = Math.min(getDepth(item), 4);
    return `
      <button class="nk-tree-node nk-indent-${depth} ${item.id === state.selectedId ? 'active' : ''}" data-node-id="${item.id}" type="button">
        <span class="nk-tree-left">
          <span class="nk-type-badge">${item.icon}</span>
          <span class="nk-tree-title">${item.title}</span>
        </span>
        <span class="nk-tree-meta">${labels[item.type]}</span>
      </button>`;
  }).join('');

  $$('[data-node-id]', host).forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedId = btn.dataset.nodeId;
      renderTree();
      renderDetail();
      if (window.innerWidth <= 720) $('#detailPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function hasAncestorType(item, type) {
  let cursor = item;
  while (cursor?.parent) {
    cursor = getNode(cursor.parent);
    if (cursor?.type === type) return true;
  }
  return false;
}

function renderDetail() {
  const item = getNode(state.selectedId);
  const host = $('#detailPanel');
  if (!item || !host) return;
  const parent = item.parent ? getNode(item.parent) : null;
  const children = getChildren(item.id);
  const childTitle = item.type === 'identity' ? '연결된 목표' : item.type === 'goal' ? '프로젝트' : item.type === 'project' ? '작업' : item.type === 'task' ? '쪼갠 단계' : '연결 정보';

  host.innerHTML = `
    <div class="nk-detail-top">
      <div>
        <div class="nk-detail-type">${item.icon} ${labels[item.type]}</div>
        <h2 class="nk-detail-title">${item.title}</h2>
        <p class="nk-detail-description">${item.description || ''}</p>
      </div>
      <button class="nk-icon-btn" type="button" title="더보기">···</button>
    </div>
    ${parent ? `
      <div class="nk-detail-section">
        <span class="nk-detail-label">상위 연결</span>
        <button class="nk-parent-link" type="button" data-parent-id="${parent.id}">${parent.icon} ${parent.title}</button>
      </div>` : ''}
    <div class="nk-detail-section">
      <span class="nk-detail-label">진행</span>
      <div class="nk-progress-row">
        <div class="nk-progress"><span style="width:${item.progress || 0}%"></span></div>
        <strong>${item.progress || 0}%</strong>
      </div>
    </div>
    <div class="nk-detail-section">
      <div class="nk-card-head">
        <h3>${childTitle}</h3>
        ${item.type !== 'next' ? '<button class="nk-soft-btn" id="detailAddChild" type="button">＋ 추가</button>' : ''}
      </div>
      <div class="nk-task-stack">
        ${children.length ? children.map(child => `
          <button class="nk-task-row" data-child-id="${child.id}" type="button">
            <span><b>${child.icon} ${child.title}</b><small>${child.description || labels[child.type]}</small></span>
            <span class="nk-status-pill ${child.type === 'next' ? 'next' : ''}">${labels[child.type]}</span>
          </button>`).join('') : `
          <div class="nk-task-row">
            <span><b>아직 연결된 항목이 없어요.</b><small>필요하면 여기서 다음 단계를 만들 수 있어요.</small></span>
          </div>`}
      </div>
    </div>
    ${item.type === 'task' ? `
      <div class="nk-detail-section">
        <button class="nk-primary-btn" id="openBreakdownFromDetail" type="button">이 작업 더 쪼개기</button>
      </div>` : ''}
  `;

  $('[data-parent-id]', host)?.addEventListener('click', e => {
    state.selectedId = e.currentTarget.dataset.parentId;
    renderTree();
    renderDetail();
  });
  $$('[data-child-id]', host).forEach(btn => btn.addEventListener('click', () => {
    state.selectedId = btn.dataset.childId;
    renderTree();
    renderDetail();
  }));
  $('#openBreakdownFromDetail')?.addEventListener('click', () => openBreakdown(item));
  $('#detailAddChild')?.addEventListener('click', openAddModal);
}

function renderNextItems() {
  const host = $('#nextList');
  if (!host) return;
  host.innerHTML = nextItems.map(item => `
    <button class="nk-next-item ${item.done ? 'done' : ''}" type="button" data-next-id="${item.id}">
      <span class="nk-check">${item.done ? '✓' : ''}</span>
      <span><strong>${item.title}</strong><span class="nk-mini-path">${item.path}</span></span>
    </button>`).join('');
  $('#nextCount').textContent = `${nextItems.filter(x => !x.done).length}개`;
  $$('[data-next-id]', host).forEach(btn => btn.addEventListener('click', () => {
    const item = nextItems.find(x => x.id === btn.dataset.nextId);
    item.done = !item.done;
    renderNextItems();
  }));
}

function renderArchive() {
  const host = $('#archiveGrid');
  if (!host) return;
  host.innerHTML = archiveItems.map(item => `
    <article class="nk-card nk-archive-card">
      <span class="nk-archive-tag">${item.type}</span>
      <h3>${item.title}</h3>
      <p>${item.meta}</p>
    </article>`).join('');
}

function setPage(page) {
  state.page = page;
  $$('.nk-page').forEach(section => section.classList.toggle('active', section.dataset.page === page));
  $$('[data-nav-page]').forEach(btn => btn.classList.toggle('active', btn.dataset.navPage === page));
  const title = { home: '홈', structure: '구조', archive: '보관함', settings: '설정' }[page] || '다음 한칸';
  $('#topTitle').textContent = title;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openBreakdown(item = getNode('task-intro')) {
  $('#breakdownTaskTitle').textContent = item?.title || '작업';
  $('#breakdownModal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
  document.body.style.overflow = '';
}

function openAddModal() {
  $('#addModal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function initBreakdown() {
  const inputs = $$('.nk-break-inputs input');
  const choices = $('#breakdownChoices');
  const syncChoices = () => {
    choices.innerHTML = inputs.filter(input => input.value.trim()).map((input, index) => `
      <label class="nk-choice"><input type="radio" name="nextChoice" value="${index}" ${index === 0 ? 'checked' : ''}> <span>${input.value.trim()}</span></label>`).join('');
  };
  inputs.forEach(input => input.addEventListener('input', syncChoices));
  syncChoices();
  $('#saveBreakdown')?.addEventListener('click', () => closeOverlay('breakdownModal'));
}

function initFilters() {
  $$('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    $$('[data-filter]').forEach(x => x.classList.toggle('active', x === btn));
    renderTree();
  }));
}

function initNavigation() {
  $$('[data-nav-page]').forEach(btn => btn.addEventListener('click', () => setPage(btn.dataset.navPage)));
  $('#fab')?.addEventListener('click', openAddModal);
  $('#topAdd')?.addEventListener('click', openAddModal);
  $('#structureAdd')?.addEventListener('click', openAddModal);
  $$('[data-close-overlay]').forEach(btn => btn.addEventListener('click', () => closeOverlay(btn.dataset.closeOverlay)));
  $$('.nk-overlay').forEach(overlay => overlay.addEventListener('click', e => {
    if (e.target === overlay) closeOverlay(overlay.id);
  }));
  $$('.nk-add-option').forEach(btn => btn.addEventListener('click', () => closeOverlay('addModal')));
  $('#startNow')?.addEventListener('click', () => {
    $('#startNow').textContent = '진행 중';
    $('#startNow').disabled = true;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeOverlay('addModal');
      closeOverlay('breakdownModal');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initFilters();
  initBreakdown();
  renderTree();
  renderDetail();
  renderNextItems();
  renderArchive();
  setPage('home');
});
