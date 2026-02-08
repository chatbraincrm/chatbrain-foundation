import { useQuery } from '@tanstack/react-query';
import { getLastMessage } from '@/modules/inbox/threads-api';

interface ThreadLastMessageProps {
  threadId: string;
}

export default function ThreadLastMessage({ threadId }: ThreadLastMessageProps) {
  const { data: lastMsg } = useQuery({
    queryKey: ['thread-last-message', threadId],
    queryFn: () => getLastMessage(threadId),
    staleTime: 30_000,
  });

  if (!lastMsg) return null;

  return (
    <p className="text-xs text-muted-foreground truncate max-w-md">
      {lastMsg.content.length > 80
        ? lastMsg.content.slice(0, 80) + '…'
        : lastMsg.content}
    </p>
  );
}
