'use server';

import { createSessionClient } from '@/lib/supabase';

export const getCurrent = async () => {
  try {
    const { user } = await createSessionClient();

    return user;
  } catch {
    return null;
  }
};
