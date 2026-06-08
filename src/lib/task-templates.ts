import type { TaskCategory, TaskPriority, TaskSource } from "@/types/database";

export type TaskTemplate = {
  id: string;
  label: string;
  title: string;
  description: string;
  priority: TaskPriority;
  category: TaskCategory;
  source: TaskSource;
  checklist: string[];
};

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "it_request_triage",
    label: "IT request triage",
    title: "Triage new IT request",
    description: "Capture scope, impact, owner, and next action.",
    priority: "Standard",
    category: "IT",
    source: "Walk-in",
    checklist: [
      "Confirm requester and affected site",
      "Capture impact and urgency",
      "Identify asset, printer, or system involved",
      "Set due date and follow-up",
      "Post initial update",
    ],
  },
  {
    id: "printer_issue",
    label: "Printer issue",
    title: "Resolve printer issue",
    description: "Standard printer support workflow.",
    priority: "Priority",
    category: "IT",
    source: "Walk-in",
    checklist: [
      "Confirm printer and location",
      "Check toner, paper, and error state",
      "Capture meter reading if relevant",
      "Log supplier follow-up if external support is needed",
      "Confirm user can print again",
    ],
  },
  {
    id: "supplier_follow_up",
    label: "Supplier follow-up",
    title: "Follow up with supplier",
    description: "Track external dependency until resolved.",
    priority: "Standard",
    category: "Admin",
    source: "Email",
    checklist: [
      "Confirm contact person",
      "Send request or reminder",
      "Record expected response date",
      "Add follow-up",
      "Post outcome",
    ],
  },
  {
    id: "onboarding",
    label: "User onboarding",
    title: "Prepare user onboarding",
    description: "Device, access, and readiness checklist.",
    priority: "Priority",
    category: "IT",
    source: "Email",
    checklist: [
      "Confirm start date and department",
      "Prepare device and accessories",
      "Create or verify accounts",
      "Assign asset",
      "Confirm user access",
    ],
  },
  {
    id: "laptop_replacement",
    label: "Laptop replacement",
    title: "Replace laptop",
    description: "Replacement device workflow.",
    priority: "Priority",
    category: "IT",
    source: "Walk-in",
    checklist: [
      "Confirm replacement reason",
      "Prepare replacement device",
      "Back up required user data",
      "Assign new asset",
      "Recover or retire old asset",
    ],
  },
  {
    id: "audit_remediation",
    label: "Audit remediation",
    title: "Resolve audit finding",
    description: "Follow through on audit exceptions.",
    priority: "Standard",
    category: "Admin",
    source: "Meeting",
    checklist: [
      "Confirm audit finding",
      "Identify owner",
      "Agree corrective action",
      "Attach or record evidence",
      "Close with final update",
    ],
  },
];

export function getTaskTemplate(id: string) {
  return TASK_TEMPLATES.find((template) => template.id === id) ?? null;
}
