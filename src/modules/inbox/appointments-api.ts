import { supabase } from '@/lib/supabase';

export type AppointmentStatus = 'scheduled' | 'cancelled' | 'rescheduled';

export interface Appointment {
  id: string;
  tenant_id: string;
  thread_id: string;
  related_entity: string | null;
  related_entity_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getThreadAppointments(
  tenantId: string,
  threadId: string
): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('thread_id', threadId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as Appointment[];
}

export async function createAppointment(
  tenantId: string,
  threadId: string,
  payload: {
    title: string;
    starts_at: string;
    ends_at: string;
    status?: AppointmentStatus;
    related_entity?: string | null;
    related_entity_id?: string | null;
  },
  userId: string
): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      thread_id: threadId,
      title: payload.title,
      starts_at: payload.starts_at,
      ends_at: payload.ends_at,
      status: payload.status ?? 'scheduled',
      related_entity: payload.related_entity ?? null,
      related_entity_id: payload.related_entity_id ?? null,
      created_by: userId,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as Appointment;
}

export async function updateAppointment(
  tenantId: string,
  appointmentId: string,
  payload: {
    title?: string;
    starts_at?: string;
    ends_at?: string;
    status?: AppointmentStatus;
  },
  userId: string
): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .update({
      ...payload,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', appointmentId)
    .eq('tenant_id', tenantId)
    .select()
    .single();
  if (error) throw error;
  return data as Appointment;
}

export async function cancelAppointment(
  tenantId: string,
  appointmentId: string,
  userId: string
): Promise<Appointment> {
  return updateAppointment(tenantId, appointmentId, { status: 'cancelled' }, userId);
}

export async function deleteAppointment(
  tenantId: string,
  appointmentId: string
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', appointmentId)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}
