export default function DoubleBounce({ size = "lg", className = "" }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  const containerSize = sizeClasses[size] || sizeClasses.md;
  const primaryBgClass = "bg-zinc-950 dark:bg-zinc-50";

  return (
    <div
      className={`relative ${containerSize} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <div
        className={`absolute inset-0 ${primaryBgClass} rounded-full opacity-60 animate-bounce`}
      />
      <div className="absolute inset-0 bg-zinc-400 dark:bg-zinc-600 rounded-full opacity-60 animate-bounce [animation-delay:700ms]" />
    </div>
  );
}
