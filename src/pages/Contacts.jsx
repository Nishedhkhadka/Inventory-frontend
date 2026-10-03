import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import DataTable, { Badge } from "../components/DataTable";
import {
  fetchContacts,
  createContact,
  updateContact,
  deleteContact,
} from "../api/contacts";

const EMPTY_FORM = {
  name: "",
  company: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  category: "Supplier",
};

const CATEGORY_OPTIONS = ["Supplier", "Customer", "Both", "Other"];

const isValidContactId = (value) => {
  if (value === null || value === undefined) return false;
  const raw = String(value).trim();
  if (!raw || raw === "undefined" || raw === "null") return false;
  return /^[0-9a-fA-F]{24}$/.test(raw);
};

const normalizeRows = (rows) =>
  Array.isArray(rows)
    ? rows.filter((row) => row && isValidContactId(row._id ?? row.id))
    : [];

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    const rows = await fetchContacts({ search, category });
    setContacts(normalizeRows(rows));
  }, [search, category]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        company: form.company.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
      };

      if (!payload.name) {
        alert("Contact name is required.");
        return;
      }

      if (editingId) {
        await updateContact(editingId, payload);
      } else {
        await createContact(payload);
      }

      resetForm();
      load();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rowOrId) => {
    const id =
      typeof rowOrId === "object" ? (rowOrId?._id ?? rowOrId?.id) : rowOrId;
    if (!isValidContactId(id)) {
      alert("This contact record is missing an ID and cannot be deleted.");
      return;
    }

    if (!window.confirm("Delete this contact record?")) return;
    try {
      await deleteContact(id);
      setContacts((prev) =>
        normalizeRows(prev.filter((row) => (row._id ?? row.id) !== id)),
      );
      load();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const startEdit = (contact) => {
    const contactId = contact?._id ?? contact?.id;
    if (!isValidContactId(contactId)) {
      alert("This contact record is missing an ID and cannot be edited.");
      return;
    }

    setEditingId(contactId);
    setForm({
      name: contact.name || "",
      company: contact.company || "",
      phone: contact.phone || "",
      email: contact.email || "",
      address: contact.address || "",
      notes: contact.notes || "",
      category: contact.category || "Supplier",
    });
    setShowForm(true);
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.name}</div>
          <div className="text-xs text-muted mt-0.5">
            {row.company || "No company"}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Type",
      render: (row) => (
        <Badge
          tone={
            row.category === "Supplier"
              ? "moss"
              : row.category === "Customer"
                ? "sky"
                : row.category === "Both"
                  ? "amber"
                  : "muted"
          }
        >
          {row.category || "Supplier"}
        </Badge>
      ),
    },
    { key: "phone", header: "Phone", render: (row) => row.phone || "—" },
    { key: "email", header: "Email", render: (row) => row.email || "—" },
    { key: "address", header: "Address", render: (row) => row.address || "—" },
    {
      key: "notes",
      header: "Notes",
      render: (row) => (
        <span className="max-w-[220px] block truncate">{row.notes || "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => startEdit(row)}
            className="text-muted hover:text-moss-dark"
            title="Edit contact"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="text-muted hover:text-clay"
            title="Delete contact"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl text-ink">
            Suppliers &amp; contacts
          </h1>
          <p className="text-sm text-muted mt-1">
            Keep supplier details, customer contacts, and notes in one place for
            expenses and exports.
          </p>
        </div>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="flex items-center gap-1.5 bg-ink text-paper text-sm px-4 py-2 rounded-md hover:bg-moss-dark transition-colors"
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? "Cancel" : "New contact"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-line rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
        >
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            placeholder="Company"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
          />
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
          />
          <input
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
          />
          <textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line md:col-span-3 min-h-[90px]"
          />

          <button
            type="submit"
            disabled={saving}
            className="bg-moss text-white text-sm rounded-md py-2 hover:bg-moss-dark disabled:opacity-50 md:col-span-3"
          >
            {saving ? "Saving…" : editingId ? "Update contact" : "Save contact"}
          </button>
        </form>
      )}

      <DataTable
        columns={columns}
        rows={contacts}
        searchValue={search}
        onSearchChange={setSearch}
        onRowDoubleClick={startEdit}
        searchPlaceholder="Search name, company, phone, email…"
        filters={
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-sm bg-paper rounded-md border border-line px-3 py-1.5"
          >
            <option value="">All types</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        }
        page={1}
        pages={1}
        onPageChange={() => {}}
        emptyLabel="No supplier or contact records yet."
      />
    </div>
  );
}
