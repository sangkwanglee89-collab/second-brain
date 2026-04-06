type WelcomeScreenProps = {
  userEmail: string;
  onStart: () => void;
  onLogout: () => void;
};

export default function WelcomeScreen({ userEmail, onStart, onLogout }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 items-center justify-center">
      <div className="max-w-md text-center space-y-6 px-6">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
          Second Brain
        </h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400 leading-relaxed">
          You spend hours consuming other people&apos;s thoughts.
          When&apos;s the last time you organized your own?
        </p>
        <p className="text-sm text-zinc-400 dark:text-zinc-500 leading-relaxed">
          Second Brain is a thinking partner that helps you see your own
          thinking clearly. It starts with a 15-minute conversation — and
          gets sharper the more you use it.
        </p>
        <button
          onClick={onStart}
          className="rounded-xl bg-zinc-900 dark:bg-zinc-100 px-8 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          Get Started
        </button>
        <p className="text-xs text-zinc-400 dark:text-zinc-600 leading-relaxed max-w-sm">
          Private by design. Your data is yours. Not used to train AI.
        </p>
        <div>
          <button
            onClick={onLogout}
            className="text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
          >
            Log out ({userEmail})
          </button>
        </div>
      </div>
    </div>
  );
}
