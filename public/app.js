const $ = (s) => document.querySelector(s),
  root = $("#app"),
  modal = $("#modal");
const paths = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  ticket: "M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6V4ZM9 8h6M9 12h4M9 16h6",
  shield: "M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-6",
  users:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M16 4a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  book: "M4 4h6l2 2 2-2h6v16h-6l-2 2-2-2H4V4Zm8 2v16",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1",
  moon: "M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z",
  plus: "M12 5v14M5 12h14",
  search: "M21 21l-5-5M18 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  logout: "M9 4H4v16h5m5-13 5 5-5 5M8 12h11",
  check: "m5 12 4 4L19 6",
  clock: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  close: "m6 6 12 12M6 18 18 6",
  monitor: "M3 4h18v13H3zM8 22h8m-4-5v5",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  person: "M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
};
const icon = (n) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[n] || paths.grid}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let user,
  tickets = [],
  view = "workspace",
  filter = "all",
  search = "",
  register = false,
  users = [];
let dark =
  localStorage.getItem("itdesk-theme") === "dark" ||
  (!localStorage.getItem("itdesk-theme") &&
    matchMedia("(prefers-color-scheme:dark)").matches);
document.body.classList.toggle("dark", dark);
const themeButton = () =>
  `<button class="icon-button" data-action="theme" aria-label="Switch to ${dark ? "light" : "dark"} theme">${icon(dark ? "sun" : "moon")}</button>`;
const initials = (n) =>
  esc(
    n
      .split(" ")
      .map((x) => x[0])
      .slice(0, 2)
      .join(""),
  );
const date = (s) =>
  new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").style.display = "none"), 4000);
}
async function api(path, options = {}) {
  const r = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await r.json();
  if (!r.ok) {
    if (r.status === 401 && user) {
      user = null;
      auth();
    }
    throw Error(body.error || "Request failed.");
  }
  return body;
}
const post = (path, body, method = "POST") =>
  api(path, { method, body: JSON.stringify(body) });
function auth() {
  root.innerHTML = `<main class="auth"><section class="auth-story"><div class="brand"><img src="/icon.svg" alt="">ITDesk<small>SERVICE WORKSPACE</small></div><div><div class="eyebrow">IT OPERATIONS / IDENTITY GATEWAY</div><h1>The next shift <br>starts <em>here.</em></h1><p>Your connection to the people, systems, and support that power your workday.</p><div class="signal-map"><div class="signal-line"><span>01 / CONNECT</span><b>People</b></div><div class="signal-line"><span>02 / RESOLVE</span><b>Systems</b></div><div class="signal-line"><span>03 / CONTINUE</span><b>Progress</b></div></div></div><div class="footer-label">ITDESK / CONNECTED SERVICE OPERATIONS</div></section><section class="auth-form-wrap">${themeButton()}<div class="auth-form"><div class="eyebrow">SECURE WORKSPACE ACCESS</div><h2>${register ? "Set up your identity" : "Enter your workspace."}</h2><p>${register ? "A little less waiting. A lot more getting things done." : "Sign in to keep your workday moving."}</p><form id="auth-form">${register ? '<div class="field"><label for="name">Full name</label><input id="name" name="name" autocomplete="name" required minlength="2" maxlength="80" placeholder="Jamie Chen"></div>' : ""}<div class="field"><label for="email">Work email</label><input id="email" name="email" type="email" required autocomplete="email" placeholder="you@company.com"></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" required autocomplete="${register ? "new-password" : "current-password"}" minlength="${register ? "10" : "1"}" maxlength="128" placeholder="${register ? "At least 10 characters" : "Enter your password"}"></div><div id="form-error" class="error" role="alert"></div><button class="primary" type="submit">${register ? "Create account" : "Sign in to workspace"} ${icon("arrow")}</button></form><button class="switch" data-action="register">${register ? "Already have an account? Sign in" : "New to ITDesk? Create an account"}</button><div class="demo-box"><p>EXPLORE THE DEMO · Choose a role to see its workspace</p><div class="demo-buttons"><button data-demo="user">Employee</button><button data-demo="agent">Support agent</button><button data-demo="admin">Admin</button></div><p style="margin-top:12px">Shared sample workspace. Use fictional information.</p></div></div></section></main>`;
  $("#auth-form").onsubmit = async (e) => {
    e.preventDefault();
    const b = e.submitter;
    b.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(e.target));
      const r = await post("/auth/" + (register ? "register" : "login"), data);
      user = r.user;
      view = "workspace";
      await refresh();
    } catch (e) {
      $("#form-error").textContent = e.message;
    } finally {
      b.disabled = false;
    }
  };
}
async function refresh() {
  tickets = await api("/tickets");
  if (user.role === "admin") users = await api("/admin/users");
  render();
}
const title = () =>
  ({
    workspace: "Service workspace",
    access: "Access & people",
    knowledge: "Support guide",
    account: "Your account",
  })[view];
