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
  createSkill: (data) => request("/skills", { method: "POST", body: JSON.stringify(data) }),
  deleteSkill: (id) => request(`/skills/${id}`, { method: "DELETE" }),

  // proficiencies
  setProficiency: (data) => request("/proficiencies", { method: "POST", body: JSON.stringify(data) }),

  // matrix + gaps + certs + chat
  matrix:         () => request("/matrix"),
  gaps:           () => request("/gaps"),
  certifications: () => request("/certifications"),
  createCert:     (data) => request("/certifications", { method: "POST", body: JSON.stringify(data) }),
  deleteCert:     (id) => request(`/certifications/${id}`, { method: "DELETE" }),
  chat:           (messages) => request("/chat", { method: "POST", body: JSON.stringify({ messages }) }),
};

export const auth = {
  saveToken: (t) => localStorage.setItem("skillforge_token", t),
  clearToken: () => localStorage.removeItem("skillforge_token"),
  hasToken: () => !!getToken(),
};
