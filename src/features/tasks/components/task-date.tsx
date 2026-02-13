import { format } from 'date-fns';

import { cn } from '@/lib/utils';

interface TaskDateProps {
  value: string;
  className?: string;
}

export const TaskDate = ({ value, className }: TaskDateProps) => {
  return (
    <div className="text-muted-foreground">
      <span className={cn('truncate', className)}>{format(value, 'PPP HH:mm')}</span>
    </div>
  );
};
