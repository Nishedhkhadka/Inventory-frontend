// Moves focus to the next real field on both Enter and Tab, skipping over
// buttons (e.g. the "+ Add another colour" / remove-line buttons sitting
// mid-form on Sales/Expenses) so Tab always lands on the next input/select
// instead of a stray button in between. Native Tab already includes
// buttons in its order, which is what made Tab feel unreliable on these
// forms — this takes over navigation entirely rather than only handling
// Enter. Attach as onKeyDown={focusNextField} to any input, select, or
// textarea.
export function focusNextField(e) {
  const isEnter = e.key === "Enter";
  const isTab = e.key === "Tab" && !e.shiftKey;
  if (!isEnter && !isTab) return; // Shift+Tab keeps its native "go back" behavior

  // Let textareas keep their normal Enter-for-newline behavior.
  if (isEnter && e.target.tagName === "TEXTAREA") return;
  e.preventDefault();

  const form = e.target.form;
  if (!form) return;

  const focusable = Array.from(form.querySelectorAll("input, select, textarea")).filter(
    (el) => !el.disabled && el.tabIndex !== -1 && el.offsetParent !== null
  );

  const index = focusable.indexOf(e.target);
  const next = focusable[index + 1];
  if (next) {
    next.focus();
    if (next.select) next.select();
  }
}

// Kept as an alias so any existing onKeyDown={focusNextOnEnter} references
// keep working without a rename pass.
export const focusNextOnEnter = focusNextField;
