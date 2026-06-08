"use client";

import { useEffect, useState, useRef } from "react";
import { Mail, Phone, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { AddExternalContactModal, EditExternalContactModal } from "@/components/ExternalContactModals";
import type { ExternalContact } from "@/types/database";

const avatarColors = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700",
];

function getInitials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash + ch.charCodeAt(0)) % avatarColors.length;
  return avatarColors[hash];
}

export default function ExternalContactsView({ addTrigger, onAdded, viewMode = "cards" }: { addTrigger?: number; onAdded?: () => void; viewMode?: "cards" | "who-has-what" }) {
  const [contacts, setContacts] = useState<ExternalContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editContact, setEditContact] = useState<ExternalContact | null>(null);

  useEffect(() => { fetchContacts(); }, []);

  // Open add modal when addTrigger increments (ignore initial mount)
  const prevAddRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (typeof addTrigger !== "number") return;
    if (prevAddRef.current === undefined) {
      prevAddRef.current = addTrigger;
      return;
    }
    if (addTrigger !== prevAddRef.current) {
      prevAddRef.current = addTrigger;
      setShowAdd(true);
    }
  }, [addTrigger]);

  async function fetchContacts() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.from("external_contacts").select("*").order("name");
    setContacts((data ?? []) as ExternalContact[]);
    setLoading(false);
  }

  if (loading) return <div className="text-stone-400">Loading…</div>;
  if (contacts.length === 0) return <div className="text-stone-400">No external contacts found.</div>;

  return (
    <div>
      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contacts.map((c) => (
            <ExternalContactCard
              key={c.id}
              contact={c}
              onEdit={() => setEditContact(c)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((c) => (
            <ExternalContactListItem
              key={c.id}
              contact={c}
              onEdit={() => setEditContact(c)}
            />
          ))}
        </div>
      )}

      {showAdd && <AddExternalContactModal onClose={() => { setShowAdd(false); fetchContacts(); if (onAdded) onAdded(); }} />}
      {editContact && <EditExternalContactModal contact={editContact} onClose={() => { setEditContact(null); fetchContacts(); if (onAdded) onAdded(); }} />}
    </div>
  );
}

function ExternalContactCard({
  contact,
  onEdit,
}: {
  contact: ExternalContact;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const initials = getInitials(contact.name);
  const color = getAvatarColor(contact.name);

  return (
    <div className={`bg-white rounded-xl border border-stone-200 overflow-hidden transition-shadow ${open ? "shadow-sm" : ""}`}>
      <div className="flex items-center">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex-1 flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-stone-50 transition-colors min-w-0"
        >
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0 ${color}`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[13.5px] font-medium text-stone-900 leading-tight">{contact.name}</p>
            </div>
            <p className="text-[11.5px] text-stone-400 mt-0.5">
              {contact.company ?? "No company"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {open ? <ChevronDown size={14} className="text-stone-400" /> : <ChevronRight size={14} className="text-stone-300" />}
          </div>
        </button>

        {/* Edit button */}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="px-3 py-3.5 text-stone-300 hover:text-stone-600 hover:bg-stone-50 transition-colors flex-shrink-0 border-l border-stone-100"
          title="Edit contact"
        >
          <Pencil size={13} />
        </button>
      </div>

      {open && (
        <div className="border-t border-stone-100 bg-stone-50">
          {contact.email && (
            <div className="px-4 py-2 border-b border-stone-100 flex items-center gap-2">
              <Mail size={11} className="text-stone-400" />
              <a href={`mailto:${contact.email}`} className="text-[12px] text-stone-500 hover:text-stone-800 transition-colors">
                {contact.email}
              </a>
            </div>
          )}
          {contact.phone && (
            <div className="px-4 py-2 border-b border-stone-100 flex items-center gap-2">
              <Phone size={11} className="text-stone-400" />
              <p className="text-[12px] text-stone-500">{contact.phone}</p>
            </div>
          )}
          <AsyncTasksList contactId={contact.id} />
        </div>
      )}
    </div>
  );
}

function ExternalContactListItem({
  contact,
  onEdit,
}: {
  contact: ExternalContact;
  onEdit: () => void;
}) {
  const initials = getInitials(contact.name);
  const color = getAvatarColor(contact.name);

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="flex items-center gap-3.5 px-5 py-3.5 border-b border-stone-100 bg-stone-50">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0 ${color}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-medium text-stone-900 leading-tight">{contact.name}</p>
          <p className="text-[11.5px] text-stone-400">
            {contact.company ?? "No company"}
            {contact.email && ` · ${contact.email}`}
          </p>
        </div>
        <button
          onClick={onEdit}
          className="px-3 py-2 text-stone-300 hover:text-stone-600 hover:bg-stone-100 transition-colors flex-shrink-0 rounded-lg"
          title="Edit contact"
        >
          <Pencil size={13} />
        </button>
      </div>
      <div className="px-5 py-3">
        <AsyncTasksList contactId={contact.id} />
      </div>
    </div>
  );
}

function AsyncTasksList({ contactId }: { contactId: string }) {
  const [tasks, setTasks] = useState<{ id: string; task_code: number; title: string; status: string }[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("task_follow_ups")
        .select("task:tasks(id, task_code, title, status)")
        .eq("external_contact_id", contactId)
        .order("due_date");
      if (!mounted) return;
      setTasks(((data ?? []) as any).map((r: any) => r.task));
    })();
    return () => { mounted = false; };
  }, [contactId]);

  if (!tasks) return <div className="px-4 py-3 text-stone-400 text-[12px]">Loading tasks…</div>;
  if (tasks.length === 0) return <div className="px-4 py-3 text-stone-400 text-[12.5px]">No tasks</div>;
  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <a key={t.id} href={`/tasks`} className="block px-3 py-2 hover:bg-stone-50 transition-colors text-[12px] text-stone-600 rounded-lg">
          <span className="font-mono text-stone-400">#{t.task_code}</span> · {t.title}
        </a>
      ))}
    </div>
  );
}
