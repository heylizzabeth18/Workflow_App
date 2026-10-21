/* LTV ICT Workflow — browser client.
   Replace the two placeholders below with values from Supabase > Project Settings > API.
   Use only the publishable/anon key in this browser app. Never put a service-role key here. */
const SUPABASE_URL = "https://bzyqzkqnjxpkslvzfsuv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5HlbuwyHf9Nf-6-bNIMI0Q_EjRmiyca";

const configured = !SUPABASE_URL.startsWith("YOUR_") &&
                   !SUPABASE_ANON_KEY.startsWith("YOUR_");
const db = configured && window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { projects: [], tasks: [], profiles: [], user: null, view: "dashboard" };

const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const prettyDate = (value) => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {day:"numeric",month:"short",year:"numeric"})
  : "No deadline";
const slug = (value = "") => value.toLowerCase().replace(/\s+/g, "-");
const isOverdue = task => task.due_date && task.due_date < new Date().toISOString().slice(0,10) && task.status !== "Completed";

function showNotice(message, error = false) {
  const box = $("#notice");
  box.textContent = message;
  box.classList.toggle("error", error);
  box.classList.remove("hidden");
  window.setTimeout(() => box.classList.add("hidden"), 5000);
}
function showLogin(message = "") {
  $("#login-screen").classList.remove("hidden");
  $("#app").classList.add("hidden");
  $("#login-message").textContent = message;
}
function showApp() {
  $("#login-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#signed-in-email").textContent = state.user?.email || "ICT team member";
  $("#today-label").textContent = new Date().toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric"});
}
function setView(view) {
  state.view = view;
  $$(".view").forEach(section => section.classList.toggle("hidden", section.id !== `${view}-view`));
  $$(".nav-link[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  $("#page-title").textContent = ({dashboard:"Dashboard",projects:"Projects",tasks:"Tasks"})[view] || "Dashboard";
}
function statusBadge(status) {
  return `<span class="badge ${slug(status)}">${escapeHTML(status)}</span>`;
}
function profileName(id) {
  const profile = state.profiles.find(person => person.id === id);
  return profile?.full_name || profile?.email || "Unassigned";
}
function projectName(id) {
  return state.projects.find(project => project.id === id)?.name || "Unknown project";
}

async function loadData() {
  if (!db) {
    showLogin("Setup needed: add your Supabase URL and publishable/anon key in script.js.");
    return;
  }
  const [projects, tasks, profiles] = await Promise.all([
    db.from("projects").select("*").order("created_at", {ascending:false}),
    db.from("tasks").select("*").order("created_at", {ascending:false}),
    db.from("profiles").select("id, full_name, email").order("full_name")
  ]);
  const failed = [projects, tasks, profiles].find(result => result.error);
  if (failed) {
    console.error(failed.error);
    showNotice(`Could not load data: ${failed.error.message}`, true);
    return;
  }
  state.projects = projects.data || [];
  state.tasks = tasks.data || [];
  state.profiles = profiles.data || [];
  renderAll();
}
function renderAll() {
  renderDashboard();
  renderProjects();
  renderTasks();
  populateSelects();
}
function renderDashboard() {
  const open = state.tasks.filter(task => task.status !== "Completed");
  $("#stat-projects").textContent = state.projects.length;
  $("#stat-open").textContent = open.length;
  $("#stat-completed").textContent = state.tasks.filter(task => task.status === "Completed").length;
  $("#stat-overdue").textContent = open.filter(isOverdue).length;

  const recent = state.tasks.slice(0,5);
  $("#recent-tasks").innerHTML = recent.length ? recent.map(task => `
    <div class="task-row"><div><div class="task-name">${escapeHTML(task.title)}</div>
    <div class="task-sub">${escapeHTML(projectName(task.project_id))} · Due ${escapeHTML(prettyDate(task.due_date))}</div></div>
    ${statusBadge(task.status)}</div>`).join("") : `<p class="muted">No tasks yet. Create a task to get started.</p>`;

  const projects = state.projects.slice(0,5);
  $("#project-overview").innerHTML = projects.length ? projects.map(project => {
    const related = state.tasks.filter(task => task.project_id === project.id);
    const done = related.filter(task => task.status === "Completed").length;
    const percent = related.length ? Math.round(done / related.length * 100) : 0;
    return `<div class="project-row"><div><div class="task-name">${escapeHTML(project.name)}</div>
      <div class="task-sub">${related.length} task${related.length === 1 ? "" : "s"} · ${percent}% complete</div></div>
      ${statusBadge(project.status)}</div>`;
  }).join("") : `<p class="muted">No projects yet. Create your first project.</p>`;
}
function renderProjects() {
  $("#projects-grid").innerHTML = state.projects.length ? state.projects.map(project => {
    const related = state.tasks.filter(task => task.project_id === project.id);
    const done = related.filter(task => task.status === "Completed").length;
    const percent = related.length ? Math.round(done / related.length * 100) : 0;
    return `<article class="project-card">${statusBadge(project.status)}
      <h3>${escapeHTML(project.name)}</h3>
      <p>${escapeHTML(project.description || "No project description provided.")}</p>
      <div class="project-meta"><span>${related.length} tasks · ${percent}% done</span><span>${escapeHTML(prettyDate(project.due_date))}</span></div>
    </article>`;
  }).join("") : `<div class="panel" style="padding:24px"><p class="muted">No projects yet. Select “Create project” to add one.</p></div>`;
}
function renderTasks() {
  const query = ($("#task-search")?.value || "").trim().toLowerCase();
  const status = $("#status-filter")?.value || "";
  const priority = $("#priority-filter")?.value || "";
  const tasks = state.tasks.filter(task =>
    `${task.title} ${task.description || ""} ${projectName(task.project_id)} ${profileName(task.assignee_id)}`.toLowerCase().includes(query) &&
    (!status || task.status === status) &&
    (!priority || task.priority === priority)
  );
  $("#tasks-table").innerHTML = tasks.length ? tasks.map(task => `
    <tr><td>${escapeHTML(task.title)}${isOverdue(task) ? '<div class="task-sub" style="color:#c9353d">Overdue</div>' : ""}</td>
    <td>${escapeHTML(projectName(task.project_id))}</td><td>${escapeHTML(profileName(task.assignee_id))}</td>
    <td>${statusBadge(task.priority)}</td><td>${escapeHTML(prettyDate(task.due_date))}</td>
    <td><select class="inline-select status-change" data-id="${escapeHTML(task.id)}" aria-label="Change status for ${escapeHTML(task.title)}">
      ${["To Do","In Progress","Blocked","Completed"].map(option => `<option ${task.status === option ? "selected" : ""}>${option}</option>`).join("")}
    </select></td></tr>`).join("") :
    `<tr><td colspan="6" class="muted">No tasks match these filters.</td></tr>`;

  $$(".status-change").forEach(select => select.addEventListener("change", async event => {
    const id = event.currentTarget.dataset.id;
    const nextStatus = event.currentTarget.value;
    const { error } = await db.from("tasks").update({status:nextStatus}).eq("id", id);
    if (error) { showNotice(`Could not update task: ${error.message}`, true); await loadData(); return; }
    await loadData();
    showNotice("Task status updated.");
  }));
}
function populateSelects() {
  const projectSelect = $("#task-project");
  const oldProject = projectSelect.value;
  projectSelect.innerHTML = `<option value="">Choose a project</option>` + state.projects
    .filter(project => project.status !== "Completed")
    .map(project => `<option value="${escapeHTML(project.id)}">${escapeHTML(project.name)}</option>`).join("");
  if (state.projects.some(project => project.id === oldProject)) projectSelect.value = oldProject;

  const assigneeSelect = $("#task-assignee");
  const oldAssignee = assigneeSelect.value;
  assigneeSelect.innerHTML = `<option value="">Unassigned</option>` + state.profiles
    .map(person => `<option value="${escapeHTML(person.id)}">${escapeHTML(person.full_name || person.email || "Team member")}</option>`).join("");
  if (state.profiles.some(person => person.id === oldAssignee)) assigneeSelect.value = oldAssignee;
}

async function createProject(event) {
  event.preventDefault();
  $("#project-error").textContent = "";
  const project = {
    name: $("#project-name").value.trim(),
    description: $("#project-description").value.trim() || null,
    status: $("#project-status").value,
    due_date: $("#project-due").value || null,
    created_by: state.user.id
  };
  const { error } = await db.from("projects").insert(project);
  if (error) { $("#project-error").textContent = error.message; return; }
  $("#project-form").reset();
  $("#project-dialog").close();
  await loadData();
  setView("projects");
  showNotice("Project created successfully.");
}
async function createTask(event) {
  event.preventDefault();
  $("#task-error").textContent = "";
  const task = {
    title: $("#task-title").value.trim(),
    description: $("#task-description").value.trim() || null,
    project_id: $("#task-project").value,
    assignee_id: $("#task-assignee").value || null,
    priority: $("#task-priority").value,
    status: $("#task-status").value,
    due_date: $("#task-due").value || null,
    created_by: state.user.id
  };
  const { error } = await db.from("tasks").insert(task);
  if (error) { $("#task-error").textContent = error.message; return; }
  $("#task-form").reset();
  $("#task-dialog").close();
  await loadData();
  setView("tasks");
  showNotice("Task created successfully.");
}
async function start() {
  if (!db) {
    showLogin("Before signing in, configure your Supabase URL and publishable/anon key in script.js.");
    return;
  }
  const { data, error } = await db.auth.getSession();
  if (error) { showLogin(error.message); return; }
  if (data.session) {
    state.user = data.session.user;
    showApp();
    await loadData();
  } else {
    showLogin();
  }
}

$("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!db) { showLogin("Configure Supabase credentials in script.js first."); return; }
  $("#login-message").textContent = "Signing in…";
  const { data, error } = await db.auth.signInWithPassword({
    email: $("#email").value.trim(),
    password: $("#password").value
  });
  if (error) { $("#login-message").textContent = error.message; return; }
  state.user = data.user;
  showApp();
  await loadData();
});
$("#sign-out").addEventListener("click", async () => {
  if (db) await db.auth.signOut();
  state.user = null;
  showLogin("You have signed out.");
});
$$("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
$$("[data-go]").forEach(button => button.addEventListener("click", () => setView(button.dataset.go)));
$("#new-project").addEventListener("click", () => $("#project-dialog").showModal());
$("#new-project-top").addEventListener("click", () => $("#project-dialog").showModal());
$("#new-task").addEventListener("click", () => {
  if (!state.projects.length) { showNotice("Create a project before adding tasks.", true); setView("projects"); return; }
  $("#task-dialog").showModal();
});
$("#new-task-top").addEventListener("click", () => {
  if (!state.projects.length) { showNotice("Create a project before adding tasks.", true); setView("projects"); return; }
  $("#task-dialog").showModal();
});
$$("[data-close]").forEach(button => button.addEventListener("click", () => $(`#${button.dataset.close}`).close()));
$("#project-form").addEventListener("submit", createProject);
$("#task-form").addEventListener("submit", createTask);
$("#task-search").addEventListener("input", renderTasks);
$("#status-filter").addEventListener("change", renderTasks);
$("#priority-filter").addEventListener("change", renderTasks);

if (db) {
  db.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      state.user = null;
      showLogin();
    }
  });
}
start();
