export type DailyNoteCount = Array<[number, number]>

export interface WorkspaceStats {
  note_count: number
  tag_count: number
  word_count: number
  daily_note_count: DailyNoteCount
}
