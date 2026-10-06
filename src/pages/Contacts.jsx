import { useCallback, useEffect, useState, useMemo } from "react";
import { Plus, Pencil, Trash2, X, Phone, Mail, MapPin, Building } from "lucide-react";
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

  // Client-side filtering fallback to ensure search and category work smoothly
  const filteredContacts = useMemo(() => {
    return contacts.filter((item) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        item.name?.toLowerCase().includes(query) ||
        item.company?.toLowerCase().includes(query) ||
        item.phone?.toLowerCase().includes(query) ||
        item.email?.toLowerCase().includes(query) ||
        item.address?.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query);

      const matchesCategory =
        !category || (item.category || "Supplier") === category;

      return matchesSearch && matchesCategory;
    });
  }, [contacts, search, category]);

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
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    <div className="space-y-6 px-2 sm:px-4 lg:px-6">
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
          className="flex items-center justify-center gap-1.5 bg-ink text-paper text-sm px-4 py-2 rounded-md hover:bg-moss-dark transition-colors shrink-0"
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? "Cancel" : "New contact"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-line rounded-lg p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
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
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line sm:col-span-2 md:col-span-3 min-h-[90px]"
          />

          <button
            type="submit"
            disabled={saving}
            className="bg-moss text-white text-sm rounded-md py-2 hover:bg-moss-dark disabled:opacity-50 sm:col-span-2 md:col-span-3 font-medium transition-colors"
          >
            {saving ? "Saving…" : editingId ? "Update contact" : "Save contact"}
          </button>
        </form>
      )}

      {/* ULTRA-COMPACT MOBILE LIST VIEW */}
      <div className="md:hidden space-y-2.5">
        <div className="space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, phone, email..."
            className="w-full px-3 py-1.5 text-xs bg-paper rounded-md border border-line"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-paper rounded-md border border-line"
          >
            <option value="">All types</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted px-0.5">
          <span>{filteredContacts.length} contacts</span>
        </div>

        <div className="max-h-[calc(100vh-210px)] overflow-y-auto space-y-1.5 pr-0.5">
          {filteredContacts.map((row) => {
            const contactId = row._id ?? row.id;

            return (
              <div
                key={contactId}
                className="bg-card border border-line rounded-md px-2.5 py-2 shadow-2xs space-y-1.5"
              >
                {/* Header Row: Name, Company, Category Badge & Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-xs text-ink truncate">
                        {row.name}
                      </span>
                      {row.company && (
                        <span className="text-[10px] text-muted truncate flex items-center gap-0.5">
                          • <Building size={10} className="shrink-0" />
                          {row.company}
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
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
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5 text-muted">
                    <button
                      onClick={() => startEdit(row)}
                      className="p-1 hover:text-moss-dark"
                      title="Edit contact"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(row)}
                      className="p-1 hover:text-clay"
                      title="Delete contact"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Details Section: Phone, Email, Address */}
                {(row.phone || row.email || row.address) && (
                  <div className="space-y-0.5 pt-0.5 text-[10px] text-muted">
                    {row.phone && (
                      <div className="flex items-center gap-1 truncate">
                        <Phone size={11} className="shrink-0 text-muted" />
                        <span className="truncate">{row.phone}</span>
                      </div>
                    )}
                    {row.email && (
                      <div className="flex items-center gap-1 truncate">
                        <Mail size={11} className="shrink-0 text-muted" />
                        <span className="truncate">{row.email}</span>
                      </div>
                    )}
                    {row.address && (
                      <div className="flex items-center gap-1 truncate">
                        <MapPin size={11} className="shrink-0 text-muted" />
                        <span className="truncate">{row.address}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes Section */}
                {row.notes && (
                  <div className="pt-1 border-t border-line/40">
                    <span className="text-[10px] text-muted truncate block">
                      {row.notes}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {filteredContacts.length === 0 && (
            <div className="py-10 text-center text-xs text-muted">
              No supplier or contact records yet.
            </div>
          )}
        </div>
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block w-full overflow-x-auto min-w-full">
        <DataTable
          columns={columns}
          rows={filteredContacts}
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
    </div>
  );
}