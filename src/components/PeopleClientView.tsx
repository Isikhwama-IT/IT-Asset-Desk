"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X, ChevronDown, ChevronRight, Mail, Package, Pencil, Plus, LayoutGrid, List, ArrowUpRight } from "lucide-react";
import { getCategoryIcon, getStatusConfig } from "@/lib/utils";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { AddContactModal, EditContactModal } from "@/components/ContactModals";
import { useAuth } from "@/context/AuthContext";
import type { Contact, Department, JobLevel, AssetWithRelations } from "@/types/database";

type ContactWithRelations = Contact & {
  department: Department | null;
  job_level: JobLevel | null;
};

interface Props {
  contacts: ContactWithRelations[];
  assetsByContact: Record<string, AssetWithRelations[]>;
  departments: Department[];
  jobLevels: JobLevel[];
}

function getInitials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const avatarColors = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash + ch.charCodeAt(0)) % avatarColors.length;
  return avatarColors[hash];
}

function ContactCard({
  contact,
  assets,
  onEdit,
  isAdmin,
}: {
  contact: ContactWithRelations;
  assets: AssetWithRelations[];
  onEdit: () => void;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const initials = getInitials(contact.full_name);
  const color = getAvatarColor(contact.full_name);

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
              <p className="text-[13.5px] font-medium text-stone-900 leading-tight">{contact.full_name}</p>
              {!contact.is_active && (
                <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full">Inactive</span>
              )}
            </div>
            <p className="text-[11.5px] text-stone-400 mt-0.5">
              {contact.department?.name ?? "No department"}
              {contact.job_level && ` · ${contact.job_level.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {assets.length > 0 && (
              <span className="text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
                {assets.length} {assets.length === 1 ? "asset" : "assets"}
              </span>
            )}
            {open ? <ChevronDown size={14} className="text-stone-400" /> : <ChevronRight size={14} className="text-stone-300" />}
          </div>
        </button>

        {/* Edit button (admin only) */}
        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="px-3 py-3.5 text-stone-300 hover:text-stone-600 hover:bg-stone-50 transition-colors flex-shrink-0 border-l border-stone-100"
            title="Edit contact"
          >
            <Pencil size={13} />
          </button>
        )}
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
          {assets.length === 0 ? (
            <div className="px-4 py-4 flex items-center gap-2 text-stone-400">
              <Package size={13} />
              <p className="text-[12.5px]">No assets currently assigned</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {assets.map((asset) => {
                const cfg = getStatusConfig(asset.status?.name);
                return (
                  <Link key={asset.id} href={`/assets/${asset.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-white transition-colors group">
                    <span className="text-sm w-6 text-center">{getCategoryIcon(asset.category?.name)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] text-stone-700 truncate group-hover:text-stone-900">{asset.description}</p>
                      <p className="text-[11px] text-stone-400">#{asset.asset_code} · {asset.category?.name}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                      <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                      {asset.status?.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WhoHasWhat({
  contacts,
  assetsByContact,
}: {
  contacts: ContactWithRelations[];
  assetsByContact: Record<string, AssetWithRelations[]>;
}) {
  const withAssets = contacts
    .map((c) => ({ contact: c, assets: assetsByContact[c.id] ?? [] }))
    .filter(({ assets }) => assets.length > 0)
    .sort((a, b) => b.assets.length - a.assets.length);

  if (withAssets.length === 0) {
    return (
      <div className="py-16 text-center text-stone-400">
        <Package size={28} className="mx-auto mb-3 opacity-30" />
        <p className="text-[13px]">No assigned assets found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {withAssets.map(({ contact, assets }) => {
        const color = getAvatarColor(contact.full_name);
        const initials = contact.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
        return (
          <div key={contact.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            {/* Person header */}
            <div className="flex items-center gap-3.5 px-5 py-3.5 border-b border-stone-100 bg-stone-50">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0 ${color}`}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium text-stone-900 leading-tight">{contact.full_name}</p>
                <p className="text-[11.5px] text-stone-400">
                  {contact.department?.name ?? "No department"}
                  {contact.job_level && ` · ${contact.job_level.name}`}
                </p>
              </div>
              <span className="text-[11px] font-medium text-stone-600 bg-stone-200 px-2.5 py-1 rounded-full flex-shrink-0">
                {assets.length} {assets.length === 1 ? "asset" : "assets"}
              </span>
            </div>
            {/* Asset list */}
            <div className="divide-y divide-stone-50">
              {assets.map((asset) => {
                const cfg = getStatusConfig(asset.status?.name);
                return (
                  <Link
                    key={asset.id}
                    href={`/assets/${asset.id}`}
                    className="flex items-center gap-3.5 px-5 py-3 hover:bg-stone-50 transition-colors group"
                  >
                    <span className="text-base w-7 text-center flex-shrink-0">
                      {getCategoryIcon(asset.category?.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-stone-800 font-medium truncate group-hover:text-stone-900">
                        {asset.description}
                      </p>
                      <p className="text-[11px] text-stone-400">
                        #{asset.asset_code} · {asset.category?.name ?? "—"}
                        {asset.location?.name && ` · ${asset.location.name}`}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                      <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                      {asset.status?.name}
                    </span>
                    <ArrowUpRight size={12} className="text-stone-200 group-hover:text-stone-400 flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PeopleClientView({ contacts, assetsByContact, departments, jobLevels }: Props) {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterActive, setFilterActive] = useState("active");
  const [showAdd, setShowAdd] = useState(false);
  const [editContact, setEditContact] = useState<ContactWithRelations | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "who-has-what">("cards");

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = !q || c.full_name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
      const matchDept = !filterDept || c.department?.name === filterDept;
      const matchLevel = !filterLevel || c.job_level?.name === filterLevel;
      const matchActive =
        filterActive === "all" ||
        (filterActive === "active" && c.is_active) ||
        (filterActive === "inactive" && !c.is_active);
      return matchSearch && matchDept && matchLevel && matchActive;
    });
  }, [contacts, search, filterDept, filterLevel, filterActive]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    for (const c of filtered) {
      const dept = c.department?.name ?? "No Department";
      if (!map[dept]) map[dept] = [];
      map[dept].push(c);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const hasFilters = filterDept || filterLevel || filterActive !== "active";

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input type="text" placeholder="Search people…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-[13px] border border-stone-200 rounded-lg bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300" />
        </div>

        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
          className="text-[12.5px] border border-stone-200 rounded-lg px-2.5 py-2 bg-white text-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-300 cursor-pointer">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>

        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}
          className="text-[12.5px] border border-stone-200 rounded-lg px-2.5 py-2 bg-white text-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-300 cursor-pointer">
          <option value="">All levels</option>
          {jobLevels.map((j) => <option key={j.id} value={j.name}>{j.name}</option>)}
        </select>

        <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)}
          className="text-[12.5px] border border-stone-200 rounded-lg px-2.5 py-2 bg-white text-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-300 cursor-pointer">
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="all">All people</option>
        </select>

        {hasFilters && (
          <button onClick={() => { setFilterDept(""); setFilterLevel(""); setFilterActive("active"); }}
            className="flex items-center gap-1 text-[12px] text-stone-400 hover:text-stone-700 px-2 py-1 rounded-md hover:bg-stone-100 transition-colors">
            <X size={12} /> Clear
          </button>
        )}

        <span className="text-[12px] text-stone-400">{filtered.length} of {contacts.length}</span>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("cards")}
              title="Cards view"
              className="px-2.5 py-1.5 transition-colors"
              style={{ background: viewMode === "cards" ? "#C04F28" : "transparent", color: viewMode === "cards" ? "#fff" : "#a8a29e" }}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setViewMode("who-has-what")}
              title="Who has what"
              className="px-2.5 py-1.5 transition-colors border-l border-stone-200"
              style={{ background: viewMode === "who-has-what" ? "#C04F28" : "transparent", color: viewMode === "who-has-what" ? "#fff" : "#a8a29e" }}
            >
              <List size={13} />
            </button>
          </div>
          {isAdmin && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-white px-3 py-2 rounded-lg transition-colors btn-press"
            style={{ background: "#C04F28" }}>
              <Plus size={13} /> Add Person
            </button>
          )}
        </div>
      </div>

      {viewMode === "cards" ? (
        /* Grouped cards */
        <motion.div
          className="space-y-8"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          key={filtered.map(c => c.id).join(",")}
        >
          {grouped.map(([dept, deptContacts]) => (
            <motion.div key={dept} variants={staggerItem}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-widest">{dept}</p>
                <span className="text-[11px] text-stone-300 font-mono">{deptContacts.length}</span>
                <div className="flex-1 h-px bg-stone-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {deptContacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    assets={assetsByContact[contact.id] ?? []}
                    onEdit={() => setEditContact(contact)}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="py-16 text-center text-stone-400 text-[13px]">No people match your filters</div>
          )}
        </motion.div>
      ) : (
        /* Who Has What view */
        <WhoHasWhat contacts={filtered} assetsByContact={assetsByContact} />
      )}

      {/* Modals */}
      {showAdd && (
        <AddContactModal
          onClose={() => setShowAdd(false)}
          lookups={{ departments, jobLevels }}
        />
      )}
      {editContact && (
        <EditContactModal
          contact={editContact}
          onClose={() => setEditContact(null)}
          lookups={{ departments, jobLevels }}
        />
      )}
    </>
  );
}
