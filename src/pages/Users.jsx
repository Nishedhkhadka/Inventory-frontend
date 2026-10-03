import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, KeyRound, X, Loader2, Check } from "lucide-react";
import {
  fetchUsers,
  createUser,
  deleteUser,
  resetUserPassword,
} from "../api/auth";
import { useAuth } from "../context/AuthContext";
import {
  DEFAULT_BUSINESS_PROFILE,
  getBusinessProfile,
  saveBusinessProfile,
} from "../utils/billing";

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
  const [profile, setProfile] = useState(DEFAULT_BUSINESS_PROFILE);

  const load = useCallback(() => {
    fetchUsers().then(setUsers);
  }, []);

  const saveProfile = (event) => {
    event.preventDefault();
    saveBusinessProfile(profile);
  };

  useEffect(() => {
    load();
    setProfile(getBusinessProfile());
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
            Admins see every dashboard metric and can manage users. Regular
            users get a simplified dashboard with no financial figures.
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
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-line rounded-lg p-5 space-y-3"
        >
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
            <option value="user">
              User — simplified dashboard, no financial figures
            </option>
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

      <form
        onSubmit={saveProfile}
        className="bg-card border border-line rounded-lg p-5 space-y-3"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg text-ink">Billing details</h2>
        </div>
        <input
          value={profile.companyName || ""}
          onChange={(event) =>
            setProfile((current) => ({
              ...current,
              companyName: event.target.value,
            }))
          }
          placeholder="Company name"
          className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
        />
        <input
          value={profile.logoUrl || ""}
          onChange={(event) =>
            setProfile((current) => ({
              ...current,
              logoUrl: event.target.value,
            }))
          }
          placeholder="Logo URL"
          className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
        />
        <input
          value={profile.phone || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, phone: event.target.value }))
          }
          placeholder="Phone"
          className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
        />
        <input
          value={profile.panNo || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, panNo: event.target.value }))
          }
          placeholder="PAN no"
          className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
        />
        <input
          value={profile.email || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, email: event.target.value }))
          }
          placeholder="Email"
          className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
        />
        <input
          value={profile.website || ""}
          onChange={(event) =>
            setProfile((current) => ({
              ...current,
              website: event.target.value,
            }))
          }
          placeholder="Website"
          className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
        />
        <textarea
          value={profile.address || ""}
          onChange={(event) =>
            setProfile((current) => ({
              ...current,
              address: event.target.value,
            }))
          }
          placeholder="Address"
          rows={3}
          className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line resize-none"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 bg-moss text-white text-sm rounded-md px-3 py-2"
        >
          <Check size={14} /> Save bill details
        </button>
      </form>

      <div className="bg-card border border-line rounded-lg divide-y divide-line">
        {users.map((u) => (
          <div
            key={u.id}
            className="px-5 py-3 flex items-center justify-between gap-3"
          >
            <div>
              <p className="text-sm text-ink font-medium">
                {u.username}
                {u.id === currentUser?.id && (
                  <span className="text-muted font-normal"> (you)</span>
                )}
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
                  <button
                    onClick={() => handleDelete(u)}
                    className="text-muted hover:text-clay"
                    title="Delete user"
                  >
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
