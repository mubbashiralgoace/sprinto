import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InferRequestType, InferResponseType } from 'hono';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<(typeof client.api.auth.register)['$post']>;
type RequestType = InferRequestType<(typeof client.api.auth.register)['$post']>;

export const useRegister = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json }) => {
      const response = await client.api.auth.register['$post']({ json });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload && typeof payload === 'object' && 'error' in payload
            ? String((payload as { error?: string }).error ?? 'Failed to register!')
            : 'Failed to register!';
        throw new Error(message);
      }

      return await response.json();
    },
    onSuccess: (payload) => {
      router.refresh();

      if (payload && typeof payload === 'object' && 'needsConfirmation' in payload && payload.needsConfirmation) {
        toast.success('We have sent a verification email. Please verify your account.');
      }

      queryClient.invalidateQueries({
        queryKey: ['current'],
      });
    },
    onError: (error) => {
      console.error('[REGISTER]: ', error);
      toast.error(error.message || 'Failed to register!');
    },
  });

  return mutation;
};
