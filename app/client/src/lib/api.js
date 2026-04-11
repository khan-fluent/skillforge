const base = "/api";

function getToken() {
  return localStorage.getItem("skillforge_token");
}

async function request(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, { ...opts, headers });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.error || `${res.status} request failed`;
    throw new Error(msg);
  }
  return body;
}

export const api = {
  // auth
  signup:  (data) => request("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  login:   (data) => request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  accept:  (data) => request("/auth/accept", { method: "POST", body: JSON.stringify(data) }),
  invite:  (token) => request(`/auth/invite/${token}`),
  me:      () => request("/auth/me"),
  authProviders: () => request("/auth/providers"),

  // team
  team:       () => request("/team"),
  updateTeam: (data) => request("/team", { method: "PUT", body: JSON.stringify(data) }),

  // members
  members:       () => request("/members"),
  member:        (id) => request(`/members/${id}`),
  createMember:  (data) => request("/members", { method: "POST", body: JSON.stringify(data) }),
  updateMember:  (id, data) => request(`/members/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMember:  (id) => request(`/members/${id}`, { method: "DELETE" }),
  reinviteMember:(id) => request(`/members/${id}/reinvite`, { method: "POST" }),

  // skills
  skills:      () => request("/skills"),
  createSkill:    (data) => request("/skills", { method: "POST", body: JSON.stringify(data) }),
  bulkAddSkills:  (skills) => request("/skills/bulk", { method: "POST", body: JSON.stringify({ skills }) }),
  generateSkills: (description) => request("/skills/generate", { method: "POST", body: JSON.stringify({ description }) }),
  updateSkill:    (id, data) => request(`/skills/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSkill:    (id) => request(`/skills/${id}`, { method: "DELETE" }),

  // proficiencies
  setProficiency: (data) => request("/proficiencies", { method: "POST", body: JSON.stringify(data) }),

  // matrix + gaps + certs + chat
  matrix:         () => request("/matrix"),
  gaps:           () => request("/gaps"),
  certifications: () => request("/certifications"),
  createCert:     (data) => request("/certifications", { method: "POST", body: JSON.stringify(data) }),
  updateCert:     (id, data) => request(`/certifications/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCert:     (id) => request(`/certifications/${id}`, { method: "DELETE" }),
  chat:           (messages, sessionId) => request("/chat", { method: "POST", body: JSON.stringify({ messages, session_id: sessionId }) }),
  chatSessions:   () => request("/chat/sessions"),
  createSession:  (title) => request("/chat/sessions", { method: "POST", body: JSON.stringify({ title }) }),
  getSession:     (id) => request(`/chat/sessions/${id}`),
  updateSession:  (id, data) => request(`/chat/sessions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSession:  (id) => request(`/chat/sessions/${id}`, { method: "DELETE" }),

  // knowledge base
  kbFolders:       () => request("/kb/folders"),
  createKbFolder:  (data) => request("/kb/folders", { method: "POST", body: JSON.stringify(data) }),
  updateKbFolder:  (id, data) => request(`/kb/folders/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteKbFolder:  (id) => request(`/kb/folders/${id}`, { method: "DELETE" }),
  kbDocuments:     (folderId) => request(`/kb/documents${folderId ? `?folder_id=${folderId}` : ""}`),
  kbDocument:      (id) => request(`/kb/documents/${id}`),
  createKbDoc:     (data) => request("/kb/documents", { method: "POST", body: JSON.stringify(data) }),
  updateKbDoc:     (id, data) => request(`/kb/documents/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteKbDoc:     (id) => request(`/kb/documents/${id}`, { method: "DELETE" }),
  kbSearch:        (q) => request(`/kb/search?q=${encodeURIComponent(q)}`),
  kbStats:         () => request("/kb/stats"),
  kbBySkill:       (skillId) => request(`/kb/by-skill/${skillId}`),

  // domains
  domains:           () => request("/domains"),
  createDomain:      (data) => request("/domains", { method: "POST", body: JSON.stringify(data) }),
  updateDomain:      (id, data) => request(`/domains/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteDomain:      (id) => request(`/domains/${id}`, { method: "DELETE" }),
  setDomainProf:     (data) => request("/domains/proficiencies", { method: "POST", body: JSON.stringify(data) }),
  domainGaps:        () => request("/domains/gaps"),
  domainMatrix:      () => request("/domains/matrix"),

  // insights
  insights:        () => request("/insights"),

  // upskill
  upskillPlans:    () => request("/upskill"),
  upskillPlan:     (id) => request(`/upskill/${id}`),
  createUpskill:   (data) => request("/upskill", { method: "POST", body: JSON.stringify(data) }),
  updateUpskill:   (id, data) => request(`/upskill/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUpskill:   (id) => request(`/upskill/${id}`, { method: "DELETE" }),
  toggleStep:      (id, completed) => request(`/upskill/steps/${id}`, { method: "PUT", body: JSON.stringify({ completed }) }),
  generateUpskill: (data) => request("/upskill/generate", { method: "POST", body: JSON.stringify(data) }),

  // jira / tickets
  jiraSummary:    () => request("/jira/summary"),
  jiraConnection: () => request("/jira/connection"),
  setJiraConnection:    (data) => request("/jira/connection", { method: "POST", body: JSON.stringify(data) }),
  deleteJiraConnection: () => request("/jira/connection", { method: "DELETE" }),
  jiraFilters:    () => request("/jira/filters"),
  createJiraFilter: (data) => request("/jira/filters", { method: "POST", body: JSON.stringify(data) }),
  deleteJiraFilter: (id) => request(`/jira/filters/${id}`, { method: "DELETE" }),
  jiraSync:       () => request("/jira/sync", { method: "POST" }),
};

export const auth = {
  saveToken: (t) => localStorage.setItem("skillforge_token", t),
  clearToken: () => localStorage.removeItem("skillforge_token"),
  hasToken: () => !!getToken(),
};
