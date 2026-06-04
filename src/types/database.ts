export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      assets: {
        Row: {
          id: string;
          asset_code: number;
          description: string;
          category_id: string;
          serial_number: string | null;
          purchase_date: string | null;
          invoice_number: string | null;
          cpu_gen: string | null;
          owning_department_id: string | null;
          assigned_job_level_id: string | null;
          assigned_to_contact_id: string | null;
          status_id: string;
          location_id: string | null;
          warranty_start_date: string | null;
          warranty_end_date: string | null;
          os_type: string | null;
          os_license_type: string | null;
          expected_end_of_life_date: string | null;
          performance_rating: string | null;
          performance_notes: string | null;
          legacy_previous_owner: string | null;
          legacy_previous_owners_text: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          asset_code?: number;
          description: string;
          category_id: string;
          serial_number?: string | null;
          purchase_date?: string | null;
          invoice_number?: string | null;
          cpu_gen?: string | null;
          owning_department_id?: string | null;
          assigned_job_level_id?: string | null;
          assigned_to_contact_id?: string | null;
          status_id: string;
          location_id?: string | null;
          warranty_start_date?: string | null;
          warranty_end_date?: string | null;
          os_type?: string | null;
          os_license_type?: string | null;
          expected_end_of_life_date?: string | null;
          performance_rating?: string | null;
          performance_notes?: string | null;
          legacy_previous_owner?: string | null;
          legacy_previous_owners_text?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          asset_code?: number;
          description?: string;
          category_id?: string;
          serial_number?: string | null;
          purchase_date?: string | null;
          invoice_number?: string | null;
          cpu_gen?: string | null;
          owning_department_id?: string | null;
          assigned_job_level_id?: string | null;
          assigned_to_contact_id?: string | null;
          status_id?: string;
          location_id?: string | null;
          warranty_start_date?: string | null;
          warranty_end_date?: string | null;
          os_type?: string | null;
          os_license_type?: string | null;
          expected_end_of_life_date?: string | null;
          performance_rating?: string | null;
          performance_notes?: string | null;
          legacy_previous_owner?: string | null;
          legacy_previous_owners_text?: string | null;
          notes?: string | null;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      printers: {
        Row: {
          id: string;
          printer_code: number;
          name: string;
          serial_number: string | null;
          ip_address: string | null;
          mac_address: string | null;
          supplier: string | null;
          manufacturer: string | null;
          model: string | null;
          department_id: string | null;
          location_id: string | null;
          primary_contact_id: string | null;
          status: string;
          toner_status: string;
          paper_status: string;
          toner_model: string | null;
          paper_size: string | null;
          last_meter_reading: number | null;
          last_meter_reading_at: string | null;
          warranty_end_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          printer_code?: number;
          name: string;
          serial_number?: string | null;
          ip_address?: string | null;
          mac_address?: string | null;
          supplier?: string | null;
          manufacturer?: string | null;
          model?: string | null;
          department_id?: string | null;
          location_id?: string | null;
          primary_contact_id?: string | null;
          status?: string;
          toner_status?: string;
          paper_status?: string;
          toner_model?: string | null;
          paper_size?: string | null;
          last_meter_reading?: number | null;
          last_meter_reading_at?: string | null;
          warranty_end_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          printer_code?: number;
          name?: string;
          serial_number?: string | null;
          ip_address?: string | null;
          mac_address?: string | null;
          supplier?: string | null;
          manufacturer?: string | null;
          model?: string | null;
          department_id?: string | null;
          location_id?: string | null;
          primary_contact_id?: string | null;
          status?: string;
          toner_status?: string;
          paper_status?: string;
          toner_model?: string | null;
          paper_size?: string | null;
          last_meter_reading?: number | null;
          last_meter_reading_at?: string | null;
          warranty_end_date?: string | null;
          notes?: string | null;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      printer_toner_orders: {
        Row: {
          id: string;
          printer_id: string;
          requested_by_contact_id: string | null;
          toner_type: string;
          quantity: number;
          status: string;
          supplier: string | null;
          order_number: string | null;
          requested_at: string;
          expected_at: string | null;
          received_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          printer_id: string;
          requested_by_contact_id?: string | null;
          toner_type: string;
          quantity?: number;
          status?: string;
          supplier?: string | null;
          order_number?: string | null;
          requested_at?: string;
          expected_at?: string | null;
          received_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          printer_id?: string;
          requested_by_contact_id?: string | null;
          toner_type?: string;
          quantity?: number;
          status?: string;
          supplier?: string | null;
          order_number?: string | null;
          requested_at?: string;
          expected_at?: string | null;
          received_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      printer_paper_orders: {
        Row: {
          id: string;
          printer_id: string;
          requested_by_contact_id: string | null;
          paper_size: string;
          reams: number;
          status: string;
          supplier: string | null;
          order_number: string | null;
          requested_at: string;
          expected_at: string | null;
          received_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          printer_id: string;
          requested_by_contact_id?: string | null;
          paper_size: string;
          reams?: number;
          status?: string;
          supplier?: string | null;
          order_number?: string | null;
          requested_at?: string;
          expected_at?: string | null;
          received_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          printer_id?: string;
          requested_by_contact_id?: string | null;
          paper_size?: string;
          reams?: number;
          status?: string;
          supplier?: string | null;
          order_number?: string | null;
          requested_at?: string;
          expected_at?: string | null;
          received_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      printer_tickets: {
        Row: {
          id: string;
          printer_id: string;
          logged_by_contact_id: string | null;
          title: string;
          description: string | null;
          priority: string;
          status: string;
          supplier_ticket_ref: string | null;
          opened_at: string;
          due_at: string | null;
          closed_at: string | null;
          resolution_notes: string | null;
          cost: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          printer_id: string;
          logged_by_contact_id?: string | null;
          title: string;
          description?: string | null;
          priority?: string;
          status?: string;
          supplier_ticket_ref?: string | null;
          opened_at?: string;
          due_at?: string | null;
          closed_at?: string | null;
          resolution_notes?: string | null;
          cost?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          printer_id?: string;
          logged_by_contact_id?: string | null;
          title?: string;
          description?: string | null;
          priority?: string;
          status?: string;
          supplier_ticket_ref?: string | null;
          opened_at?: string;
          due_at?: string | null;
          closed_at?: string | null;
          resolution_notes?: string | null;
          cost?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      printer_meter_readings: {
        Row: {
          id: string;
          printer_id: string;
          reading: number;
          reading_at: string;
          captured_by_contact_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          printer_id: string;
          reading: number;
          reading_at?: string;
          captured_by_contact_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          printer_id?: string;
          reading?: number;
          reading_at?: string;
          captured_by_contact_id?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          department_id: string | null;
          job_level_id: string | null;
          location_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email?: string | null;
          department_id?: string | null;
          job_level_id?: string | null;
          location_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string | null;
          department_id?: string | null;
          job_level_id?: string | null;
          location_id?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      departments: {
        Row: { id: string; name: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; updated_at?: string };
        Relationships: [];
      };
      categories: {
        Row: { id: string; name: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; updated_at?: string };
        Relationships: [];
      };
      statuses: {
        Row: { id: string; name: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; updated_at?: string };
        Relationships: [];
      };
      locations: {
        Row: {
          id: string; name: string; code: string | null;
          address: string | null; room: string | null;
          is_active: boolean; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; name: string; code?: string | null;
          address?: string | null; room?: string | null;
          is_active?: boolean; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; name?: string; code?: string | null;
          address?: string | null; room?: string | null;
          is_active?: boolean; updated_at?: string;
        };
        Relationships: [];
      };
      job_levels: {
        Row: { id: string; name: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; updated_at?: string };
        Relationships: [];
      };
      asset_assignments: {
        Row: {
          id: string;
          asset_id: string;
          contact_id: string;
          assigned_by_contact_id: string | null;
          location_id: string | null;
          assigned_at: string;
          due_back_at: string | null;
          returned_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          contact_id: string;
          assigned_by_contact_id?: string | null;
          location_id?: string | null;
          assigned_at?: string;
          due_back_at?: string | null;
          returned_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          asset_id?: string;
          contact_id?: string;
          assigned_by_contact_id?: string | null;
          location_id?: string | null;
          assigned_at?: string;
          due_back_at?: string | null;
          returned_at?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      maintenance_records: {
        Row: {
          id: string;
          asset_id: string;
          logged_by_contact_id: string | null;
          vendor_name: string | null;
          issue_description: string;
          resolution_notes: string | null;
          cost: number | null;
          status: string;
          opened_at: string;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          logged_by_contact_id?: string | null;
          vendor_name?: string | null;
          issue_description: string;
          resolution_notes?: string | null;
          cost?: number | null;
          status: string;
          opened_at?: string;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          asset_id?: string;
          logged_by_contact_id?: string | null;
          vendor_name?: string | null;
          issue_description?: string;
          resolution_notes?: string | null;
          cost?: number | null;
          status?: string;
          opened_at?: string;
          closed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      asset_status_history: {
        Row: {
          id: string;
          asset_id: string;
          old_status_id: string | null;
          new_status_id: string;
          changed_by_contact_id: string | null;
          changed_at: string;
          reason: string | null;
        };
        Insert: {
          id?: string;
          asset_id: string;
          old_status_id?: string | null;
          new_status_id: string;
          changed_by_contact_id?: string | null;
          changed_at?: string;
          reason?: string | null;
        };
        Update: {
          id?: string;
          asset_id?: string;
          old_status_id?: string | null;
          new_status_id?: string;
          changed_by_contact_id?: string | null;
          changed_at?: string;
          reason?: string | null;
        };
        Relationships: [];
      };
      asset_audit_log: {
        Row: {
          id: string;
          asset_id: string;
          changed_by_user_id: string | null;
          changed_by_name: string | null;
          action: "create" | "update" | "delete";
          changes: Json | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          changed_by_user_id?: string | null;
          changed_by_name?: string | null;
          action: "create" | "update" | "delete";
          changes?: Json | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          asset_id?: string;
          changed_by_user_id?: string | null;
          changed_by_name?: string | null;
          action?: "create" | "update" | "delete";
          changes?: Json | null;
          changed_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: { key: string; value: string };
        Insert: { key: string; value: string };
        Update: { key?: string; value?: string };
        Relationships: [];
      };
      asset_requests: {
        Row: {
          id: string;
          requester_name: string;
          requester_email: string;
          category_id: string | null;
          category_name: string | null;
          reason: string | null;
          status: string;
          admin_notes: string | null;
          attended_by_user_id: string | null;
          attended_by_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_name: string;
          requester_email: string;
          category_id?: string | null;
          category_name?: string | null;
          reason?: string | null;
          status?: string;
          admin_notes?: string | null;
          attended_by_user_id?: string | null;
          attended_by_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          requester_name?: string;
          requester_email?: string;
          category_id?: string | null;
          category_name?: string | null;
          reason?: string | null;
          status?: string;
          admin_notes?: string | null;
          attended_by_user_id?: string | null;
          attended_by_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          user_id: string | null;
          user_name: string | null;
          user_email: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          entity_label: string | null;
          details: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          user_name?: string | null;
          user_email?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          entity_label?: string | null;
          details?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      external_contacts: {
        Row: {
          id: string;
          name: string;
          company: string | null;
          email: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          company?: string | null;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          company?: string | null;
          email?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          task_code: number;
          title: string;
          status: string;
          status_reason: string | null;
          status_changed_at: string;
          priority: string;
          category: string | null;
          source: string | null;
          due_date: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          task_code?: number;
          title: string;
          status?: string;
          status_reason?: string | null;
          status_changed_at?: string;
          priority?: string;
          category?: string | null;
          source?: string | null;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          status?: string;
          status_reason?: string | null;
          status_changed_at?: string;
          priority?: string;
          category?: string | null;
          source?: string | null;
          due_date?: string | null;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      task_updates: {
        Row: {
          id: string;
          task_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          body?: string;
        };
        Relationships: [{ foreignKeyName: "task_updates_task_id_fkey"; columns: ["task_id"]; referencedRelation: "tasks"; referencedColumns: ["id"] }];
      };
      task_follow_ups: {
        Row: {
          id: string;
          task_id: string;
          contact_id: string | null;
          external_contact_id: string | null;
          due_date: string;
          note: string | null;
          is_done: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          contact_id?: string | null;
          external_contact_id?: string | null;
          due_date: string;
          note?: string | null;
          is_done?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          contact_id?: string | null;
          external_contact_id?: string | null;
          due_date?: string;
          note?: string | null;
          is_done?: boolean;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "task_follow_ups_task_id_fkey"; columns: ["task_id"]; referencedRelation: "tasks"; referencedColumns: ["id"] },
          { foreignKeyName: "task_follow_ups_contact_id_fkey"; columns: ["contact_id"]; referencedRelation: "contacts"; referencedColumns: ["id"] },
          { foreignKeyName: "task_follow_ups_external_contact_id_fkey"; columns: ["external_contact_id"]; referencedRelation: "external_contacts"; referencedColumns: ["id"] }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

// Convenience types
export type Asset = Database["public"]["Tables"]["assets"]["Row"];
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type Department = Database["public"]["Tables"]["departments"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Status = Database["public"]["Tables"]["statuses"]["Row"];
export type Location = Database["public"]["Tables"]["locations"]["Row"];
export type JobLevel = Database["public"]["Tables"]["job_levels"]["Row"];
export type AssetAssignment = Database["public"]["Tables"]["asset_assignments"]["Row"];
export type MaintenanceRecord = Database["public"]["Tables"]["maintenance_records"]["Row"];
export type AssetStatusHistory = Database["public"]["Tables"]["asset_status_history"]["Row"];
export type AssetAuditLog = Database["public"]["Tables"]["asset_audit_log"]["Row"];
export type AppSettings = Database["public"]["Tables"]["app_settings"]["Row"];
export type AssetRequest = Database["public"]["Tables"]["asset_requests"]["Row"];
export type ActivityLog = Database["public"]["Tables"]["activity_log"]["Row"];
export type Printer = Database["public"]["Tables"]["printers"]["Row"];
export type PrinterTonerOrder = Database["public"]["Tables"]["printer_toner_orders"]["Row"];
export type PrinterPaperOrder = Database["public"]["Tables"]["printer_paper_orders"]["Row"];
export type PrinterTicket = Database["public"]["Tables"]["printer_tickets"]["Row"];
export type PrinterMeterReading = Database["public"]["Tables"]["printer_meter_readings"]["Row"];

export type AssetWithRelations = Asset & {
  category: Category | null;
  status: Status | null;
  owning_department: Department | null;
  assigned_to_contact: Contact | null;
  location: Location | null;
  assigned_job_level: JobLevel | null;
};

export type ContactWithRelations = Contact & {
  department: Department | null;
  job_level: JobLevel | null;
  assets: AssetWithRelations[];
};

export type PrinterWithRelations = Printer & {
  department: Department | null;
  location: Location | null;
  primary_contact: Contact | null;
};

export type PrinterTonerOrderWithRelations = PrinterTonerOrder & {
  requested_by_contact: Contact | null;
};

export type PrinterPaperOrderWithRelations = PrinterPaperOrder & {
  requested_by_contact: Contact | null;
};

export type PrinterTicketWithRelations = PrinterTicket & {
  logged_by_contact: Contact | null;
};

export type PrinterMeterReadingWithRelations = PrinterMeterReading & {
  captured_by_contact: Contact | null;
};

// ─── Tasks module ────────────────────────────────────────────────────────────

export type TaskStatus = "Intel" | "Briefed" | "Active Ops" | "Re-Routed" | "Standby" | "Neutralized" | "Retired";
export type TaskPriority = "Cold" | "Standard" | "Priority" | "Hot";
export type TaskCategory = "IT" | "Development" | "Data" | "Automation" | "Presentation" | "Admin" | "General";
export type TaskSource = "Walk-in" | "Email" | "Meeting" | "WhatsApp" | "Call";

export type Task = {
  id: string;
  task_code: number;
  title: string;
  status: TaskStatus;
  status_reason: string | null;
  status_changed_at: string;
  priority: TaskPriority;
  category: TaskCategory | null;
  source: TaskSource | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type TaskWithActivity = Task & {
  task_updates: { created_at: string; body?: string }[];
};

export type TaskUpdate = {
  id: string;
  task_id: string;
  body: string;
  created_at: string;
};

export type ExternalContact = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskFollowUp = {
  id: string;
  task_id: string;
  contact_id: string | null;
  external_contact_id: string | null;
  due_date: string;
  note: string | null;
  is_done: boolean;
  created_at: string;
  updated_at: string;
};

// ─── Tasks Dashboard ──────────────────────────────────────────────────────────

export type DashboardAlertTask = {
  id: string;
  task_code: number;
  title: string;
  status: string;
  priority: string;
  category: string | null;
  due_date: string | null;
  status_changed_at: string;
  created_at: string;
  task_updates: { body: string; created_at: string }[];
};

export type DashboardFollowUp = {
  id: string;
  task_id: string;
  due_date: string;
  note: string | null;
  task: { id: string; task_code: number; title: string } | null;
  contact: { id: string; full_name: string } | null;
  external_contact: { id: string; name: string } | null;
};

export type DashboardRecentUpdate = {
  id: string;
  body: string;
  created_at: string;
  task: { id: string; task_code: number; title: string; status: string } | null;
};

export type DashboardData = {
  pulse: {
    active: number;
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    hot: number;
    followupsDue: number;
  };
  alerts: {
    overdueTasksAlert: DashboardAlertTask[];
    hotNoDueDate: DashboardAlertTask[];
    goneQuiet: DashboardAlertTask[];
    staleStatus: DashboardAlertTask[];
    activeOpsCount: number;
    overdueFollowUps: DashboardFollowUp[];
  };
  focus: DashboardAlertTask[];
  statusSpread: { status: string; count: number }[];
  byCategory: { category: string; count: number }[];
  followUps: { overdue: DashboardFollowUp[]; dueSoon: DashboardFollowUp[] };
  recentlyUpdated: DashboardRecentUpdate[];
};

// ─── Calendar view ────────────────────────────────────────────────────────────

export type CalendarFollowUp = {
  id: string;
  task_id: string;
  due_date: string;
  task: { id: string; task_code: number; title: string; status: string } | null;
  contact: { id: string; full_name: string } | null;
  external_contact: { id: string; name: string } | null;
};

export type CalendarData = {
  tasks: Task[];
  followUps: CalendarFollowUp[];
};
