export default function LoadingScreen() {
  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 items-center justify-center">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 animate-pulse" />
        <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 animate-pulse [animation-delay:150ms]" />
        <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 animate-pulse [animation-delay:300ms]" />
      </div>
    </div>
  );
}
