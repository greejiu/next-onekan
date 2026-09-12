import { supabase } from "./supabase.js?v=2";

const TYPE_META = {
  identity: { label: "정체성", icon: "🌱", parentType: null, childType: "goal" },
  goal: { label: "목표", icon: "🎯", parentType: "identity", childType: "project" },
  project: { label: "프로젝트", icon: "📁", parentType: "goal", childType: "task" },
  task: { label: "작업", icon: "□", parentType: "project", childType: "next_step" },
  next_step: { label: "다음 한칸", icon: "→", parentType: "task", childType: null },
};

const STATUS_LABELS = {
  active: "진행 중",
  completed: "완료",
  archived: "보관",
  stopped: "중단",
};

const STORAGE_KEYS = {
  direction: "next-onekan:view-direction",
  expanded: "next-onekan:expanded-items",
  filter: "next-onekan:structure-filter",
};

const state = {
  user: null,
  items: [],
  focusId: null,
  page: "home",
  selectedId: null,
  filter: localStorage.getItem(STORAGE_KEYS.filter) || "all",
  direction: localStorage.getItem(STORAGE_KEYS.direction) || "forward",
  expanded: new Set(readJson(STORAGE_KEYS.expanded, [])),
  breakdownTaskId: null,
};

function $(selector, root = document) { return root.querySelector(selector); }
function $$(selector, root = document) { return [...root.querySelectorAll(selector)]; }
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function persistViewState() {
  localStorage.setItem(STORAGE_KEYS.direction, state.direction);
  localStorage.setItem(STORAGE_KEYS.filter, state.filter);
  localStorage.setItem(STORAGE_KEYS.expanded, JSON.stringify([...state.expanded]));
}
function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(date);
}
function setSync(text, isError = false) {
  for (const selector of ["#syncStatus", "#mobileSyncStatus"]) {
    const el = $(selector);
    if (!el) continue;
    el.textContent = text;
    el.classList.toggle("error", isError);
  }
}
function showAuthMessage(text = "") { $("#authMessage").textContent = text; }
function setAuthLoading(loading) {
  $("#loginButton").disabled = loading;
  $("#signupButton").disabled = loading;
}
function showLoggedOut() {
  state.user = null;
  state.items = [];
  state.focusId = null;
  state.selectedId = null;
  $("#authGate").hidden = false;
  $("#appShell").hidden = true;
  $("#fab").hidden = true;
  $("#mobileNav").hidden = true;
}
function showLoggedIn(user) {
  state.user = user;
  $("#authGate").hidden = true;
  $("#appShell").hidden = false;
  $("#fab").hidden = false;
  $("#mobileNav").hidden = false;
  $("#accountEmail").textContent = user.email || "로그인됨";
  $("#settingsAccountEmail").textContent = user.email || "로그인됨";
  showAuthMessage("");
}
function friendlyAuthError(error) {
  const code = error?.code || "";
  const message = String(error?.message || "").toLowerCase();
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) return "이메일 또는 비밀번호를 확인해 주세요.";
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) return "이메일 인증이 아직 완료되지 않았어요.";
  if (message.includes("already registered")) return "이미 가입된 이메일이에요. 로그인해 주세요.";
  return "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
function getItem(id) { return state.items.find((item) => item.id === id) || null; }
function sorted(items) {
  return [...items].sort((a, b) => (a.sort_order - b.sort_order) || String(a.created_at).localeCompare(String(b.created_at)));
}
function activeItems() { return state.items.filter((item) => item.status === "active"); }
function childrenOf(id, { includeInactive = false } = {}) {
  return sorted(state.items.filter((item) => item.parent_id === id && (includeInactive || item.status === "active")));
}
function ancestorsOf(item) {
  const chain = [];
  const seen = new Set();
  let cursor = item;
  while (cursor?.parent_id && !seen.has(cursor.parent_id)) {
    seen.add(cursor.parent_id);
    const parent = getItem(cursor.parent_id);
    if (!parent) break;
    chain.push(parent);
    cursor = parent;
  }
  return chain;
}
function pathFor(item) { return ancestorsOf(item).reverse().map((x) => x.title).join(" › "); }
function hasAncestorType(item, type) { return ancestorsOf(item).some((ancestor) => ancestor.type === type); }
function progressFor(item) {
  const children = childrenOf(item.id, { includeInactive: true }).filter((child) => child.status === "active" || child.status === "completed");
  if (!children.length) return null;
  const done = children.filter((child) => child.status === "completed").length;
  return Math.round((done / children.length) * 100);
}

