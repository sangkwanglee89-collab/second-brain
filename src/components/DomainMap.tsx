import type { GeneratedFile } from "@/lib/types";

type DomainMapProps = {
  files: GeneratedFile[];
  onSelectDomain: (prompt: string) => void;
};

// Icons as simple SVG components keyed by common domain names
const domainIcons: Record<string, string> = {
  identity: "👤",
  career: "💼",
  family: "👨‍👩‍👧",
  fitness: "💪",
  golf: "⛳",
  health: "❤️",
  finance: "📊",
  travel: "✈️",
  hobbies: "🎯",
  relationships: "🤝",
  education: "📚",
  goals: "🎯",
  values: "⭐",
  mental: "🧠",
  social: "👥",
  spiritual: "🧘",
  creativity: "🎨",
  music: "🎵",
  food: "🍳",
  parenting: "👶",
};

function getIcon(fileName: string): string {
  const name = fileName.replace(".md", "").toLowerCase();
  for (const [key, icon] of Object.entries(domainIcons)) {
    if (name.includes(key)) return icon;
  }
  return "📄";
}

function getDisplayName(fileName: string): string {
  return fileName
    .replace(".md", "")
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getSummary(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, headings, and horizontal rules
    if (!trimmed || trimmed.startsWith("#") || trimmed === "---") continue;
    // Return first real content line, truncated
    const clean = trimmed.replace(/\*\*/g, "").replace(/\*/g, "");
    if (clean.length > 100) return clean.slice(0, 97) + "…";
    return clean;
  }
  return "";
}

export default function DomainMap({ files, onSelectDomain }: DomainMapProps) {
  const identityFile = files.find((f) => f.name.toLowerCase().includes("identity"));
  const domainFiles = files.filter((f) => f !== identityFile);

  return (
    <div className="max-w-2xl mx-auto mt-12 px-4">
      {/* Identity card — full width */}
      {identityFile && (
        <button
          onClick={() => onSelectDomain(`Let's talk about who I am — my identity, values, and what's on my mind.`)}
          className="w-full text-left p-5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-150 dark:hover:bg-zinc-850 transition-all group mb-4"
        >
          <div className="flex items-start gap-4">
            <span className="text-2xl mt-0.5">{getIcon(identityFile.name)}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
                {getDisplayName(identityFile.name)}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed truncate">
                {getSummary(identityFile.content)}
              </p>
            </div>
          </div>
        </button>
      )}

      {/* Domain cards — 2-column grid */}
      <div className="grid grid-cols-2 gap-3">
        {domainFiles.map((file) => (
          <button
            key={file.name}
            onClick={() => onSelectDomain(`Let's talk about my ${getDisplayName(file.name).toLowerCase()}.`)}
            className="text-left p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-150 dark:hover:bg-zinc-850 transition-all group"
          >
            <span className="text-lg">{getIcon(file.name)}</span>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-2 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
              {getDisplayName(file.name)}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2">
              {getSummary(file.content)}
            </p>
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 mt-8">
        Tap a domain to start a conversation, or type anything below.
      </p>
    </div>
  );
}
