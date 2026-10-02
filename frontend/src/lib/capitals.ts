/**
 * The first letter typed into a text box comes out as a capital, with or
 * without Caps Lock ("students meals" becomes "Students meals"), as the
 * school asked. Only the box's first letter changes; the rest is as typed.
 *
 * Boxes for emails, passwords, numbers and dates are left alone, and so is
 * any box (or part of the page) marked autoCapitalize="off", like units of
 * measure ("pcs", "kg"). Pasted text is left as it is.
 */

const TEXT_TYPES = new Set(["text", "search"]);

function capitalised(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  if (target instanceof HTMLInputElement) {
    if (!TEXT_TYPES.has(target.type)) return false;
  } else if (!(target instanceof HTMLTextAreaElement)) {
    return false;
  }
  if (target.readOnly || target.disabled) return false;
  return !target.closest('[autocapitalize="off"], [autocapitalize="none"]');
}

function onBeforeInput(event: InputEvent) {
  if (event.inputType !== "insertText" || !event.data) return;
  const box = event.target;
  if (!capitalised(box)) return;
  // Only the box's first letter: nothing but spaces may come before the cursor.
  const start = box.selectionStart ?? 0;
  if (box.value.slice(0, start).trim() !== "") return;
  const at = event.data.search(/\S/);
  if (at < 0) return;
  const letter = event.data[at];
  const capital = letter.toLocaleUpperCase();
  if (capital === letter) return;

  event.preventDefault();
  const text = event.data.slice(0, at) + capital + event.data.slice(at + 1);
  // Typed as if by the keyboard, so the page sees an ordinary change and Undo still works.
  if (!document.execCommand("insertText", false, text)) {
    const end = box.selectionEnd ?? start;
    const proto = box instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(box, box.value.slice(0, start) + text + box.value.slice(end));
    box.setSelectionRange(start + text.length, start + text.length);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

let installed = false;

/** Turns first-letter capitals on for the whole app. */
export function installFirstLetterCapitals() {
  if (installed) return;
  installed = true;
  document.addEventListener("beforeinput", onBeforeInput, true);
}