async function loadData({ keepSelection = true } = {}) {
  if (!state.user) return;
  setSync("불러오는 중...");
  const [{ data: items, error: itemsError }, { data: focus, error: focusError }] = await Promise.all([
    supabase.from("structure_items").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("user_focus").select("current_item_id").eq("user_id", state.user.id).maybeSingle(),
  ]);

  if (itemsError) throw itemsError;
  if (focusError) throw focusError;

  state.items = items || [];
  state.focusId = focus?.current_item_id || null;
  if (!keepSelection || !getItem(state.selectedId)) {
    state.selectedId = activeItems()[0]?.id || state.items[0]?.id || null;
  }
  renderAll();
  setSync("저장됨");
}

function renderAll() {
  renderHome();
  renderTree();
  renderDetail();
  renderArchive();
  renderFilters();
  renderDirectionControls();
}

function renderHome() {
  const activeNext = sorted(state.items.filter((item) => item.type === "next_step" && item.status === "active"));
  const focus = getItem(state.focusId);
  const nowCard = $("#nowCard");

  if (focus && focus.type === "next_step" && focus.status === "active") {
    const path = pathFor(focus);
    const chain = ancestorsOf(focus);
    nowCard.innerHTML = `
      <div>
        <div class="nk-now-meta">${escapeHtml(path || "독립된 다음 한칸")}</div>
        <h2 class="nk-now-title">${escapeHtml(focus.title)}</h2>
        <div class="nk-path">${escapeHtml(focus.description || "지금 움직일 수 있는 가장 작은 행동.")}</div>
        ${chain.length ? `
          <details class="nk-now-reason">
            <summary>왜 하는 일이지?</summary>
            <div class="nk-why-chain">
              ${chain.map((item) => `<span>↑ ${TYPE_META[item.type]?.icon || ""} ${escapeHtml(item.title)}</span>`).join("")}
            </div>
          </details>` : ""}
      </div>
      <div class="nk-now-actions">
        <button class="nk-soft-btn" id="openFocusDetail" type="button">구조에서 보기</button>
        <button class="nk-primary-btn" id="completeFocus" type="button">완료</button>
      </div>`;
    $("#openFocusDetail")?.addEventListener("click", () => selectAndShow(focus.id));
    $("#completeFocus")?.addEventListener("click", () => updateStatus(focus.id, "completed"));
  } else {
    nowCard.innerHTML = `
      <div class="nk-now-empty">
        <div>
          <span class="nk-kicker">EMPTY</span>
          <h2>아직 ‘지금 한칸’이 없어요.</h2>
          <p>다음 한칸을 만든 뒤 하나를 골라 지금 집중할 행동으로 지정해보세요.</p>
        </div>
        <div><button class="nk-primary-btn" id="createFirstNext" type="button">＋ 다음 한칸 만들기</button></div>
      </div>`;
    $("#createFirstNext")?.addEventListener("click", () => openItemForm("next_step"));
  }

  const list = $("#nextList");
  $("#nextCount").textContent = `${activeNext.length}개`;
  if (!activeNext.length) {
    list.innerHTML = `<div class="nk-empty">실행 가능한 다음 한칸이 아직 없어요.<br />작업을 쪼개거나 바로 하나 만들어보세요.</div>`;
    return;
  }

  list.innerHTML = activeNext.map((item) => `
    <div class="nk-next-item">
      <button class="nk-check-btn" type="button" data-complete-next="${item.id}" aria-label="${escapeHtml(item.title)} 완료"></button>
      <div class="nk-next-main" data-open-next="${item.id}">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="nk-mini-path">${escapeHtml(pathFor(item) || "독립된 다음 한칸")}</span>
      </div>
      <div class="nk-next-actions">
        <button class="nk-mini-btn ${state.focusId === item.id ? "active" : ""}" type="button" data-focus-next="${item.id}">${state.focusId === item.id ? "지금 한칸" : "지금"}</button>
      </div>
    </div>`).join("");

  $$('[data-complete-next]', list).forEach((button) => button.addEventListener("click", () => updateStatus(button.dataset.completeNext, "completed")));
  $$('[data-focus-next]', list).forEach((button) => button.addEventListener("click", () => setFocus(button.dataset.focusNext)));
  $$('[data-open-next]', list).forEach((el) => el.addEventListener("click", () => selectAndShow(el.dataset.openNext)));
}