function render() {
  root.innerHTML = `<div class="shell"><aside class="rail"><img src="/icon.svg" alt="ITDesk"><nav>${[
    ["workspace", "ticket", "Workspace"],
    ["access", "shield", "Access"],
    ["knowledge", "book", "Guide"],
    ["account", "person", "Account"],
  ]
    .map(
      ([id, i, t]) =>
        `<button data-view="${id}" class="${view === id ? "active" : ""}" ${view === id ? 'aria-current="page"' : ""}>${icon(i)}${t}</button>`,
    )
    .join(
      "",
    )}</nav><div class="bottom"><button data-action="logout">${icon("logout")}Sign out</button></div></aside><div class="workspace"><header class="topbar"><div class="crumb"><strong>ITDesk</strong><span class="muted">/</span><span class="muted">${title()}</span></div><div class="actions"><span class="badge">${esc(user.role === "user" ? "Employee" : user.role === "agent" ? "Support agent" : "Administrator")}</span>${themeButton()}<button class="avatar" data-view="account" aria-label="Your account">${initials(user.name)}</button></div></header><main class="content"><div class="heading"><div><div class="eyebrow muted">OPERATIONS / IT SUPPORT</div><h1>${title()}</h1><p>${view === "workspace" ? "A clear view of what needs your attention." : view === "access" ? "The right access, for the right people." : view === "knowledge" ? "Practical answers for a smoother workday." : "Your workspace identity and session."}</p></div><div class="tools">${view === "workspace" ? `<button data-action="export" aria-label="Export tickets">${icon("download")}<span class="label">Export</span></button><button class="primary" data-action="new" aria-label="Create new ticket">${icon("plus")}<span class="label">New ticket</span></button>` : ""}</div></div><div class="console-layout"><div id="page"></div><aside class="context-panel"><div class="eyebrow">WORKSPACE BRIEF</div><div class="context-number">01<span>/ SERVICE DESK</span></div><h2>Support that<br>stays in sync.</h2><p>Track the work. Share the context. Keep every request moving.</p><div class="context-rule"></div><div class="eyebrow">YOUR ACCESS</div><h3>${esc(user.role === "user" ? "Employee workspace" : user.role === "agent" ? "Support operations" : "Administrator console")}</h3><p>${user.role === "admin" ? "Manage requests, assign support, and control workspace permissions." : user.role === "agent" ? "Review assigned requests and keep your team updated." : "Raise requests and follow their progress in one place."}</p><button data-view="knowledge">Open support guide ${icon("arrow")}</button><div class="context-bottom">${icon("shield")} ROLE-PROTECTED WORKSPACE</div></aside></div></main></div></div>`;
  if (view === "workspace") workspace();
  if (view === "access") accessPage();
  if (view === "knowledge") guide();
  if (view === "account") account();
}
function workspace() {
  const open = tickets.filter((t) => t.status === "open").length,
    active = tickets.filter((t) => t.status === "in-progress").length,
    resolved = tickets.filter((t) =>
      ["resolved", "closed"].includes(t.status),
    ).length;
  $("#page").innerHTML =
    `<section class="overview"><div class="welcome"><div><div class="eyebrow">LIVE QUEUE / SERVICE OPERATIONS</div><h2>Every issue.<br>A clear next move.</h2><p>${user.role === "admin" ? "Manage the queue, connect the right people, and turn issues into progress." : user.role === "agent" ? "Your assigned cases, conversations, and next steps—all together." : "Track your requests and stay connected with your support team."}</p></div><div class="orb">${icon("monitor")}</div></div><div class="stats">${[
      [open, "Awaiting action", "ticket"],
      [active, "In progress", "clock"],
      [resolved, "Resolved / closed", "check"],
      [tickets.length, "Total requests", "grid"],
    ]
      .map(
        ([n, l, i]) =>
          `<div class="stat"><div><span>${l}</span><strong>${n.toString().padStart(2, "0")}</strong></div><i>${icon(i)}</i></div>`,
      )
      .join(
        "",
      )}</div></section><section class="queue"><div class="section-top"><div><h2>${user.role === "user" ? "Your requests" : user.role === "agent" ? "Assigned to you" : "Support queue"} <span class="badge">${tickets.length}</span></h2><p>Every request has a next step. Find yours here.</p></div><span class="date">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span></div><div class="filters"><div class="tabs" role="group" aria-label="Filter tickets">${[
      ["all", "All requests"],
      ["open", "Open"],
      ["in-progress", "In progress"],
      ["resolved", "Resolved"],
    ]
      .map(
        ([v, l]) =>
          `<button data-filter="${v}" class="${filter === v ? "selected" : ""}" aria-pressed="${filter === v}">${l}</button>`,
      )
      .join(
        "",
      )}</div><label class="search">${icon("search")}<input id="search" aria-label="Search tickets" placeholder="Search tickets…" value="${esc(search)}"></label></div><div id="ticket-list"></div></section><div class="support-strip"><span>${icon("shield")}Your workspace is protected with role-based access.</span><span>${icon("book")}Need a hand? <button data-view="knowledge">Read the support guide ${icon("arrow")}</button></span></div>`;
  list();
  $("#search").oninput = (e) => {
    search = e.target.value;
    list();
  };
}
function list() {
  const items = tickets.filter(
    (t) =>
      (filter === "all" ||
        t.status === filter ||
        (filter === "resolved" && t.status === "closed")) &&
      `${t.title} ${t.category} ${t.id} ${t.owner_name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  $("#ticket-list").innerHTML = items.length
    ? `<div class="table-wrap"><table><thead><tr><th>Request</th><th>Priority</th><th>Status</th><th>Assigned to</th><th>Created</th></tr></thead><tbody>${items.map((t) => `<tr class="ticket" data-ticket="${t.id}" tabindex="0" aria-label="Open ticket ${t.id}: ${esc(t.title)}"><td><div class="ticket-title">${esc(t.title)}</div><div class="ticket-sub">ITD-${String(t.id).padStart(4, "0")} &nbsp; / &nbsp; ${esc(t.category)} &nbsp; / &nbsp; ${esc(t.owner_name)}</div></td><td><span class="priority ${t.priority}"><span class="dot"></span>${esc(t.priority)}</span></td><td><span class="status ${t.status}">${esc(t.status.replace("-", " "))}</span></td><td>${esc(t.assignee_name || "Unassigned")}</td><td class="muted">${date(t.created)}</td></tr>`).join("")}</tbody></table></div><div class="queue-foot"><span>${items.length} request${items.length === 1 ? "" : "s"}</span><span>ITDesk · Service operations</span></div>`
    : `<div class="empty">${icon("ticket")}<h3>${search ? "No matching requests" : "All clear here."}</h3><p>${search ? "Try another keyword or filter." : "Create a ticket when you need a hand."}</p><button data-action="new">${icon("plus")}New ticket</button></div>`;
}
function openModal(title, body) {
  modal.innerHTML = `<div class="modal-header"><h2>${esc(title)}</h2><button class="icon-button" data-action="close" aria-label="Close dialog">${icon("close")}</button></div><div class="modal-body">${body}</div>`;
  if (!modal.open) modal.showModal();
}
function newTicket() {
  openModal(
    "Let’s get it sorted.",
    `<p class="muted">Tell us what’s happening. Your support team will take it from here.</p><form id="ticket-form"><div class="field"><label for="title">Request title</label><input name="title" id="title" required minlength="5" maxlength="120" placeholder="e.g. Cannot connect to the office VPN"></div><div class="field"><label for="description">What do we need to know?</label><textarea id="description" name="description" required minlength="10" maxlength="5000" placeholder="Describe the issue, what you tried, and how it affects your work."></textarea></div><div class="form-row"><div class="field"><label for="category">Category</label><select id="category" name="category">${["Hardware", "Software", "Network", "Access", "Other"].map((x) => `<option>${x}</option>`).join("")}</select></div><div class="field"><label for="priority">Priority</label><select id="priority" name="priority">${["low", "medium", "high", "urgent"].map((x) => `<option ${x === "medium" ? "selected" : ""}>${x}</option>`).join("")}</select></div></div><div class="error" id="modal-error" role="alert"></div><button class="primary">Submit request ${icon("arrow")}</button></form>`,
  );
  $("#ticket-form").onsubmit = async (e) => {
    e.preventDefault();
    e.submitter.disabled = true;
    try {
      const t = await post(
        "/tickets",
        Object.fromEntries(new FormData(e.target)),
      );
      modal.close();
      await refresh();
      toast(
        "Request submitted. Your ticket is ITD-" +
          String(t.id).padStart(4, "0"),
      );
    } catch (err) {
      $("#modal-error").textContent = err.message;
      e.submitter.disabled = false;
    }
  };
}
async function detail(id) {
  try {
    const t = await api("/tickets/" + id);
    openModal(
      "ITD-" + String(t.id).padStart(4, "0"),
      `<div class="detail-meta"><span class="status ${t.status}">${esc(t.status.replace("-", " "))}</span><span class="priority ${t.priority}"><span class="dot"></span>${esc(t.priority)}</span><span class="muted">${esc(t.category)}</span></div><h2>${esc(t.title)}</h2><p class="detail-desc">${esc(t.description)}</p><p class="muted">Requested by ${esc(t.owner_name)} · ${date(t.created)}<br>Assigned to ${esc(t.assignee_name || "No one yet")}</p>${
        user.role !== "user"
          ? `<form id="update-form"><div class="form-row"><div class="field"><label for="status">Status</label><select id="status" name="status">${["open", "in-progress", "resolved", "closed"].map((x) => `<option value="${x}" ${x === t.status ? "selected" : ""}>${x.replace("-", " ")}</option>`).join("")}</select></div><div class="field"><label for="edit-priority">Priority</label><select id="edit-priority" name="priority">${["low", "medium", "high", "urgent"].map((x) => `<option ${x === t.priority ? "selected" : ""}>${x}</option>`).join("")}</select></div></div>${
              user.role === "admin"
                ? `<div class="field"><label for="assignee">Assign to</label><select name="assignee" id="assignee"><option value="">Unassigned</option>${users
                    .filter((u) => u.role !== "user")
                    .map(
                      (u) =>
                        `<option value="${u.id}" ${t.assignee === u.id ? "selected" : ""}>${esc(u.name)}</option>`,
                    )
                    .join("")}</select></div>`
                : ""
            }<button type="submit">${icon("check")}Save changes</button></form>`
          : ""
      }<h3>Conversation <span class="badge">${t.comments.length}</span></h3>${t.comments.map((c) => `<div class="comment"><b>${esc(c.name)}</b><time>${date(c.created)}</time><p>${esc(c.body)}</p></div>`).join("") || '<p class="muted">No comments yet. Start the conversation.</p>'}<form id="comment-form"><div class="field"><label for="comment">Add a comment</label><textarea id="comment" name="body" required maxlength="2000" placeholder="Share an update or ask a question…"></textarea></div><button class="primary">Send comment ${icon("arrow")}</button></form><div class="error" id="modal-error" role="alert"></div>`,
    );
    if ($("#update-form"))
      $("#update-form").onsubmit = async (e) => {
        e.preventDefault();
        e.submitter.disabled = true;
        const data = Object.fromEntries(new FormData(e.target));
        if ("assignee" in data)
          data.assignee = data.assignee ? Number(data.assignee) : null;
        try {
          await post("/tickets/" + id, data, "PATCH");
          await refresh();
          await detail(id);
          toast("Ticket updated.");
        } catch (err) {
          $("#modal-error").textContent = err.message;
          e.submitter.disabled = false;
        }
      };
    $("#comment-form").onsubmit = async (e) => {
      e.preventDefault();
      e.submitter.disabled = true;
      try {
        await post(
          "/tickets/" + id + "/comments",
          Object.fromEntries(new FormData(e.target)),
        );
        await detail(id);
        toast("Comment added.");
      } catch (err) {
        $("#modal-error").textContent = err.message;
        e.submitter.disabled = false;
      }
    };
  } catch (e) {
    toast(e.message);
  }
}
async function accessPage() {
  if (user.role !== "admin") {
    $("#page").innerHTML =
      `<div class="card account-card">${icon("shield")}<h2>Access is part of good support.</h2><p>You are signed in as ${esc(user.role === "user" ? "an employee" : "a support agent")}. User management is available to administrators.</p><div class="notice">Your role is enforced by the server on every request. Hiding a button is only part of the experience.</div><button data-action="verify" style="margin-top:18px">Test protected endpoint ${icon("arrow")}</button><pre id="verify-result" class="notice" hidden></pre></div>`;
    return;
  }
  $("#page").innerHTML =
    `<section class="queue"><div class="section-top"><div><h2>People & permissions</h2><p>Manage workspace roles. Your own role and demo accounts are protected.</p></div><span class="badge">${users.length} MEMBERS</span></div><div class="users-wrap"><table class="users-table"><thead><tr><th>Team member</th><th>Email</th><th>Role</th></tr></thead><tbody>${users.map((u) => `<tr><td><strong>${esc(u.name)}</strong>${u.id === user.id ? ' <span class="badge">YOU</span>' : ""}</td><td>${esc(u.email)}</td><td><select class="role-select" aria-label="Role for ${esc(u.name)}" data-user="${u.id}" ${u.id === user.id ? "disabled" : ""}>${["user", "agent", "admin"].map((r) => `<option ${u.role === r ? "selected" : ""}>${r}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div></section><div class="heading" style="margin-top:28px"><h2>Activity log</h2><button data-action="audit">${icon("clock")}Refresh activity</button></div><div id="audit" class="card">Loading activity…</div>`;
  document.querySelectorAll("[data-user]").forEach(
    (el) =>
      (el.onchange = async () => {
        el.disabled = true;
        try {
          await post(
            "/admin/users/" + el.dataset.user + "/role",
            { role: el.value },
            "PATCH",
          );
          await refresh();
          toast("Role updated.");
        } catch (e) {
          toast(e.message);
          await refresh();
        }
      }),
  );
  await audit();
}
async function audit() {
  try {
    const items = await api("/admin/audit");
    if (!$("#audit")) return;
    $("#audit").innerHTML =
      items
        .map(
          (a) =>
            `<div class="comment"><b>${esc(a.action)}</b><time>${date(a.created)}</time><p class="muted">${esc(a.name || "System")}</p></div>`,
        )
        .join("") || "<p>No activity yet.</p>";
  } catch (e) {
    toast(e.message);
  }
}
function guide() {
  $("#page").innerHTML = `<div class="cards">${[
    [
      "ticket",
      "A useful request gets a faster answer.",
      "Include what happened, the impact, and any steps you tried. Never include passwords or private credentials.",
    ],
    [
      "clock",
      "Choose the right priority.",
      "Urgent: work has stopped. High: a major feature is blocked. Medium: work is affected. Low: a routine request or improvement.",
    ],
    [
      "shield",
      "Every role has a purpose.",
      "Employees can see their own tickets. Agents work on assigned tickets. Administrators manage the queue, people, and assignments.",
    ],
  ]
    .map(
      ([i, h, p]) =>
        `<article class="card">${icon(i)}<h3>${h}</h3><p>${p}</p></article>`,
    )
    .join(
      "",
    )}</div><div class="card" style="margin-top:20px"><h2>Before you submit</h2><p>Try restarting the affected application, checking the network connection, and noting any error message. For account access, tell us which system you need and why. Track progress and reply to your support agent from the ticket conversation.</p><button class="primary" data-action="new" aria-label="Create new ticket">${icon("plus")}Create a request</button></div>`;
}
function account() {
  $("#page").innerHTML =
    `<section class="card account-card"><span class="avatar">${initials(user.name)}</span><h2>${esc(user.name)}</h2><dl><dt>Email</dt><dd>${esc(user.email)}</dd><dt>Role</dt><dd>${esc(user.role)}</dd><dt>Session</dt><dd>Two hours from sign-in</dd></dl><div class="notice">Role changes are managed by an administrator. Theme preferences are saved on this device.</div><button data-action="logout" style="margin-top:24px">${icon("logout")}Sign out of ITDesk</button></section>`;
}
document.addEventListener("click", async (e) => {
  const el = e.target.closest("button,[data-ticket]");
  if (!el) return;
  try {
    if (el.dataset.view) {
      view = el.dataset.view;
      render();
    }
    if (el.dataset.filter) {
      filter = el.dataset.filter;
      workspace();
    }
    if (el.dataset.ticket) await detail(el.dataset.ticket);
    if (el.dataset.demo) {
      el.disabled = true;
      const r = await post("/auth/login", {
        email: el.dataset.demo + "@itdesk.demo",
        password: "DeskDemo!2026",
      });
      user = r.user;
      view = "workspace";
      await refresh();
    }
    switch (el.dataset.action) {
      case "theme":
        dark = !dark;
        document.body.classList.toggle("dark", dark);
        localStorage.setItem("itdesk-theme", dark ? "dark" : "light");
        if (user) render();
        else auth();
        break;
      case "register":
        register = !register;
        auth();
        break;
      case "new":
        newTicket();
        break;
      case "close":
        modal.close();
        break;
      case "logout":
        await post("/auth/logout", {});
        user = null;
        users = [];
        tickets = [];
        filter = "all";
        search = "";
        auth();
        break;
      case "audit":
        await audit();
        break;
      case "verify":
        try {
          await api("/admin/users");
        } catch (err) {
          const result = $("#verify-result");
          result.hidden = false;
          result.textContent = "403 Forbidden\n" + err.message;
        }
        break;
      case "export": {
        const cell = (v) =>
          '"' +
          String(v ?? "")
            .replaceAll('"', '""')
            .replace(/^[=+@-]/, "'$&") +
          '"';
        const csv = [
          ["ID", "Title", "Category", "Priority", "Status", "Assigned to"],
          ...tickets.map((t) => [
            t.id,
            t.title,
            t.category,
            t.priority,
            t.status,
            t.assignee_name,
          ]),
        ]
          .map((r) => r.map(cell).join(","))
          .join("\r\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "itdesk-requests.csv";
        a.click();
        URL.revokeObjectURL(url);
        toast("Ticket export downloaded.");
        break;
      }
    }
  } catch (err) {
    toast(err.message);
    el.disabled = false;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("[data-ticket]"))
    detail(e.target.dataset.ticket);
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    const r = modal.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      modal.close();
  }
});
(async () => {
  try {
    user = await api("/auth/me");
    await refresh();
  } catch {
    auth();
  }
})();
