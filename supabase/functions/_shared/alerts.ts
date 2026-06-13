import { getServiceClient } from './auth.ts'

type ServiceClient = ReturnType<typeof getServiceClient>

interface AlertLogRow {
  triggered_at: string
  cooldown_hours: number
}

/**
 * Returns true if a new alert of this type/entity can be sent for this workspace.
 * False when the last alert was sent within the cooldown window.
 */
export async function canAlert(
  db: ServiceClient,
  workspaceId: string,
  alertType: string,
  entityId = '',
): Promise<boolean> {
  const { data } = await db
    .from('alert_log')
    .select('triggered_at, cooldown_hours')
    .eq('workspace_id', workspaceId)
    .eq('alert_type', alertType)
    .eq('entity_id', entityId)
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return true
  const row = data as AlertLogRow
  const cooldownMs = row.cooldown_hours * 3_600_000
  return Date.now() - new Date(row.triggered_at).getTime() > cooldownMs
}

/**
 * Records that an alert was sent. Call after successfully delivering the alert.
 */
export async function recordAlert(
  db: ServiceClient,
  workspaceId: string,
  alertType: string,
  entityId = '',
  cooldownHours = 168,
): Promise<void> {
  await db.from('alert_log').insert({
    workspace_id: workspaceId,
    alert_type: alertType,
    entity_id: entityId,
    cooldown_hours: cooldownHours,
  })
}