function renderFilters() {
  $$('[data-filter]').forEach((button) => button.classList.toggle("active", button.dataset.filter === state.filter));
}

function getVisibleExpandableIds() {
  if (state.direction === "reverse") {
    return state.items
      .filter((item) => item.status === "active" && item.type === "next_step" && item.parent_id)
      .flatMap((item) => [item.id, ...ancestorsOf(item).filter((ancestor) => ancestor.parent_id).map((ancestor) => ancestor.id)]);
  }
  return activeItems().filter((item) => childrenOf(item.id).length > 0).map((item) => item.id);
}

function renderDirectionControls() {
  $$('[data-direction]').forEach((button) => button.classList.toggle("active", button.dataset.direction === state.direction));
  $("#treeTitle").textContent = state.direction === "forward" ? "방향 → 행동" : "행동 → 방향";
  const visibleExpandable = getVisibleExpandableIds();
  const allExpanded = visibleExpandable.length > 0 && visibleExpandable.every((id) => state.expanded.has(id));
  $("#toggleAllTree").textContent = allExpanded ? "모두 접기" : "모두 펼치기";
}

function treeRow(item, depth, { reverse = false, expandable = false } = {}) {
  const meta = TYPE_META[item.type] || { label: item.type, icon: "•" };
  const expanded = state.expanded.has(item.id);
  return `
    <div class="nk-tree-node nk-indent-${Math.min(depth, 4)} ${item.id === state.selectedId ? "active" : ""} ${reverse ? "reverse" : ""}" data-node-id="${item.id}">
      <div class="nk-tree-left">
        ${expandable
          ? `<button class="nk-tree-toggle" type="button" data-toggle-node="${item.id}" aria-label="${expanded ? "접기" : "펼치기"}">${expanded ? "⌄" : "›"}</button>`
          : `<span class="nk-tree-toggle placeholder">·</span>`}
        <span class="nk-type-badge">${meta.icon}</span>
        <span class="nk-tree-title">${escapeHtml(item.title)}</span>
      </div>
      <span class="nk-tree-meta">${meta.label}</span>
    </div>`;
}

