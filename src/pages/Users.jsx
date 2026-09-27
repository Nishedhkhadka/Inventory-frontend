import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, KeyRound, X, Loader2 } from "lucide-react";
import { fetchUsers, createUser, deleteUser, resetUserPassword } from "../api/auth";
import { useAuth } from "../context/AuthContext";

const emptyForm = { username: "", password: "", role: "user" };

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(() => {
    fetchUsers().then(setUsers);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createUser(form);
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Delete user "${u.username}"? This can't be undone.`)) return;
    await deleteUser(u.id);
    load();
  };

  const handleResetPassword = async (u) => {
    if (!newPassword || newPassword.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }
    await resetUserPassword(u.id, newPassword);
    setResettingId(null);
    setNewPassword("");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl sm:text-2xl text-ink">Users</h1>
          <p className="text-sm text-muted mt-1">
            Admins see every dashboard metric and can manage users. Regular users get a simplified
            dashboard with no financial figures.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 bg-ink text-paper text-sm px-4 py-2 rounded-md hover:bg-moss-dark transition-colors"
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? "Cancel" : "New user"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-line rounded-lg p-5 space-y-3">
          <input
            required
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
          />
          <input
            required
            type="password"
            placeholder="Password (min. 8 characters)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
          >
            <option value="user">User — simplified dashboard, no financial figures</option>
            <option value="admin">Admin — full access, can manage users</option>
          </select>
          {error && <p className="text-sm text-clay">{error}</p>}
          <button
            disabled={saving}
            className="bg-moss text-white text-sm rounded-md py-2 px-6 hover:bg-moss-dark disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create user"}
          </button>
        </form>
      )}

      <div className="bg-card border border-line rounded-lg divide-y divide-line">
        {users.map((u) => (
          <div key={u.id} className="px-5 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink font-medium">
                {u.username}
                {u.id === currentUser?.id && <span className="text-muted font-normal"> (you)</span>}
              </p>
              <p className="text-xs text-muted capitalize">{u.role}</p>
            </div>

            {resettingId === u.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="px-2 py-1.5 text-sm bg-paper rounded-md border border-line"
                  autoFocus
                />
                <button
                  onClick={() => handleResetPassword(u)}
                  className="text-xs bg-moss text-white px-3 py-1.5 rounded-md hover:bg-moss-dark"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setResettingId(null);
                    setNewPassword("");
                  }}
                  className="text-muted hover:text-ink"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setResettingId(u.id)}
                  className="text-muted hover:text-moss-dark"
                  title="Reset password"
                >
                  <KeyRound size={14} />
                </button>
                {u.id !== currentUser?.id && (
                  <button onClick={() => handleDelete(u)} className="text-muted hover:text-clay" title="Delete user">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </p>
        )}
      </div>
    </div>
  );
}
