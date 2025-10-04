export type StaffRole =
  | 'Physician' | 'PA' | 'RN' | 'LVN' | 'MA' | 'Xray Tech' | 'Front Desk' | 'Admin'

export type Staff = {
  id: string
  full_name: string
  role: StaffRole
  base_hourly_rate: number
  default_daily_hours: number | null
}