function renderTree() {
  const host = $("#structureTree");
  const active = activeItems();
  if (!active.length) {
    host.innerHTML = `<div class="nk-empty">아직 구조가 비어 있어요.<br />정체성부터 시작해도 되고<br />그냥 다음 한칸 하나만 만들어도 괜찮아요.</div>`;
    renderDirectionControls();
    return;
  }

  const html = [];
  if (state.direction === "reverse") {
    let roots = active.filter((item) => item.type === "next_step");
    if (state.filter !== "all") roots = roots.filter((item) => hasAncestorType(item, state.filter));
    sorted(roots).forEach((root) => appendReverse(root, 0, html));
  } else {
    let roots;
    if (state.filter === "all") {
      const activeIds = new Set(active.map((item) => item.id));
      roots = active.filter((item) => !item.parent_id || !activeIds.has(item.parent_id));
    } else {
      roots = active.filter((item) => item.type === state.filter);
    }
    sorted(roots).forEach((root) => appendForward(root, 0, html));
  }

  host.innerHTML = html.length ? html.join("") : `<div class="nk-empty">현재 보기 조건에 맞는 항목이 없어요.</div>`;

  $$('[data-toggle-node]', host).forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const id = button.dataset.toggleNode;
    if (state.expanded.has(id)) state.expanded.delete(id);
    else state.expanded.add(id);
    persistViewState();
    renderTree();
    renderDirectionControls();
  }));

  $$('[data-node-id]', host).forEach((row) => row.addEventListener("click", (event) => {
    if (event.target.closest('[data-toggle-node]')) return;
    state.selectedId = row.dataset.nodeId;
    renderTree();
    renderDetail();
    if (window.innerWidth <= 720) $("#detailPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  renderDirectionControls();
}

function appendForward(item, depth, html) {
  const children = childrenOf(item.id);
  html.push(treeRow(item, depth, { expandable: children.length > 0 }));
  if (!state.expanded.has(item.id)) return;
  children.forEach((child) => appendForward(child, depth + 1, html));
}

function appendReverse(item, depth, html) {
  const parent = item.parent_id ? getItem(item.parent_id) : null;
  const activeParent = parent?.status === "active" ? parent : null;
  html.push(treeRow(item, depth, { reverse: true, expandable: Boolean(activeParent) }));
  if (!activeParent || !state.expanded.has(item.id)) return;
  appendReverse(activeParent, depth + 1, html);
}

function renderDetail() {
  const host = $("#detailPanel");
  const item = getItem(state.selectedId);
  if (!item) {
    host.innerHTML = `<div class="nk-empty">왼쪽 구조에서 항목을 선택하면<br />여기에서 연결 관계와 상태를 확인할 수 있어요.</div>`;
    return;
  }

  const meta = TYPE_META[item.type] || { label: item.type, icon: "•" };
  const parent = item.parent_id ? getItem(item.parent_id) : null;
  const children = childrenOf(item.id, { includeInactive: true });
  const childType = TYPE_META[item.type]?.childType;
  const progress = progressFor(item);
  const statusLabel = STATUS_LABELS[item.status] || item.status;
  const dateBits = [item.start_date ? `시작 ${formatDate(item.start_date)}` : "", item.due_date ? `기한 ${formatDate(item.due_date)}` : ""].filter(Boolean).join(" · ");

  host.innerHTML = `
    <div class="nk-detail-top">
      <div>
        <div class="nk-detail-type">${meta.icon} ${meta.label} <span class="nk-detail-status">${escapeHtml(statusLabel)}</span></div>
        <h2 class="nk-detail-title">${escapeHtml(item.title)}</h2>
        <p class="nk-detail-description">${escapeHtml(item.description || "설명이 아직 없어요.")}</p>
        ${dateBits ? `<p class="nk-detail-description">${escapeHtml(dateBits)}</p>` : ""}
      </div>
      <button class="nk-icon-btn" id="editCurrentItem" type="button" title="수정">✎</button>
    </div>
    ${parent ? `<div class="nk-detail-section"><span class="nk-detail-label">상위 연결</span><button class="nk-parent-link" type="button" data-select-related="${parent.id}">${TYPE_META[parent.type]?.icon || "•"} ${escapeHtml(parent.title)}</button></div>` : ""}
    ${progress !== null ? `<div class="nk-detail-section"><span class="nk-detail-label">하위 진행</span><div class="nk-progress-row"><div class="nk-progress"><span style="width:${progress}%"></span></div><strong>${progress}%</strong></div></div>` : ""}
    <div class="nk-detail-section">
      <div class="nk-card-head"><h3>${childType ? `하위 ${TYPE_META[childType].label}` : "연결 정보"}</h3>${childType && item.status === "active" ? `<button class="nk-soft-btn" id="detailAddChild" type="button">＋ 추가</button>` : ""}</div>
      <div class="nk-task-stack">
        ${children.length ? children.map((child) => `<button class="nk-task-row" data-select-related="${child.id}" type="button"><span><b>${TYPE_META[child.type]?.icon || "•"} ${escapeHtml(child.title)}</b><small>${escapeHtml(STATUS_LABELS[child.status] || child.status)}</small></span><span class="nk-status-pill ${child.type === "next_step" ? "next" : ""}">${TYPE_META[child.type]?.label || child.type}</span></button>`).join("") : `<div class="nk-task-row"><span><b>아직 연결된 항목이 없어요.</b><small>필요하면 여기서 다음 단계를 만들 수 있어요.</small></span></div>`}
      </div>
    </div>
    ${item.type === "task" && item.status === "active" ? `<div class="nk-detail-section"><button class="nk-primary-btn" id="openBreakdownFromDetail" type="button">이 작업 쪼개기</button></div>` : ""}
    <div class="nk-detail-actions">
      ${item.type === "next_step" && item.status === "active" ? `<button class="nk-soft-btn" id="focusCurrentItem" type="button">${state.focusId === item.id ? "✓ 지금 한칸" : "지금 한칸으로 지정"}</button>` : ""}
      ${item.status === "active" ? `<button class="nk-soft-btn" data-status-action="completed" type="button">완료</button><button class="nk-soft-btn" data-status-action="archived" type="button">보관</button><button class="nk-soft-btn" data-status-action="stopped" type="button">중단</button>` : `<button class="nk-soft-btn" data-status-action="active" type="button">다시 시작</button>`}
      <button class="nk-danger-btn" id="deleteCurrentItem" type="button">삭제</button>
    </div>`;

  $$('[data-select-related]', host).forEach((button) => button.addEventListener("click", () => {
    state.selectedId = button.dataset.selectRelated;
    renderTree();
    renderDetail();
  }));
  $("#editCurrentItem")?.addEventListener("click", () => openItemForm(item.type, item.parent_id, item));
  $("#detailAddChild")?.addEventListener("click", () => openItemForm(childType, item.id));
  $("#openBreakdownFromDetail")?.addEventListener("click", () => openBreakdown(item));
  $("#focusCurrentItem")?.addEventListener("click", () => setFocus(item.id));
  $$('[data-status-action]', host).forEach((button) => button.addEventListener("click", () => updateStatus(item.id, button.dataset.statusAction)));
  $("#deleteCurrentItem")?.addEventListener("click", () => deleteItem(item));
}

function renderArchive() {
  const host = $("#archiveGrid");
  const archived = [...state.items].filter((item) => item.status !== "active").sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  if (!archived.length) {
    host.innerHTML = `<div class="nk-empty">완료·보관·중단한 항목이 아직 없어요.</div>`;
    return;
  }
  host.innerHTML = archived.map((item) => `<article class="nk-card nk-archive-card" data-archive-id="${item.id}"><span class="nk-archive-tag">${escapeHtml(STATUS_LABELS[item.status] || item.status)} · ${TYPE_META[item.type]?.label || item.type}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(pathFor(item) || item.description || "상위 연결 없음")}</p></article>`).join("");
  $$('[data-archive-id]', host).forEach((card) => card.addEventListener("click", () => selectAndShow(card.dataset.archiveId)));
}

function selectAndShow(id) {
  state.selectedId = id;
  setPage("structure");
  renderTree();
  renderDetail();
}

function setPage(page) {
  state.page = page;
  $$(".nk-page").forEach((section) => section.classList.toggle("active", section.dataset.page === page));
  $$('[data-nav-page]').forEach((button) => button.classList.toggle("active", button.dataset.navPage === page));
  $("#topTitle").textContent = { home: "홈", structure: "구조", archive: "보관함", settings: "설정" }[page] || "다음 한칸";
  if (page === "archive") renderArchive();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openOverlay(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeOverlay(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = true;
  document.body.style.overflow = "";
}
function openAddModal() { openOverlay("addModal"); }

function parentOptions(type, selectedParentId = null) {
  const parentType = TYPE_META[type]?.parentType;
  if (!parentType) return `<option value="">상위 연결 없음</option>`;
  const candidates = sorted(state.items.filter((item) => item.type === parentType && item.status === "active"));
  return [`<option value="">상위 연결 없음</option>`, ...candidates.map((item) => `<option value="${item.id}" ${selectedParentId === item.id ? "selected" : ""}>${TYPE_META[item.type].icon} ${escapeHtml(item.title)}</option>`)].join("");
}

function openItemForm(type, parentId = null, item = null) {
  const meta = TYPE_META[type];
  if (!meta) return;
  closeOverlay("addModal");
  $("#itemId").value = item?.id || "";
  $("#itemType").value = type;
  $("#itemTitle").value = item?.title || "";
  $("#itemDescription").value = item?.description || "";
  $("#itemStartDate").value = item?.start_date || "";
  $("#itemDueDate").value = item?.due_date || "";
  $("#itemParent").innerHTML = parentOptions(type, item?.parent_id ?? parentId);
  $("#itemParent").disabled = !meta.parentType;
  $("#itemFormKicker").textContent = item ? "EDIT" : "CREATE";
  $("#itemFormTitle").textContent = item ? `${meta.label} 수정` : `새 ${meta.label}`;
  $("#itemFormHint").textContent = meta.parentType ? `${meta.label}은 ${TYPE_META[meta.parentType].label}에 연결할 수도 있고 독립적으로 둘 수도 있어요.` : "정체성은 가장 위 단계라 상위 연결이 없어요.";
  $("#itemFormMessage").textContent = "";
  openOverlay("itemFormModal");
  setTimeout(() => $("#itemTitle").focus(), 0);
}

async function saveItem(event) {
  event.preventDefault();
  if (!state.user) return;
  const id = $("#itemId").value || null;
  const type = $("#itemType").value;
  const title = $("#itemTitle").value.trim();
  if (!title) return $("#itemFormMessage").textContent = "제목을 입력해 주세요.";

  const parentId = $("#itemParent").disabled ? null : ($("#itemParent").value || null);
  const payload = {
    type,
    title,
    description: $("#itemDescription").value.trim() || null,
    parent_id: parentId,
    start_date: $("#itemStartDate").value || null,
    due_date: $("#itemDueDate").value || null,
  };

  $("#saveItemButton").disabled = true;
  $("#itemFormMessage").textContent = "";
  setSync("저장 중...");
  try {
    let saved;
    if (id) {
      const { data, error } = await supabase.from("structure_items").update(payload).eq("id", id).select().single();
      if (error) throw error;
      saved = data;
    } else {
      const siblingOrders = state.items.filter((item) => (item.parent_id || null) === parentId).map((item) => Number(item.sort_order) || 0);
      payload.user_id = state.user.id;
      payload.sort_order = (siblingOrders.length ? Math.max(...siblingOrders) : 0) + 10;
      const { data, error } = await supabase.from("structure_items").insert(payload).select().single();
      if (error) throw error;
      saved = data;
    }
    state.selectedId = saved.id;
    closeOverlay("itemFormModal");
    await loadData();
    setPage("structure");
  } catch (error) {
    console.error("항목 저장 실패", error);
    $("#itemFormMessage").textContent = error?.message || "저장하지 못했어요.";
    setSync("저장 실패", true);
  } finally {
    $("#saveItemButton").disabled = false;
  }
}

async function updateStatus(id, status) {
  const item = getItem(id);
  if (!item) return;
  setSync("저장 중...");
  const now = new Date().toISOString();
  const payload = { status, completed_at: status === "completed" ? now : null, archived_at: status === "archived" ? now : null };
  try {
    const { error } = await supabase.from("structure_items").update(payload).eq("id", id);
    if (error) throw error;
    await loadData();
  } catch (error) {
    console.error("상태 변경 실패", error);
    setSync("저장 실패", true);
    alert("상태를 변경하지 못했어요.");
  }
}

async function deleteItem(item) {
  const childCount = childrenOf(item.id, { includeInactive: true }).length;
  const extra = childCount ? `\n하위 ${childCount}개 항목은 삭제되지 않고 상위 연결만 풀립니다.` : "";
  if (!confirm(`‘${item.title}’을 정말 삭제할까요?${extra}`)) return;
  setSync("삭제 중...");
  try {
    const { error } = await supabase.from("structure_items").delete().eq("id", item.id);
    if (error) throw error;
    state.selectedId = null;
    state.expanded.delete(item.id);
    persistViewState();
    await loadData({ keepSelection: false });
  } catch (error) {
    console.error("삭제 실패", error);
    setSync("삭제 실패", true);
    alert("삭제하지 못했어요.");
  }
}

async function setFocus(id) {
  const item = getItem(id);
  if (!item || item.type !== "next_step" || item.status !== "active") return;
  setSync("저장 중...");
  try {
    const { error } = await supabase.from("user_focus").upsert({ user_id: state.user.id, current_item_id: id }, { onConflict: "user_id" });
    if (error) throw error;
    state.focusId = id;
    renderHome();
    renderDetail();
    setSync("저장됨");
  } catch (error) {
    console.error("지금 한칸 지정 실패", error);
    setSync("저장 실패", true);
    alert("지금 한칸으로 지정하지 못했어요.");
  }
}

function addBreakdownInput(value = "") {
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 160;
  input.placeholder = "예: 레퍼런스 3개 찾기";
  input.value = value;
  input.addEventListener("input", syncBreakdownChoices);
  $("#breakdownInputs").appendChild(input);
}
function syncBreakdownChoices() {
  const rows = $$("#breakdownInputs input").map((input, domIndex) => ({ title: input.value.trim(), domIndex })).filter((row) => row.title);
  $("#breakdownChoices").innerHTML = rows.length ? rows.map((row, index) => `<label class="nk-choice"><input type="radio" name="nextChoice" value="${row.domIndex}" ${index === 0 ? "checked" : ""} /><span>${escapeHtml(row.title)}</span></label>`).join("") : `<div class="nk-empty">단계를 하나 이상 적어주세요.</div>`;
}
function openBreakdown(task) {
  state.breakdownTaskId = task.id;
  $("#breakdownTaskTitle").textContent = task.title;
  $("#breakdownInputs").innerHTML = "";
  addBreakdownInput(); addBreakdownInput(); addBreakdownInput();
  $("#breakdownMessage").textContent = "";
  syncBreakdownChoices();
  openOverlay("breakdownModal");
  setTimeout(() => $("#breakdownInputs input")?.focus(), 0);
}
async function saveBreakdown() {
  const task = getItem(state.breakdownTaskId);
  if (!task || task.type !== "task") return;
  const filled = $$("#breakdownInputs input").map((input, domIndex) => ({ title: input.value.trim(), domIndex })).filter((row) => row.title);
  if (!filled.length) return $("#breakdownMessage").textContent = "단계를 하나 이상 적어주세요.";

  const selectedDomIndex = Number($('input[name="nextChoice"]:checked')?.value ?? filled[0].domIndex);
  const currentOrders = childrenOf(task.id, { includeInactive: true }).map((item) => Number(item.sort_order) || 0);
  const baseOrder = currentOrders.length ? Math.max(...currentOrders) : 0;
  const rows = filled.map((row, index) => ({ user_id: state.user.id, type: "next_step", title: row.title, parent_id: task.id, status: "active", sort_order: baseOrder + ((index + 1) * 10) }));

  $("#saveBreakdown").disabled = true;
  $("#breakdownMessage").textContent = "";
  setSync("저장 중...");
  try {
    const { data, error } = await supabase.from("structure_items").insert(rows).select();
    if (error) throw error;
    const selectedIndex = Math.max(filled.findIndex((row) => row.domIndex === selectedDomIndex), 0);
    const selectedRow = data?.[selectedIndex];
    if (selectedRow?.id) {
      const { error: focusError } = await supabase.from("user_focus").upsert({ user_id: state.user.id, current_item_id: selectedRow.id }, { onConflict: "user_id" });
      if (focusError) throw focusError;
    }
    state.selectedId = task.id;
    closeOverlay("breakdownModal");
    await loadData();
  } catch (error) {
    console.error("작업 쪼개기 저장 실패", error);
    $("#breakdownMessage").textContent = error?.message || "저장하지 못했어요.";
    setSync("저장 실패", true);
  } finally {
    $("#saveBreakdown").disabled = false;
  }
}

function initNavigation() {
  $$('[data-nav-page]').forEach((button) => button.addEventListener("click", () => setPage(button.dataset.navPage)));
  $("#fab")?.addEventListener("click", openAddModal);
  $("#topAdd")?.addEventListener("click", openAddModal);
  $("#structureAdd")?.addEventListener("click", openAddModal);
  $$('[data-create-type]').forEach((button) => button.addEventListener("click", () => openItemForm(button.dataset.createType)));
  $$('[data-close-overlay]').forEach((button) => button.addEventListener("click", () => closeOverlay(button.dataset.closeOverlay)));
  $$(".nk-overlay").forEach((overlay) => overlay.addEventListener("click", (event) => { if (event.target === overlay) closeOverlay(overlay.id); }));
  $$('[data-filter]').forEach((button) => button.addEventListener("click", () => { state.filter = button.dataset.filter; persistViewState(); renderTree(); renderFilters(); }));
  $$('[data-direction]').forEach((button) => button.addEventListener("click", () => { state.direction = button.dataset.direction; persistViewState(); renderTree(); renderDirectionControls(); }));
  $("#toggleAllTree")?.addEventListener("click", () => {
    const ids = [...new Set(getVisibleExpandableIds())];
    const allExpanded = ids.length > 0 && ids.every((id) => state.expanded.has(id));
    if (allExpanded) ids.forEach((id) => state.expanded.delete(id)); else ids.forEach((id) => state.expanded.add(id));
    persistViewState(); renderTree(); renderDirectionControls();
  });
  $("#itemForm")?.addEventListener("submit", saveItem);
  $("#addBreakdownInput")?.addEventListener("click", () => { addBreakdownInput(); syncBreakdownChoices(); });
  $("#saveBreakdown")?.addEventListener("click", saveBreakdown);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeOverlay("addModal"); closeOverlay("itemFormModal"); closeOverlay("breakdownModal");
  });
}

function initAuth() {
  $("#authForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    if (!email || !password) return showAuthMessage("이메일과 비밀번호를 입력해 주세요.");
    setAuthLoading(true); showAuthMessage("로그인 중...");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) await activateUser(data.user);
    } catch (error) {
      console.error("로그인 실패", error);
      showAuthMessage(friendlyAuthError(error));
    } finally { setAuthLoading(false); }
  });

  $("#signupButton")?.addEventListener("click", async () => {
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    if (!email || !password) return showAuthMessage("이메일과 비밀번호를 입력해 주세요.");
    if (password.length < 6) return showAuthMessage("비밀번호는 6자 이상으로 입력해 주세요.");
    setAuthLoading(true); showAuthMessage("계정을 만드는 중...");
    try {
      const redirectUrl = `${location.origin}${location.pathname}`;
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl } });
      if (error) throw error;
      if (data.session?.user) await activateUser(data.user); else showAuthMessage("가입 요청 완료! 받은 이메일의 인증 링크를 눌러 주세요.");
    } catch (error) {
      console.error("회원가입 실패", error);
      showAuthMessage(friendlyAuthError(error));
    } finally { setAuthLoading(false); }
  });

  $$('[data-logout]').forEach((button) => button.addEventListener("click", async () => { await supabase.auth.signOut(); showLoggedOut(); }));
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED") return;
    setTimeout(async () => {
      if (session?.user) {
        if (state.user?.id !== session.user.id) await activateUser(session.user);
      } else if (event === "SIGNED_OUT") showLoggedOut();
    }, 0);
  });
}

async function activateUser(user) {
  showLoggedIn(user);
  try { await loadData({ keepSelection: false }); }
  catch (error) {
    console.error("데이터 불러오기 실패", error);
    setSync("불러오기 실패", true);
    alert("다음 한칸 데이터를 불러오지 못했어요.");
  }
}

async function boot() {
  initNavigation();
  initAuth();
  renderFilters();
  renderDirectionControls();
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (session?.user) await activateUser(session.user); else showLoggedOut();
  } catch (error) {
    console.error("로그인 상태 확인 실패", error);
    showLoggedOut();
    showAuthMessage("로그인 상태를 확인하지 못했어요. 새로고침 후 다시 시도해 주세요.");
  }
}

boot();
