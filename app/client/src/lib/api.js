const base = "/api";

async function request(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  people: () => request("/people"),
  person: (id) => request(`/people/${id}`),
  skills: () => request("/skills"),
  matrix: () => request("/matrix"),
  gaps: () => request("/gaps"),
  certifications: () => request("/certifications"),
  chat: (messages) =>
    request("/chat", { method: "POST", body: JSON.stringify({ messages }) }),
};
