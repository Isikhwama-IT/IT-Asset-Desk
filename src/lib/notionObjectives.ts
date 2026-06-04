export type NotionObjective = {
  id: string
  title: string
  blockers?: string
  category?: string
  created?: string
  dueDate?: string
  intelLog?: string
  lastEdited?: string
  mission?: string
  notes?: string
  owner?: string
  priority?: string
  relatedObjectives?: string
  source?: string
  spawnedFrom?: string
  spawnedObjectives?: string
  status?: string
}

export const notionObjectives: NotionObjective[] = []

export default notionObjectives
